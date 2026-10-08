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
// Hors ligne : tout appel réseau est coupé, l'application doit être autonome
await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
const page = await ctx.newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));

// 1. Ancien projet (sans identifiants d'évaporateurs ni stations)
const legacy = { current: "p1", projects: { p1: { name: "Projet Alpha", updated: 1, currentRoom: "r1", rooms: [
  { id: "r1", name: "CF1", bilan: { projet: "Projet Alpha" }, brassage: { evaps: [{ name: "Evap 1", type: "simple", x: 3, y: 0.28, dir: 90, q: 3000, T: 8, len: 1.5, dep: 0.45, nf: 2, eh: 0.55 }], vmin: 0.15, target: 40 } }
] } } };
await page.addInitScript(s => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("frigobilan-store-v2", s); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(legacy));
await page.goto(URL0); await page.waitForTimeout(800);

const font = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some(f => f.family.replace(/["']/g, "") === "Mona Sans" && f.status === "loaded"); });
check("police Mona Sans chargée sans réseau (intégrée au fichier)", font);
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

// 5. Onglet Stations : la station créée plus haut est affichée en 2D, en 3D et en nomenclature
await page.locator('.mtabs .tab[data-view="stations"]').tap(); await page.waitForTimeout(1200);
const ui = await page.evaluate(() => ({ main: !document.getElementById("stMain").hidden, chips: document.querySelectorAll("#stBar .stchip").length,
  svg: document.querySelectorAll("#st2d g.c").length, rows: document.querySelectorAll("#stNomen tr[data-key]").length,
  lib: !!window.FBStations3D, canvas: !!document.querySelector("#st3d canvas"), webgl: !!FBStationsUI.viewer() }));
check("Stations : station affichée (2D, nomenclature)", ui.main && ui.chips === 1 && ui.svg === 13 && ui.rows === 13, JSON.stringify(ui));
check("Stations : module 3D chargé à la demande et rendu WebGL actif", ui.lib && ui.canvas && ui.webgl);
check("Stations : l'évaporateur rattaché est nommé", (await page.textContent("#stBar .stchip small")).includes("Evap 1"));

// Sélection au doigt dans la 3D → info, surbrillance du schéma et de la nomenclature
await page.locator("#st3d").scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
const pt = await page.evaluate(() => FBStationsUI.viewer().screenOf("E-V3V"));
await page.touchscreen.tap(pt.x, pt.y); await page.waitForTimeout(300);
const picked = await page.evaluate(() => ({ info: document.getElementById("stInfo").innerText, svg: document.querySelector('#st2d g.c.hl')?.getAttribute("data-key"), row: document.querySelector("#stNomen tr.hl")?.getAttribute("data-key") }));
check("3D : toucher la vanne 3 voies l'identifie et la surligne en 2D et en nomenclature", picked.info.includes("ST1-V6") && picked.svg === "E-V3V" && picked.row === "E-V3V", JSON.stringify(picked).slice(0, 160));

// Rotation au doigt (glisser) puis vues prédéfinies
const cam = () => page.evaluate(() => FBStationsUI.viewer().camera.position.toArray().map(v => +v.toFixed(3)).join(","));
const c0 = await cam();
const box = await page.locator("#st3d canvas").boundingBox();
const cdp = await ctx.newCDPSession(page);
const tp = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
await tp("touchStart", box.x + 80, box.y + 150);
for (let i = 1; i <= 8; i++) await tp("touchMove", box.x + 80 + i * 15, box.y + 150 + i * 3);
await tp("touchEnd"); await page.waitForTimeout(200);
const c1 = await cam();
check("3D : glisser un doigt fait tourner le modèle", c1 !== c0, c0 + " → " + c1);
await page.click('[data-v3="face"]'); await page.waitForTimeout(700);
const face = await page.evaluate(() => { const v = FBStationsUI.viewer(), d = v.camera.position.clone().sub(v.controls.target).normalize(); return [d.x, d.y, d.z].map(x => +x.toFixed(2)); });
check("3D : vue de face", face[2] > 0.99, face.join(","));

// Clic sur un symbole du schéma → sélection
await page.locator('#st2d g.c[data-key="B-TA"]').click(); await page.waitForTimeout(200);
check("2D : toucher la vanne d'équilibrage la sélectionne", (await page.innerText("#stInfo")).includes("Vanne d'équilibrage"));

// Réglages : DN, option filtre, nom de réseau
await page.selectOption("#stDN", "50"); await page.waitForTimeout(200);
await page.locator('[data-opt="filtreTor"]').check(); await page.waitForTimeout(200);
await page.fill("#stNetA", "Réseau froid"); await page.waitForTimeout(200);
const tuned = await page.evaluate(() => { const s = Store.get("stations")[0]; return { dn: s.dn, n: s.composants.length, svg: document.querySelectorAll("#st2d g.c").length, title: document.querySelector("#st2d svg").getAttribute("aria-label"), net: document.getElementById("st2d").textContent.includes("Retour Réseau froid") }; });
check("Réglages : DN 50, filtre ajouté, réseau renommé (enregistrés et redessinés)", tuned.dn === 50 && tuned.n === 14 && tuned.svg === 14 && tuned.title.includes("DN 50") && tuned.net, JSON.stringify(tuned));

// Exports : PNG 3D, PNG 2D, CSV
async function download(sel) { const [d] = await Promise.all([page.waitForEvent("download"), page.click(sel)]); const f = await d.path(); return { name: d.suggestedFilename(), data: await readFile(f) }; }
const png3 = await download('[data-png="3d"]'), png2 = await download('#v-stations .st-a2 [data-png="2d"]'), csv = await download("#stCsv");
check("Export PNG du 3D", png3.name.endsWith("-3d.png") && png3.data.length > 8000 && png3.data.subarray(1, 4).toString() === "PNG", png3.name + " " + png3.data.length + " o");
check("Export PNG du schéma", png2.name.endsWith("-schema.png") && png2.data.length > 8000, png2.name + " " + png2.data.length + " o");
const csvText = csv.data.toString("utf8");
check("Export CSV de la nomenclature (Excel FR)", csvText.startsWith("\ufeffRepère;Désignation") && csvText.includes("ST1-V6;Vanne 3 voies à bille motorisée TOR;DN 50"), csv.name);

// Impression de la fiche
await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
await page.click("#stPrint");
const note = await page.evaluate(() => ({ printed: !!window.__printed, h1: document.querySelector("#note h1")?.textContent, svg: !!document.querySelector("#note svg"), img: !!document.querySelector("#note img"), rows: document.querySelectorAll("#note table tr").length }));
check("Impression : fiche avec schéma, image 3D et nomenclature", note.printed && note.h1 === "Station de vannes ST1" && note.svg && note.img && note.rows > 14, JSON.stringify(note));

// Thème clair : schéma redessiné avec la palette claire
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light")); await page.waitForTimeout(300);
check("Thème clair appliqué au schéma", (await page.innerHTML("#st2d")).includes("#1B2340"));
await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));

// Catalogue : passer la station en « boucle à débit constant · vanne 2 voies »
await page.evaluate(() => FBStationsUI.select(null));
await page.selectOption("#stType", "boucle-v2v"); await page.waitForTimeout(200);
// La station a un repère réglé à la main (TA-1) : l'application demande confirmation
const asked = await page.locator("dialog.mdlg[open]").textContent({ timeout: 3000 }).catch(() => "");
check("Catalogue : confirmation avant de perdre les réglages manuels", asked.includes("Boucle à débit constant"), asked.slice(0, 80));
await page.click('dialog.mdlg button[value="ok"]'); await page.waitForTimeout(500);
const typed = await page.evaluate(() => ({ type: Store.get("stations")[0].type, svg: document.querySelectorAll("#st2d g.c").length, rows: document.querySelectorAll("#stNomen tr[data-key]").length,
  picks: Object.keys(FBStationsUI.viewer() ? FBStationsUI.viewer().camera ? FBStations.layout(Store.get("stations")[0]).items : [] : []).length,
  info: document.getElementById("stTypeInfo").innerText, legend: document.getElementById("stLegend").innerText, der: document.getElementById("stDerBox").hidden, netB: document.getElementById("stNetBBox").hidden,
  title: document.querySelector("#st2d svg").getAttribute("aria-label") }));
check("Catalogue : changement de type (composition, 2D, nomenclature, fiche, légende)", typed.type === "boucle-v2v" && typed.svg === 11 && typed.rows === 11 && typed.picks === 11 &&
  typed.info.includes("Débit batterie constant") && typed.legend.includes("Circulateur") && typed.der && typed.netB && typed.title.includes("Boucle à débit constant"), JSON.stringify(typed).slice(0, 220));
await page.locator("#st3d").scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
const pc = await page.evaluate(() => FBStationsUI.viewer().screenOf("E-POM"));
await page.touchscreen.tap(pc.x, pc.y); await page.waitForTimeout(300);
check("3D : toucher le circulateur l'identifie", (await page.innerText("#stInfo")).includes("Circulateur + kit manométrique"));
await page.selectOption("#stType", "glycol-tor"); await page.waitForTimeout(400);
await page.selectOption("#stDN", "50"); await page.locator('[data-opt="filtreTor"]').check(); await page.fill("#stNetA", "Réseau froid"); await page.waitForTimeout(300);

// Nouvelle station (plus d'évaporateur libre) puis rechargement
await page.click("#stNew"); await page.waitForTimeout(300);
await page.reload(); await page.waitForTimeout(1200);
const after = await page.evaluate(() => ({ view: !document.getElementById("v-stations").hidden, chips: [...document.querySelectorAll("#stBar .stchip")].map(c => c.firstChild.textContent), cur: document.querySelector('#stBar [aria-selected="true"]')?.firstChild.textContent, st1: Store.get("stations")[0].dn }));
check("Rechargement : onglet, 2 stations et réglages restitués", after.view && after.chips.join() === "ST1,ST2" && after.cur === "ST2" && after.st1 === 50, JSON.stringify(after));

check("aucune erreur JavaScript", errors.length === 0, errors.join(" | "));
await browser.close(); server.close();
console.log(failed ? failed + " échec(s)" : "Tous les contrôles sont passés.");
process.exit(failed ? 1 : 0);
