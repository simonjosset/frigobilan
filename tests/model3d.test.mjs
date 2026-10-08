import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/stations/model.js";
import { layout } from "../src/stations/layout.js";
import { buildModel, COULEURS, LEGENDE } from "../src/stations/model3d.js";

function ids() { let n = 0; return () => "id" + ++n; }
function station(patch) { const s = M.createStation({ stations: [] }, "e1", ids()); if (patch) M.setStation(s, patch); return s; }
function meshes(o) { let n = 0; o.traverse(x => { if (x.isMesh) n++; }); return n; }

test("3D : un groupe sélectionnable par composant, à la position du schéma 2D", () => {
  for (const opt of [{}, { options: { isolDeparts: false, filtreTor: true, vidange: false }, dn: 65 }]) {
    const s = station(opt), m = buildModel(s), g = layout(s);
    assert.deepEqual(Object.keys(m.picks).sort(), s.composants.map(c => c.key).sort());
    for (const it of g.items) {
      const grp = m.picks[it.key];
      assert.equal(grp.userData.key, it.key);
      assert.equal(grp.userData.rep, s.composants.find(c => c.key === it.key).rep);
      assert.deepEqual([grp.position.x, grp.position.y, grp.position.z], [it.x, it.y, 0], it.key);
      assert.ok(meshes(grp) >= 2, it.key + " a un volume");
    }
  }
});

test("3D : tuyauterie, coudes, calorifuge et flèches", () => {
  const s = station(), m = buildModel(s);
  const pipes = m.root.getObjectByName("tuyauterie");
  const tubes = pipes.children.filter(o => o.name !== "calorifuge"), calo = pipes.children.filter(o => o.name === "calorifuge");
  const torus = tubes.filter(o => o.geometry.type === "TorusGeometry");
  assert.equal(torus.length, 2, "2 coudes");
  assert.equal(calo.length, tubes.length - 1, "calorifuge sur chaque tronçon et coude (pas sur le té)");
  calo.forEach(c => assert.ok(c.material.transparent));
  assert.equal(m.root.getObjectByName("fleches").children.length, 8); // 4 raccordements réseau, 2 côté batterie, 2 verticales
  const sans = buildModel(station({ isolation: { on: false } }));
  assert.equal(sans.root.getObjectByName("tuyauterie").children.filter(o => o.name === "calorifuge").length, 0);
  // Couleur des tronçons par réseau
  const colors = new Set(tubes.map(o => o.material.color.getHex()));
  [COULEURS.tube, COULEURS.A, COULEURS.B].forEach(c => assert.ok(colors.has(c)));
});

test("3D : dimensions cohérentes avec le DN et l'implantation", () => {
  const s = station({ dn: 50, antenne: 3 }), m = buildModel(s);
  assert.ok(m.size.x > 3 && m.size.x < 3.6, "longueur ≈ antenne + batterie : " + m.size.x);
  assert.ok(m.bounds.min.y < layout(s).y.EB && m.bounds.max.y > layout(s).y.SB);
  const small = buildModel(station({ dn: 15 })), big = buildModel(station({ dn: 100 }));
  const vol = mm => mm.picks["E-V3V"].children[0].geometry.parameters.radiusTop;
  assert.ok(vol(big) > vol(small) * 3);
});

test("3D : départs à gauche = modèle en miroir ; légende complète", () => {
  const d = buildModel(station()), g = buildModel(station({ orientation: "gauche" }));
  assert.equal(d.root.scale.x, 1); assert.equal(g.root.scale.x, -1);
  assert.ok(g.center.x < 0 && d.center.x > 0);
  LEGENDE.forEach(([k]) => assert.ok(COULEURS[k] !== undefined, k));
});
