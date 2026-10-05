import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildHTML } from "../tools/build.mjs";

test("les fichiers construits sont à jour (sinon : npm run build)", async () => {
  const html = await buildHTML();
  for (const f of ["dist/frigobilan.html", "frigobilan.html"]) assert.ok((await readFile(new URL("../" + f, import.meta.url), "utf8")) === html, f + " n'est pas à jour");
});

// Les polices Google sont antérieures aux stations ; elles ont un repli système si le réseau manque.
test("fichier unique : aucune ressource externe hormis les polices Google déjà utilisées", async () => {
  const html = await buildHTML();
  const ext = [...html.matchAll(/(?:src|href)=["'](https?:[^"']+)/g)].map(m => m[1]).filter(u => !/^https:\/\/fonts\.(googleapis|gstatic)\.com(\/|$)/.test(u));
  assert.deepEqual(ext, []);
  assert.ok(!html.includes('data-inline="'), "marqueur non remplacé");
});
