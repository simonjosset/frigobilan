import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/stations/model.js";
import { layout } from "../src/stations/layout.js";
import { schemaSVG } from "../src/stations/schema2d.js";
import { buildModel, legendFor } from "../src/stations/model3d.js";

function ids() { let n = 0; return () => "id" + ++n; }
const TYPES = Object.keys(M.TYPES_SDV);

/* Toutes les combinaisons des options d'un type (2^n stations) */
function variants(type) {
  const keys = Object.keys(M.TYPES_SDV[type].options), out = [];
  for (let m = 0; m < 1 << keys.length; m++) {
    const s = M.createStation({ stations: [] }, "e1", ids(), type), o = {};
    keys.forEach((k, i) => { o[k] = !!(m & (1 << i)); });
    M.setStation(s, { options: o });
    out.push(s);
  }
  return out;
}
function onPipe(g, it) {
  if (it.vert) { const v = g.verts.find(q => q.id === it.vert); return Math.abs(it.x - v.x) < 1e-6 && it.y >= Math.min(v.y1, v.y2) && it.y <= Math.max(v.y1, v.y2); }
  return g.runs.some(r => Math.abs(r.y - it.y) < 1e-6 && it.x >= Math.min(r.x1, r.x2) - 1e-6 && it.x <= Math.max(r.x1, r.x2) + 1e-6);
}

test("catalogue : 7 types complets et cohérents", () => {
  assert.equal(TYPES.length, 7);
  for (const t of TYPES) {
    const T = M.TYPES_SDV[t], lv = new Set(T.levels.map(l => l.id)), vs = new Set(T.verts.map(v => v.id));
    assert.ok(T.nom && T.resume && T.usage && T.notes.length, t);
    assert.ok(M.FAMILLES.includes(T.famille), t);
    assert.ok(["variable", "constant"].includes(T.primaire) && ["variable", "constant"].includes(T.secondaire), t);
    assert.ok(T.reseaux.A, t);
    Object.keys(T.options).forEach(k => assert.ok(M.OPTION_LABELS[k], t + " : option " + k));
    T.runs.forEach(r => assert.ok(lv.has(r.level), t + " : " + r.id));
    T.verts.forEach(v => assert.ok(lv.has(v.from) && lv.has(v.to), t + " : " + v.id));
    T.slots.forEach(s => {
      assert.ok(M.TYPES[s.type], t + " : type " + s.type);
      assert.ok(s.vert ? vs.has(s.vert) : lv.has(s.level), t + " : " + s.key);
      if (s.opt) assert.ok(s.opt in T.options, t + " : " + s.key + " dépend d'une option inconnue");
    });
    assert.equal(new Set(T.slots.map(s => s.key)).size, T.slots.length, t + " : clés uniques");
  }
});

test("tous les types, toutes les options : tuyauterie continue, sans croisement, composants sur les tubes", () => {
  for (const t of TYPES) for (const s of variants(t)) {
    const g = layout(s), tag = t + " " + JSON.stringify(s.options);
    assert.deepEqual(g.pendants, [], tag + " : tube sans raccordement");
    assert.deepEqual(g.croisements, [], tag + " : croisement de tubes");
    assert.equal(g.items.length, s.composants.length, tag);
    g.items.forEach(it => assert.ok(onPipe(g, it), tag + " : " + it.key + " hors tuyauterie"));
    const pos = new Set(g.items.map(it => it.x + "," + it.y));
    assert.equal(pos.size, g.items.length, tag + " : deux composants au même endroit");
    g.items.forEach(it => assert.ok(it.x > 0 && it.x < g.L, tag + " : " + it.key));
    assert.ok(g.tube > 2 * g.L - 1e-6, tag + " : au moins les deux antennes");
  }
});

test("tous les types : 2D, 3D et nomenclature décrivent les mêmes composants", () => {
  for (const t of TYPES) for (const s of variants(t)) {
    const tag = t + " " + JSON.stringify(s.options), svg = schemaSVG(s), m = buildModel(s);
    const reps2d = [...svg.matchAll(/<g class="c" data-key="[^"]+" data-rep="([^"]+)"/g)].map(x => x[1]).sort();
    const repsNom = M.stationRows(s).filter(r => r.rep).map(r => r.rep).sort();
    assert.deepEqual(reps2d, repsNom, tag);
    assert.deepEqual(Object.keys(m.picks).sort(), s.composants.map(c => c.key).sort(), tag);
    assert.equal(new Set(repsNom).size, repsNom.length, tag + " : repères uniques");
    assert.ok(svg.includes(M.TYPES_SDV[t].nom), tag + " : titre");
    assert.ok(legendFor(s).length >= 4, tag);
  }
});

test("règles de conception : régulation sur le retour, purge en haut, vidange en bas, limite primaire", () => {
  for (const t of TYPES) {
    const s = M.createStation({ stations: [] }, "e1", ids(), t), g = layout(s), T = M.TYPES_SDV[t];
    const reg = s.composants.filter(c => /^v[23]v_(reg|mod)$/.test(c.type));
    reg.forEach(c => assert.equal(c.ligne, "sortie", t + " : " + c.key + " doit être sur le retour"));
    g.items.filter(i => i.type === "purge").forEach(i => {
      const role = s.composants.find(c => c.key === i.key).role;
      assert.equal(/vidange/i.test(role), i.orient === "down", t + " : " + i.key + " " + role);
    });
    if (t !== "glycol-tor") { assert.ok(g.limite > 0, t + " : limite secondaire / primaire"); assert.ok(T.slots.some(sl => sl.col === T.limite && /reg/.test(sl.type)), t); }
    assert.ok(s.composants.some(c => c.type === "filtre"), t + " : filtre");
  }
});

test("topologies particulières : by-pass, boucle de dégivrage, échangeur", () => {
  const at = (g, k) => g.items.find(i => i.key === k);
  // Régulation 3 voies : la vanne est au départ du by-pass, le robinet à soupape sur le by-pass
  let g = layout(M.createStation({ stations: [] }, "e", ids(), "reg-v3v"));
  assert.equal(at(g, "S-V3V").x, g.verts[0].x); assert.equal(at(g, "BP-SOU").vert, "BP"); assert.equal(g.tes.length, 1);
  // Boucle à débit constant : circulateur entre la batterie et le by-pass, sonde avant le circulateur
  g = layout(M.createStation({ stations: [] }, "e", ids(), "boucle-v2v"));
  assert.ok(at(g, "E-SON").x < at(g, "E-POM").x && at(g, "E-POM").x < g.verts[0].x && at(g, "E-FIL").x > g.verts[0].x);
  assert.equal(g.tes.length, 2);
  // Dégivrage électrique : circulateur → thermoplongeur → clapet → équilibrage dans le sens de circulation
  g = layout(M.createStation({ stations: [] }, "e", ids(), "deg-electrique"));
  const loop = ["M-POM", "M-THE", "M-CLA", "M-EQ"].map(k => at(g, k));
  loop.forEach((it, i) => { assert.equal(it.level, "M"); if (i) assert.ok(it.x > loop[i - 1].x); });
  assert.equal(g.coudes.length, 2); assert.equal(g.tes.length, 2);
  // Échangeur : le circuit chaud part du corps de l'échangeur, entre les lignes chaudes
  g = layout(M.createStation({ stations: [] }, "e", ids(), "deg-echangeur"));
  const ech = at(g, "M-ECH"), hot = g.runs.filter(r => r.attach === "M-ECH");
  assert.equal(hot.length, 2); hot.forEach(r => assert.ok(Math.min(r.x1, r.x2) > ech.x && Math.min(r.x1, r.x2) < ech.x + g.pitch / 2));
  assert.ok(g.y.HR > g.y.M && g.y.HD < g.y.M);
});

test("actionneur de régulation TOR ou modulant selon l'option", () => {
  const s = M.createStation({ stations: [] }, "e", ids(), "reg-v2v");
  const reg = () => s.composants.find(c => c.key === "S-REG");
  assert.equal(reg().act, "TOR"); assert.equal(M.designation(reg()), "Vanne 2 voies de régulation motorisée TOR");
  M.setStation(s, { options: { regMod: true } });
  assert.equal(reg().act, "modulant"); assert.equal(M.designation(reg()), "Vanne 2 voies de régulation motorisée modulante");
  assert.ok(schemaSVG(s).includes(">MOD</text>"));
  M.setComponent(s, "S-REG", { act: "TOR" }); M.setStation(s, { options: { regMod: true } });
  assert.equal(reg().act, "TOR", "réglage manuel conservé");
  assert.equal(M.createStation({ stations: [] }, "e", ids(), "boucle-v3v").composants.find(c => c.key === "S-V3V").act, "modulant");
});

test("changement de type : nouvelle composition, réseaux par défaut seulement s'ils n'ont pas été renommés", () => {
  const s = M.createStation({ stations: [] }, "e", ids(), "glycol-tor");
  M.setComponent(s, "S-ISO", { rep: "MANUEL-1" });
  M.setStation(s, { type: "reg-v2v" });
  assert.equal(s.type, "reg-v2v");
  assert.deepEqual(s.composants.map(c => c.key), ["S-ISO", "S-PUR", "S-REG", "S-EQ", "E-ISO", "E-VID", "E-FIL", "E-ISOR"]);
  assert.ok(!s.composants.some(c => c.custom), "réglages manuels abandonnés");
  assert.deepEqual(s.options, { regMod: false, isolBat: false });
  assert.equal(s.reseaux.A, "Réseau eau glacée");
  M.setStation(s, { reseaux: { A: "Boucle Alpha" } }); M.setStation(s, { type: "boucle-v2v" });
  assert.equal(s.reseaux.A, "Boucle Alpha");
  // Une station enregistrée avant le catalogue garde sa composition et ses noms de réseaux
  const old = M.normalizeStation({ id: "x", code: "ST1", type: "glycol-tor", dn: 32, reseaux: { A: "Réseau A (régulé)", B: "Réseau B (TOR)" } }, "ST1");
  assert.deepEqual(old.composants.map(c => c.key), ["S-ISO", "S-PUR", "A-V2M", "A-ISO", "B-V2T", "B-TA", "E-ISO", "E-PUR", "E-FIL", "E-VID", "E-V3V", "A-ISOE", "B-ISOE"]);
  assert.equal(old.reseaux.A, "Réseau A (régulé)");
  M.setStation(old, { type: "deg-echangeur" });
  assert.deepEqual([old.reseaux.A, old.reseaux.B], ["Réseau froid", "Réseau chaud"]);
  // Type inconnu dans un import : type par défaut
  assert.equal(M.normalizeStation({ type: "inconnu" }, "ST9").type, M.TYPE_DEFAUT);
});
