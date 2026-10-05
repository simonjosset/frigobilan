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
// lazy : code minifié rangé dans un <script type="text/plain">, exécuté à la demande par l'application
const MODULES = [
  { marker: '<script data-inline="stations"></script>', entry: "src/stations/index.js", global: "FBStations" },
  { marker: '<script data-inline="stations3d"></script>', entry: "src/stations/index3d.js", global: "FBStations3D", lazy: true }
];

// Polices intégrées (Mona Sans, licence SIL OFL : src/fonts/OFL.txt) : aucun appel réseau
const FONTS = [
  { file: "src/fonts/mona-sans-latin.woff2", range: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
  { file: "src/fonts/mona-sans-latin-ext.woff2", range: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" }
];
async function fontCSS() {
  let css = "/* Mona Sans (SIL Open Font License 1.1), intégrée par « npm run build » */\n";
  for (const f of FONTS) {
    const b64 = (await readFile(path.join(root, f.file))).toString("base64");
    css += "@font-face{font-family:'Mona Sans';font-style:normal;font-weight:200 900;font-display:swap;src:url(data:font/woff2;base64," + b64 + ") format('woff2');unicode-range:" + f.range + "}\n";
  }
  return css;
}

export async function buildHTML() {
  let html = await readFile(path.join(root, "src/frigobilan.html"), "utf8");
  const fontsMarker = '<style data-inline="fonts"></style>';
  if (!html.includes(fontsMarker)) throw new Error("Marqueur introuvable dans src/frigobilan.html : " + fontsMarker);
  const fonts = await fontCSS();
  html = html.replace(fontsMarker, () => "<style>" + fonts + "</style>");
  for (const m of MODULES) {
    if (!html.includes(m.marker)) throw new Error("Marqueur introuvable dans src/frigobilan.html : " + m.marker);
    const out = await build({ entryPoints: [path.join(root, m.entry)], bundle: true, format: "iife", globalName: m.global, target: "es2017", write: false, charset: "utf8", legalComments: "inline", minify: !!m.lazy });
    // Neutralise les séquences qui fermeraient la balise <script> (équivalentes en JavaScript)
    const code = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
    const head = "/* Généré par « npm run build » depuis " + m.entry + " : ne pas modifier ici. */\n";
    html = html.replace(m.marker, () => m.lazy ? '<script type="text/plain" id="lazy-' + m.global + '">' + head + code + "</script>" : "<script>\n" + head + code + "</script>");
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
