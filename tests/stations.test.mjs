import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/stations/model.js";

// Identifiants déterministes pour les tests
function ids(prefix = "id") { let n = 0; return () => prefix + ++n; }

// Projet « ancien » : tel qu'enregistré avant les stations (aucun identifiant d'évaporateur)
function legacyProject() {
  return {
    name: "Projet Alpha", updated: 1,
    rooms: [
      { id: "r1", name: "CF1", bilan: { projet: "Projet Alpha", Ti: "2" }, brassage: { evaps: [{ name: "Evap 1", q: 3000 }, { name: "Evap 2", q: 2500 }], vmin: 0.15 } },
      { id: "r2", name: "CF2", bilan: { Ti: "-20" } }
    ],
    currentRoom: "r1",
    consult: { v: { projet: "Projet Alpha" }, evs: [] }
  };
}
function count(station) {
  const c = {}; station.composants.forEach(x => { c[x.type] = (c[x.type] || 0) + 1; }); return c;
}

test("composition par défaut : celle du schéma de principe", () => {
  const s = M.createStation({ stations: [] }, "e1", ids());
  assert.deepEqual(count(s), { iso: 5, purge: 3, filtre: 1, v3v_tor: 1, v2v_tor: 1, v2v_mod: 1, ta: 1 });
  assert.equal(s.composants.length, 13);
  assert.equal(s.type, "glycol-tor");
  assert.equal(s.code, "ST1");
});

test("composition du devis type : 2 isolements, 2 filtres, 2 purges", () => {
  const s = M.createStation({ stations: [] }, "e1", ids());
  M.setStation(s, { options: { isolDeparts: false, filtreTor: true, vidange: false } });
  assert.deepEqual(count(s), { iso: 2, purge: 2, filtre: 2, v3v_tor: 1, v2v_tor: 1, v2v_mod: 1, ta: 1 });
  const rows = M.stationRows(s).filter(r => r.unite === "u" && r.key !== "COUDE");
  const des = rows.map(r => r.des);
  assert.ok(des.includes("Vanne 3 voies à bille motorisée TOR"));
  assert.ok(des.includes("Vanne 2 voies à bille motorisée TOR"));
  assert.ok(des.includes("Vanne 2 voies de régulation à siège, à brides motorisée modulante"));
  assert.ok(des.includes("Robinet d'équilibrage (type TA)"));
});

test("repères uniques, préfixés par le code de la station", () => {
  const s = M.createStation({ stations: [] }, "e1", ids());
  const reps = s.composants.map(c => c.rep);
  assert.equal(new Set(reps).size, reps.length);
  reps.forEach(r => assert.match(r, /^ST1-[VPFR]\d+$/));
  assert.deepEqual(reps.filter(r => r.startsWith("ST1-P")), ["ST1-P1", "ST1-P2", "ST1-P3"]);
  M.setStation(s, { code: "STA" });
  s.composants.forEach(c => assert.match(c.rep, /^STA-/));
});

test("le DN de la station s'applique aux composants, sauf purges et réglages manuels", () => {
  const s = M.createStation({ stations: [] }, "e1", ids());
  M.setComponent(s, "B-TA", { dn: 25 });
  M.setStation(s, { dn: 50 });
  for (const c of s.composants) {
    if (c.type === "purge") assert.equal(c.dn, 15, c.key);
    else if (c.key === "B-TA") assert.equal(c.dn, 25);
    else assert.equal(c.dn, 50, c.key);
  }
  M.setComponent(s, "B-TA", { dn: null });
  assert.equal(s.composants.find(c => c.key === "B-TA").dn, 50);
  M.setStation(s, { dn: 47 }); // arrondi au DN normalisé le plus proche
  assert.equal(s.dn, 50);
});

test("changer les options conserve les réglages manuels des composants restants", () => {
  const s = M.createStation({ stations: [] }, "e1", ids());
  M.setComponent(s, "E-V3V", { rep: "V3V-01", act: "modulant", dn: 40 });
  M.setStation(s, { options: { isolDeparts: false } });
  const v = s.composants.find(c => c.key === "E-V3V");
  assert.deepEqual([v.rep, v.act, v.dn], ["V3V-01", "modulant", 40]);
  assert.equal(M.designation(v), "Vanne 3 voies à bille motorisée modulante");
  assert.ok(!s.composants.some(c => c.key === "A-ISOE"));
});

test("ancien projet : identifiants ajoutés aux évaporateurs, rien d'autre ne change", () => {
  const p = legacyProject(), before = JSON.parse(JSON.stringify(p));
  M.migrateProject(p, ids("ev"));
  assert.deepEqual(p.rooms[0].brassage.evaps.map(e => e.id), ["ev1", "ev2"]);
  assert.deepEqual(p.stations, []);
  // Hors identifiants et liste de stations, le projet est identique
  p.rooms[0].brassage.evaps.forEach(e => delete e.id); delete p.stations;
  assert.deepEqual(p, before);
});

test("migration idempotente et doublons d'identifiants corrigés (chambre copiée)", () => {
  const p = legacyProject(); M.migrateProject(p, ids("ev"));
  p.rooms[1].brassage = JSON.parse(JSON.stringify(p.rooms[0].brassage)); // copie de CF1
  assert.equal(M.ensureEvapIds(p, ids("new")), true);
  assert.deepEqual(p.rooms[0].brassage.evaps.map(e => e.id), ["ev1", "ev2"]);
  assert.deepEqual(p.rooms[1].brassage.evaps.map(e => e.id), ["new1", "new2"]);
  assert.equal(M.ensureEvapIds(p, ids("x")), false);
});

test("stations abîmées ou partielles : complétées ou écartées", () => {
  const p = legacyProject();
  p.stations = [null, "x", 3, { evapId: "e9", dn: "33", antenne: "1,5", options: { filtreTor: true } }, { id: "s1" }, { id: "s1" }];
  M.migrateProject(p, ids("n"));
  assert.equal(p.stations.length, 3);
  const s = p.stations[0];
  assert.equal(s.dn, 32); assert.equal(s.antenne, 1.5);
  assert.equal(s.options.filtreTor, true); assert.equal(s.options.isolDeparts, true);
  assert.equal(s.composants.length, 14);
  assert.deepEqual(p.stations.map(x => x.code), ["ST1", "ST2", "ST3"]);
  assert.equal(new Set(p.stations.map(x => x.id)).size, 3);
});

test("export puis import JSON : la station est restituée à l'identique", () => {
  const p = legacyProject(); M.migrateProject(p, ids("ev"));
  const s = M.addStation(p, "ev2", ids("st"));
  M.setStation(s, { dn: 40, antenne: 2, orientation: "gauche", isolation: { on: false }, reseaux: { A: "Réseau froid", B: "Réseau chaud" } });
  M.setComponent(s, "B-TA", { rep: "TA-1", dn: 32 });
  const back = M.migrateProject(JSON.parse(JSON.stringify({ format: "frigobilan", project: p })).project, ids("zz"));
  assert.deepEqual(back.stations, p.stations);
  assert.deepEqual(back.rooms, p.rooms);
});

test("nomenclature d'une station : composants, tube, coudes et calorifuge", () => {
  const s = M.createStation({ stations: [] }, "e1", ids());
  M.setStation(s, { dn: 32, antenne: 1.2, derivation: 0.4, isolation: { on: true, ep: 13 } });
  const rows = M.stationRows(s);
  assert.equal(rows.filter(r => r.unite === "u" && r.rep).length, 13);
  const tube = rows.find(r => r.key === "TUBE"), calo = rows.find(r => r.key === "CALO");
  assert.equal(tube.qte, 3.2); assert.equal(tube.unite, "ml");
  assert.equal(calo.des, "Calorifuge élastomère ép. 13 mm"); assert.equal(calo.qte, 3.2);
  assert.equal(rows.find(r => r.key === "COUDE").qte, 2);
  M.setStation(s, { isolation: { on: false } });
  assert.ok(!M.stationRows(s).some(r => r.key === "CALO"));
});

test("nomenclature du projet : regroupement par désignation et DN", () => {
  const p = { rooms: [], stations: [] };
  const a = M.addStation(p, "e1", ids("a")), b = M.addStation(p, "e2", ids("b"));
  M.setStation(b, { dn: 50 });
  const rows = M.projectRows(p);
  const iso32 = rows.find(r => r.des === "Vanne à bille d'isolement" && r.dn === 32);
  const iso50 = rows.find(r => r.des === "Vanne à bille d'isolement" && r.dn === 50);
  assert.equal(iso32.qte, 5); assert.equal(iso50.qte, 5);
  assert.match(iso32.rep, /^ST1-V/); assert.match(iso50.rep, /^ST2-V/);
  const purges = rows.find(r => r.des === "Vanne de purge / vidange");
  assert.equal(purges.dn, 15); assert.equal(purges.qte, 6);
  assert.equal(rows.find(r => r.des === "Tube acier" && r.dn === 32).qte, 3);
  assert.equal(a.code, "ST1"); assert.equal(b.code, "ST2");
});

test("CSV pour Excel : BOM, point-virgule, virgule décimale, guillemets", () => {
  const csv = M.toCSV([{ rep: "ST1-V1", des: 'Vanne "spéciale"; test', dn: 32, qte: 3.2, unite: "ml", act: "", role: "" }], M.STATION_COLS);
  assert.ok(csv.startsWith("﻿Repère;Désignation;DN;"));
  const line = csv.split("\r\n")[1];
  assert.equal(line, 'ST1-V1;"Vanne ""spéciale""; test";DN 32;;3,2;ml;');
  assert.ok(csv.endsWith("\r\n"));
  const tsv = M.toTSV([{ des: "Filtre", dn: 25, qte: 1, unite: "u", rep: "ST1-F1" }], M.PROJECT_COLS);
  assert.equal(tsv, "Désignation\tDN\tQuantité\tUnité\tRepères\nFiltre\tDN 25\t1\tu\tST1-F1");
});

test("évaporateurs du projet et stations orphelines", () => {
  const p = legacyProject(); M.migrateProject(p, ids("ev"));
  p.rooms[1].brassage = { evaps: [{ id: "ev9", name: "Evap 1" }] };
  assert.deepEqual(M.listEvaporators(p).map(e => e.label), ["CF1 · Evap 1", "CF1 · Evap 2", "CF2 · Evap 1"]);
  const s = M.addStation(p, "ev2", ids("st"));
  assert.equal(M.isOrphan(p, s), false);
  p.rooms[0].brassage.evaps.pop();
  assert.equal(M.isOrphan(p, s), true);
});
