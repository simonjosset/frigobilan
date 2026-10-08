import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/stations/model.js";
import { layout, pitch } from "../src/stations/layout.js";
import { schemaSVG, shortRep, PALETTE_SOMBRE } from "../src/stations/schema2d.js";

function ids() { let n = 0; return () => "id" + ++n; }
function station(patch) { const s = M.createStation({ stations: [] }, "e1", ids()); if (patch) M.setStation(s, patch); return s; }
const VOID = new Set(["path", "rect", "circle", "line", "polygon"]);

/* Vérifie que le SVG est du XML bien formé (balises équilibrées, attributs entre guillemets). */
function wellFormed(svg) {
  const stack = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>/g)) {
    const [, close, tag, , self] = m;
    if (self) continue;
    if (close) { assert.equal(stack.pop(), tag, "balise fermante inattendue : " + tag); }
    else { assert.ok(!VOID.has(tag), "balise " + tag + " non fermée"); stack.push(tag); }
  }
  assert.deepEqual(stack, []);
  // Pas de chevron ni d'esperluette brute dans les textes
  for (const m of svg.matchAll(/>([^<]*)</g)) assert.ok(!/[<>]|&(?!(amp|lt|gt|quot|#39);)/.test(m[1]), "texte non échappé : " + m[1]);
}
function comps(svg) { return [...svg.matchAll(/<g class="c" data-key="([^"]+)" data-rep="([^"]+)"/g)].map(m => ({ key: m[1], rep: m[2] })); }

test("implantation : composants dans l'ordre du schéma, longueurs et allongement", () => {
  const s = station({ antenne: 1 });
  const g = layout(s);
  assert.equal(g.pitch, pitch(32)); assert.equal(g.pitch, 0.308);
  assert.equal(g.endCol, 8); assert.equal(g.required, 2.31); assert.equal(g.L, 2.31); assert.equal(g.allonge, true);
  const at = k => g.items.find(i => i.key === k), te = g.tes[0], vert = id => g.verts.find(v => v.id === id);
  assert.ok(at("S-ISO").x < at("S-PUR").x && at("S-PUR").x < te.x && te.x < at("A-V2M").x && at("A-V2M").x < at("A-ISO").x);
  assert.ok(at("E-ISO").x < at("E-PUR").x && at("E-PUR").x < at("E-FIL").x && at("E-FIL").x < at("E-VID").x && at("E-VID").x < at("E-V3V").x);
  assert.equal(at("E-V3V").x, vert("EB-v").x); assert.equal(te.x, vert("SB-v").x);
  assert.deepEqual([at("B-V2T").level, at("B-TA").level, at("B-ISOE").level], ["SB", "SB", "EB"]);
  assert.ok(at("B-V2T").y > at("A-V2M").y && at("B-ISOE").y < at("A-ISOE").y);
  // Toutes les vannes tiennent dans la longueur des antennes
  g.items.forEach(i => assert.ok(i.x > 0 && i.x < g.L, i.key));
  assert.equal(layout(station({ antenne: 4 })).allonge, false);
});

test("schéma 2D : chaque composant dessiné une fois, repères identiques à la nomenclature", () => {
  for (const opt of [{}, { options: { isolDeparts: false, filtreTor: true, vidange: false } }, { dn: 80, orientation: "gauche" }]) {
    const s = station(opt), svg = schemaSVG(s), c = comps(svg);
    assert.deepEqual(c.map(x => x.key).sort(), s.composants.map(x => x.key).sort());
    const reps = M.stationRows(s).filter(r => r.rep).map(r => r.rep).sort();
    assert.deepEqual(c.map(x => x.rep).sort(), reps);
    // Le repère affiché (sans le code de station) figure dans le dessin
    s.composants.forEach(k => assert.ok(svg.includes(">" + shortRep(s, k.rep) + "</text>"), k.rep));
  }
});

test("schéma 2D : XML bien formé, textes saisis échappés", () => {
  const s = station({ reseaux: { A: "Froid <-8 °C> & co", B: 'Chaud "dégivrage"' } });
  M.setComponent(s, "B-TA", { rep: "R&D<1>" });
  const svg = schemaSVG(s);
  wellFormed(svg);
  assert.ok(svg.includes("Retour Froid &lt;-8 °C&gt; &amp; co"));
  assert.ok(svg.includes('data-rep="R&amp;D&lt;1&gt;"'));
  wellFormed(schemaSVG(station({ orientation: "gauche" }), { palette: PALETTE_SOMBRE }));
});

test("schéma 2D : options, calorifuge, orientation et thème", () => {
  const avec = schemaSVG(station()), sans = schemaSVG(station({ isolation: { on: false } }));
  assert.equal((avec.match(/class="calo"/g) || []).length, 8); // 6 tronçons + 2 verticales
  assert.ok(!sans.includes('class="calo"'));
  assert.ok(avec.includes("calorifugée 19 mm") && !sans.includes("calorifugée"));
  const filtres = svg => (svg.match(/data-key="[^"]*FIL"/g) || []).length;
  assert.equal(filtres(avec), 1);
  assert.equal(filtres(schemaSVG(station({ options: { filtreTor: true } }))), 2);
  // Départs à gauche : la batterie est dessinée à droite
  const w = svg => +svg.match(/viewBox="0 0 ([\d.]+)/)[1], bx = svg => +svg.match(/<rect class="sym fill" x="([\d.]+)"/)[1]; // 1er rectangle : la batterie
  const d = schemaSVG(station()), g = schemaSVG(station({ orientation: "gauche" }));
  assert.ok(bx(d) < w(d) / 2 && bx(g) > w(g) / 2);
  assert.ok(schemaSVG(station(), { palette: PALETTE_SOMBRE }).includes('fill="#0B1739"'));
});
