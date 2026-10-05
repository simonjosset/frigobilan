/* Construit le fichier unique de l'application.
   src/frigobilan.html + modules de src/ → dist/frigobilan.html (téléchargeable)
   et frigobilan.html à la racine (servi par GitHub Pages pour l'app installée).
   Usage : npm run build            construit
           npm run build -- --check vérifie que les fichiers construits sont à jour */
import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUTS = ["dist/frigobilan.html", "frigobilan.html"];

// Modules intégrés : marqueur dans le HTML → point d'entrée et nom global
const MODULES = [{ marker: '<script data-inline="stations"></script>', entry: "src/stations/index.js", global: "FBStations" }];

export async function buildHTML() {
  let html = await readFile(path.join(root, "src/frigobilan.html"), "utf8");
  for (const m of MODULES) {
    if (!html.includes(m.marker)) throw new Error("Marqueur introuvable dans src/frigobilan.html : " + m.marker);
    const out = await build({ entryPoints: [path.join(root, m.entry)], bundle: true, format: "iife", globalName: m.global, target: "es2017", write: false, charset: "utf8", legalComments: "inline" });
    const code = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
    html = html.replace(m.marker, () => "<script>\n/* Généré par « npm run build » depuis " + m.entry + " : ne pas modifier ici. */\n" + code + "</script>");
  }
  return html;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const html = await buildHTML();
  if (process.argv.includes("--check")) {
    let stale = [];
    for (const f of OUTPUTS) { const cur = await readFile(path.join(root, f), "utf8").catch(() => ""); if (cur !== html) stale.push(f); }
    if (stale.length) { console.error("Fichiers à reconstruire (npm run build) : " + stale.join(", ")); process.exit(1); }
    console.log("Fichiers construits à jour.");
  } else {
    await mkdir(path.join(root, "dist"), { recursive: true });
    for (const f of OUTPUTS) await writeFile(path.join(root, f), html);
    console.log("Construit : " + OUTPUTS.join(", ") + " (" + Math.round(Buffer.byteLength(html) / 1024) + " Ko)");
  }
}
