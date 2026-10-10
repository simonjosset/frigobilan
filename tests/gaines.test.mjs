import { test } from "node:test";
import assert from "node:assert/strict";
import * as G from "../src/gaines/gaines.js";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " : " + a + " ≠ " + b + " ± " + tol);

test("air : masse volumique et viscosité selon la température", () => {
  near(G.airProps(20).rho, 1.204, 0.002); near(G.airProps(0).rho, 1.292, 0.002);
  near(G.airProps(20).nu * 1e6, 15.06, 0.1);
});

test("gaine ronde : vitesse et perte de charge conformes aux abaques (Ø 400, 3 000 m³/h)", () => {
  const r = G.rond(3000, 400, 20, 0.15);
  near(r.v, 6.63, 0.01, "vitesse"); near(r.pam, 1.22, 0.05, "Pa/m");
  // Frottement : laminaire 64/Re, turbulent de Colebrook (tube lisse, Re 1e5 ≈ 0,018)
  near(G.friction(1000, 0, 0.1), 0.064, 1e-9); near(G.friction(1e5, 0, 0.1), 0.018, 0.0005);
});

test("diamètre équivalent d'une gaine rectangulaire (Huebscher, valeurs des tables)", () => {
  near(G.deqRect(400, 200), 305, 1); near(G.deqRect(600, 300), 457, 1); near(G.deqRect(500, 500), 547, 1);
});

test("gaine rectangulaire : plus petite section sous la vitesse maxi, pas de 50 mm, moins de tôle", () => {
  const c = G.calcLigne({ type: "rect", Q: 5000, L: 10 }, { vmax: 7 });
  assert.deepEqual([c.g.a, c.g.b], [500, 400]);
  assert.ok(c.g.v <= 7);
  assert.equal(c.surface, 18); // 2 × (0,5 + 0,4) × 10 m
  near(c.pdc, 11.8, 0.2);
  // Toutes les sections possibles respectent la vitesse, le pas de 50 mm et le rapport maxi
  for (const x of G.rectCandidates(5000, { vmax: 7, ratio: 4 })) {
    assert.ok(x.v <= 7 + 1e-9 && x.a % 50 === 0 && x.b % 50 === 0 && Math.max(x.a / x.b, x.b / x.a) <= 4 + 1e-9);
    assert.ok(x.perimetre >= c.g.perimetre - 1e-9, "la section retenue a le plus petit périmètre");
  }
});

test("gaine rectangulaire : hauteur maximale et rapport largeur / hauteur", () => {
  const c = G.calcLigne({ type: "rect", Q: 5000, hmax: 250 }, { vmax: 7, ratio: 4 });
  assert.deepEqual([c.g.a, c.g.b], [800, 250]);
  const e = G.calcLigne({ type: "rect", Q: 20000, hmax: 200 }, { vmax: 7, ratio: 4 });
  assert.match(e.erreur, /Aucune gaine possible/);
  // 12 000 m³/h sous 200 mm : 2 400 × 200, possible seulement si l'on accepte une gaine très aplatie
  assert.match(G.calcLigne({ type: "rect", Q: 12000, hmax: 200 }, { vmax: 7, ratio: 10 }).erreur, /Aucune gaine possible/);
  assert.deepEqual((g => [g.a, g.b])(G.calcLigne({ type: "rect", Q: 12000, hmax: 200 }, { vmax: 7, ratio: 15 }).g), [2400, 200]);
  // Largeur limitée à 3 m : 20 000 m³/h ne passe pas sous 200 mm, même très aplati
  assert.match(G.calcLigne({ type: "rect", Q: 20000, hmax: 200 }, { vmax: 7, ratio: 30 }).erreur, /Aucune gaine possible/);
  // Variantes : hauteurs voisines de la section retenue, toutes sous la vitesse maxi
  assert.deepEqual(c.alt.map(x => x.b), [250]); // une seule hauteur respecte 4:1 sous 250 mm
  const libre = G.calcLigne({ type: "rect", Q: 5000 }, { vmax: 7 });
  assert.ok(libre.alt.length >= 3 && libre.alt.includes(libre.g) && libre.alt.every(x => x.v <= 7 + 1e-9));
});

test("gaines rondes galva et textiles : diamètre normalisé, vitesse maxi", () => {
  const r = G.calcLigne({ type: "rond", Q: 5000 }, { vmax: 7 });
  assert.equal(r.g.d, 560); assert.ok(G.rond(5000, 500, 20, 0.15).v > 7, "Ø 500 serait trop rapide");
  const t = G.calcLigne({ type: "textile", Q: 8000, L: 12 }, { vmax: 7 });
  assert.equal(t.g.d, 710); assert.equal(t.g.pam, null, "pas de Pa/m pour le textile"); assert.equal(t.pdc, null);
  near(t.surface, Math.PI * 0.71 * 12, 0.01);
  assert.ok(G.ROND_GALVA.every((d, i, a) => !i || d > a[i - 1]) && G.ROND_TEXTILE.every((d, i, a) => !i || d > a[i - 1]));
  // Débit trop fort : plus grand diamètre, signalé
  const big = G.calcLigne({ type: "rond", Q: 60000 }, { vmax: 7 });
  assert.equal(big.g.d, 1250); assert.equal(big.trop, true);
});

test("vitesse maxi, température et majoration pris en compte ; saisies vides", () => {
  assert.equal(G.calcLigne({ type: "rond", Q: 5000 }, { vmax: 4 }).g.d, 710);
  const a = G.calcLigne({ type: "rond", Q: 3000, L: 10 }, { vmax: 7, maj: 0 }), b = G.calcLigne({ type: "rond", Q: 3000, L: 10 }, { vmax: 7, maj: 30 });
  near(b.pdc, a.pdc * 1.3, 0.2);
  assert.ok(G.calcLigne({ type: "rond", Q: 3000 }, { T: -20 }).g.pam > G.calcLigne({ type: "rond", Q: 3000 }, { T: 20 }).g.pam, "air froid plus dense");
  assert.deepEqual(G.calcLigne({ type: "rect", Q: 0 }), { vide: true });
  assert.match(G.calcLigne({ type: "rect", Q: 1000 }, { vmax: 0 }).erreur, /vitesse/);
});
