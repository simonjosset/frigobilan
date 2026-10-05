/* Test de bout en bout dans Chromium (format iPhone) sur le fichier construit dist/frigobilan.html.
   Usage : npm run build && npm run test:e2e
   Vérifie que les onglets existants fonctionnent comme avant, que les anciens projets sont migrés
   et qu'une station de vannes survit à un rechargement et à un export / import. */
import { chromium, devices } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  const f = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  try { const body = await readFile(f); res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const URL0 = "http://localhost:" + server.address().port + "/dist/frigobilan.html";

let failed = 0;
function check(name, ok, info) { console.log((ok ? "ok    " : "ÉCHEC ") + name + (info !== undefined ? " — " + info : "")); if (!ok) failed++; }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = await browser.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
// Hors ligne : les polices Google sont coupées, l'application doit fonctionner sans elles
await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
const page = await ctx.newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));

// 1. Ancien projet (sans identifiants d'évaporateurs ni stations)
const legacy = { current: "p1", projects: { p1: { name: "Projet Alpha", updated: 1, currentRoom: "r1", rooms: [
  { id: "r1", name: "CF1", bilan: { projet: "Projet Alpha" }, brassage: { evaps: [{ name: "Evap 1", type: "simple", x: 3, y: 0.28, dir: 90, q: 3000, T: 8, len: 1.5, dep: 0.45, nf: 2, eh: 0.55 }], vmin: 0.15, target: 40 } }
] } } };
await page.addInitScript(s => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("frigobilan-store-v2", s); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(legacy));
await page.goto(URL0); await page.waitForTimeout(800);

check("module des stations chargé", await page.evaluate(() => typeof window.FBStations === "object" && typeof FBStations.stationRows === "function"));
check("Bilan : puissance calculée", (await page.textContent("#P")).trim() !== "", await page.textContent("#P"));
for (const v of ["visuel", "brassage", "consult", "elec", "dn", "bilan"]) {
  await page.locator(`.mtabs .tab[data-view="${v}"]`).tap(); await page.waitForTimeout(300);
  check("onglet " + v + " affiché", await page.evaluate(v => !document.getElementById("v-" + v).hidden, v));
}
await page.locator('.mtabs .tab[data-view="dn"]').tap(); await page.waitForTimeout(200);
const dn = (await page.textContent("#dnRes0 .dnbig b")).trim();
check("DN rapide : exemple 40 kW eau 7/12 °C → DN 40", dn === "40", "DN " + dn);

// 2. Migration : l'évaporateur a reçu un identifiant, enregistré au prochain changement
await page.evaluate(() => Store.set("bilan", Store.get("bilan") || {}));
let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("frigobilan-store-v2")));
let proj = saved.projects[saved.current];
const evId = proj.rooms[0].brassage.evaps[0].id;
check("ancien projet : identifiant d'évaporateur ajouté", typeof evId === "string" && evId.length > 4, evId);
check("ancien projet : liste de stations vide", Array.isArray(proj.stations) && proj.stations.length === 0);
check("ancien projet : nom et bilan inchangés", proj.name === "Projet Alpha" && proj.rooms[0].bilan.projet === "Projet Alpha");

// 3. Station créée, rechargement, export puis import
const created = await page.evaluate(id => {
  const list = Store.get("stations") || [];
  const p = { stations: list, rooms: [] }, s = FBStations.addStation(p, id);
  FBStations.setStation(s, { dn: 40, antenne: 1.5 }); FBStations.setComponent(s, "B-TA", { rep: "TA-1" });
  Store.set("stations", p.stations); return JSON.stringify(s);
}, evId);
await page.reload(); await page.waitForTimeout(600);
const afterReload = await page.evaluate(() => JSON.stringify((Store.get("stations") || [])[0]));
check("station restituée après rechargement", afterReload === created);
const reimported = await page.evaluate(() => {
  const r = Store.importJSON(Store.exportJSON(false)), all = JSON.parse(localStorage.getItem("frigobilan-store-v2"));
  return JSON.stringify(all.projects[r.id].stations[0]);
});
check("station restituée après export puis import", reimported === created);
const evs = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem("frigobilan-store-v2")); return FBStations.listEvaporators(p.projects[p.current]).length; });
check("évaporateur de la station retrouvé", evs === 1);

// 4. Schéma 2D : XML valide pour le navigateur, affiché avec ses 13 composants
const svgInfo = await page.evaluate(() => {
  const s = (Store.get("stations") || [])[0], svg = FBStations.schemaSVG(s);
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const box = document.createElement("div"); box.innerHTML = svg; document.body.appendChild(box);
  const r = { xml: !doc.querySelector("parsererror"), comps: box.querySelectorAll("g.c").length, w: Math.round(box.querySelector("svg").getBoundingClientRect().width) };
  box.remove(); return r;
});
check("schéma 2D : XML valide et 13 composants affichés", svgInfo.xml && svgInfo.comps === 13, JSON.stringify(svgInfo));

check("aucune erreur JavaScript", errors.length === 0, errors.join(" | "));
await browser.close(); server.close();
console.log(failed ? failed + " échec(s)" : "Tous les contrôles sont passés.");
process.exit(failed ? 1 : 0);
