import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildHTML } from "../tools/build.mjs";

test("les fichiers construits sont à jour (sinon : npm run build)", async () => {
  const html = await buildHTML();
  for (const f of ["dist/frigobilan.html", "frigobilan.html"]) assert.ok((await readFile(new URL("../" + f, import.meta.url), "utf8")) === html, f + " n'est pas à jour");
});

test("fichier unique hors ligne : aucune ressource externe (polices et 3D intégrées)", async () => {
  const html = await buildHTML();
  const ext = [...html.matchAll(/(?:src|href)=["'](https?:[^"']+)/g)].map(m => m[1]);
  assert.deepEqual(ext, []);
  assert.ok(!/@import|url\(\s*["']?https?:/.test(html), "aucune feuille ou police distante");
  assert.ok(!html.includes('data-inline="'), "marqueur non remplacé");
  assert.ok(html.includes("font/woff2;base64,"), "police intégrée");
  assert.ok(html.includes('id="lazy-FBStations3D"'), "module 3D intégré");
});
