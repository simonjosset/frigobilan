/* Stations de vannes : modèle de données, migration et nomenclature.
   Module pur (aucun accès au DOM ni au stockage) : il est testé avec `node --test`
   et intégré à frigobilan.html par `npm run build` sous le nom global FBStations.

   Une station équipe un évaporateur (repéré par son identifiant stable `evapId`).
   Elle est enregistrée dans le projet : project.stations = [station, …]. */

import { layout } from "./layout.js";
import { TYPES_SDV, TYPE_DEFAUT, FAMILLES, OPTION_LABELS, typeOf } from "./types.js";

export const VERSION = 1;
export const DN_LIST = [15, 20, 25, 32, 40, 50, 65, 80, 100];
export const ORIENTATIONS = { droite: "Départs à droite", gauche: "Départs à gauche" };
export const ACTIONNEURS = { manuel: "Manuel", TOR: "Motorisé TOR", modulant: "Motorisé modulant" };

/* Types de composants. `des` : désignation de base, l'actionneur est ajouté s'il est motorisé. */
export const TYPES = {
  iso:       { des: "Vanne à bille d'isolement", prefix: "V", act: "manuel" },
  purge:     { des: "Vanne de purge / vidange + bouchon", prefix: "P", act: "manuel" },
  filtre:    { des: "Filtre à tamis", prefix: "F", act: null },
  v3v_tor:   { des: "Vanne 3 voies à bille", prefix: "V", act: "TOR" },
  v2v_tor:   { des: "Vanne 2 voies à bille", prefix: "V", act: "TOR" },
  v2v_mod:   { des: "Vanne 2 voies de régulation à siège, à brides", prefix: "V", act: "modulant" },
  v2v_reg:   { des: "Vanne 2 voies de régulation", prefix: "V", act: "TOR" },
  v3v_reg:   { des: "Vanne 3 voies de régulation", prefix: "V", act: "modulant" },
  ta:        { des: "Vanne d'équilibrage (type TA)", prefix: "R", act: "manuel" },
  soupape:   { des: "Robinet à soupape de réglage", prefix: "R", act: "manuel" },
  clapet:    { des: "Clapet anti-retour", prefix: "K", act: null },
  pompe:     { des: "Circulateur + kit manométrique", prefix: "C", act: null },
  sonde:     { des: "Sonde de température à plongeur", prefix: "T", act: null },
  echangeur: { des: "Échangeur à plaques", prefix: "E", act: null },
  thermo:    { des: "Thermoplongeur avec thermostat de sécurité", prefix: "H", act: null }
};

/* Types de stations : voir types.js (topologie, options, remarques) */
export { TYPES_SDV, TYPE_DEFAUT, FAMILLES, OPTION_LABELS, typeOf };
export const OPTIONS = OPTION_LABELS;

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function isObj(o) { return o !== null && typeof o === "object" && !Array.isArray(o); }
function num(v, def) { var n = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : def; }
function nearestDN(v, def) {
  var n = num(v, NaN); if (!isFinite(n)) return def;
  return DN_LIST.reduce(function (best, d) { return Math.abs(d - n) < Math.abs(best - n) ? d : best; }, DN_LIST[0]);
}

/* ---------- Évaporateurs ---------- */

/* Donne un identifiant stable à chaque évaporateur du projet (onglet Brassage).
   Les doublons (chambre copiée) reçoivent un nouvel identifiant ; le premier rencontré garde le sien.
   Retourne true si quelque chose a changé. */
export function ensureEvapIds(project, makeId) {
  makeId = makeId || newId;
  var seen = {}, changed = false;
  (project && Array.isArray(project.rooms) ? project.rooms : []).forEach(function (r) {
    var evs = r && r.brassage && Array.isArray(r.brassage.evaps) ? r.brassage.evaps : [];
    evs.forEach(function (e) {
      if (!isObj(e)) return;
      if (!e.id || seen[e.id]) { e.id = makeId(); changed = true; }
      seen[e.id] = true;
    });
  });
  return changed;
}

/* Liste des évaporateurs du projet, toutes chambres confondues. */
export function listEvaporators(project) {
  var rooms = project && Array.isArray(project.rooms) ? project.rooms : [], multi = rooms.length > 1, out = [];
  rooms.forEach(function (r) {
    var evs = r && r.brassage && Array.isArray(r.brassage.evaps) ? r.brassage.evaps : [];
    evs.forEach(function (e) {
      if (!isObj(e) || !e.id) return;
      var name = e.name || "Évaporateur";
      out.push({ id: e.id, name: name, roomId: r.id, roomName: r.name || "", label: multi ? (r.name || "") + " · " + name : name });
    });
  });
  return out;
}

/* ---------- Stations ---------- */

// Anciens noms par défaut (avant le catalogue), remplacés quand on change de type
const RESEAUX_ANCIENS = ["Réseau A (régulé)", "Réseau B (TOR)"];

function defaults(code, type) {
  var T = TYPES_SDV[type] || TYPES_SDV[TYPE_DEFAUT];
  return {
    v: VERSION, id: "", code: code || "ST1", evapId: null, type: TYPES_SDV[type] ? type : TYPE_DEFAUT,
    dn: 32, antenne: 2.5, derivation: 0.5, orientation: "droite",
    isolation: { on: true, ep: 19 },
    reseaux: { A: T.reseaux.A, B: T.reseaux.B || "Réseau chaud" },
    options: Object.assign({}, T.options),
    composants: []
  };
}

function nextCode(stations) {
  var used = {}; (stations || []).forEach(function (s) { if (s && s.code) used[s.code] = 1; });
  var n = 1; while (used["ST" + n]) n++;
  return "ST" + n;
}

/* Composition d'une station à partir de son modèle et de ses options.
   Les réglages faits à la main (DN, repère, actionneur) sont conservés, composant par composant. */
export function rebuild(station) {
  var T = typeOf(station), prev = {}, count = {};
  (station.composants || []).forEach(function (c) { if (isObj(c) && c.key) prev[c.key] = c; });
  station.composants = T.slots.filter(function (s) { return !s.opt || station.options[s.opt]; }).map(function (s) {
    var t = TYPES[s.type], p = prev[s.key] || {}, custom = isObj(p.custom) ? p.custom : {};
    var actAuto = s.act === "reg" ? (station.options.regMod ? "modulant" : "TOR") : t.act;
    count[t.prefix] = (count[t.prefix] || 0) + 1;
    var c = {
      key: s.key, type: s.type, ligne: (T.levels.filter(function (l) { return l.id === s.level; })[0] || { ligne: "by-pass" }).ligne, role: s.role,
      dn: custom.dn && DN_LIST.indexOf(p.dn) >= 0 ? p.dn : (s.dn || station.dn),
      rep: custom.rep && p.rep ? String(p.rep) : station.code + "-" + t.prefix + count[t.prefix],
      act: custom.act && ACTIONNEURS[p.act] && t.act ? p.act : actAuto
    };
    if (custom.dn || custom.rep || custom.act) c.custom = { dn: !!custom.dn, rep: !!custom.rep, act: !!custom.act };
    return c;
  });
  return station;
}

/* Complète et corrige une station venant du stockage ou d'un import. */
export function normalizeStation(s, code, type) {
  var o = isObj(s) ? s : {}, d = defaults(code, TYPES_SDV[o.type] ? o.type : type);
  var st = {
    v: VERSION,
    id: o.id ? String(o.id) : "",
    code: o.code ? String(o.code) : d.code,
    evapId: o.evapId ? String(o.evapId) : null,
    type: d.type,
    dn: DN_LIST.indexOf(o.dn) >= 0 ? o.dn : nearestDN(o.dn, d.dn),
    antenne: Math.max(0, num(o.antenne, d.antenne)),
    derivation: Math.max(0, num(o.derivation, d.derivation)),
    orientation: ORIENTATIONS[o.orientation] ? o.orientation : d.orientation,
    isolation: { on: isObj(o.isolation) ? o.isolation.on !== false : d.isolation.on, ep: Math.max(0, num(isObj(o.isolation) ? o.isolation.ep : null, d.isolation.ep)) },
    reseaux: { A: isObj(o.reseaux) && o.reseaux.A ? String(o.reseaux.A) : d.reseaux.A, B: isObj(o.reseaux) && o.reseaux.B ? String(o.reseaux.B) : d.reseaux.B },
    options: {},
    composants: Array.isArray(o.composants) ? o.composants : []
  };
  Object.keys(d.options).forEach(function (k) { st.options[k] = isObj(o.options) && typeof o.options[k] === "boolean" ? o.options[k] : d.options[k]; });
  return rebuild(st);
}

/* Nouvelle station pour un évaporateur. Ne modifie pas le projet. */
export function createStation(project, evapId, makeId, type) {
  var s = normalizeStation({ evapId: evapId || null }, nextCode(project && project.stations), type);
  s.id = (makeId || newId)();
  return s;
}

/* Ajoute une station au projet et la retourne. */
export function addStation(project, evapId, makeId, type) {
  if (!Array.isArray(project.stations)) project.stations = [];
  var s = createStation(project, evapId, makeId, type);
  project.stations.push(s);
  return s;
}

export function setStation(station, patch) {
  // Changement de type : nouvelle composition (réglages manuels abandonnés), options et réseaux par défaut du type
  if (patch.type && TYPES_SDV[patch.type] && patch.type !== station.type) {
    var oldT = typeOf(station), newT = TYPES_SDV[patch.type];
    ["A", "B"].forEach(function (k) {
      var cur = station.reseaux[k];
      if (!cur || cur === oldT.reseaux[k] || RESEAUX_ANCIENS.indexOf(cur) >= 0) station.reseaux[k] = newT.reseaux[k] || (k === "B" ? "Réseau chaud" : cur);
    });
    station.type = patch.type; station.options = Object.assign({}, newT.options); station.composants = [];
  }
  // Les repères automatiques suivent le code de la station (recalculés par rebuild)
  if (patch.code != null && String(patch.code).trim()) station.code = String(patch.code).trim();
  if (patch.dn != null) station.dn = nearestDN(patch.dn, station.dn);
  if (patch.antenne != null) station.antenne = Math.max(0, num(patch.antenne, station.antenne));
  if (patch.derivation != null) station.derivation = Math.max(0, num(patch.derivation, station.derivation));
  if (patch.orientation && ORIENTATIONS[patch.orientation]) station.orientation = patch.orientation;
  if (patch.evapId !== undefined) station.evapId = patch.evapId || null;
  if (isObj(patch.isolation)) {
    if (typeof patch.isolation.on === "boolean") station.isolation.on = patch.isolation.on;
    if (patch.isolation.ep != null) station.isolation.ep = Math.max(0, num(patch.isolation.ep, station.isolation.ep));
  }
  if (isObj(patch.reseaux)) ["A", "B"].forEach(function (k) { if (patch.reseaux[k]) station.reseaux[k] = String(patch.reseaux[k]); });
  if (isObj(patch.options)) Object.keys(station.options).forEach(function (k) { if (typeof patch.options[k] === "boolean") station.options[k] = patch.options[k]; });
  return rebuild(station);
}

/* Modifie un composant (dn, rep, act) ; null remet la valeur automatique. */
export function setComponent(station, key, patch) {
  var c = station.composants.filter(function (x) { return x.key === key; })[0];
  if (!c) return station;
  var custom = Object.assign({ dn: false, rep: false, act: false }, c.custom);
  if (patch.dn !== undefined) { custom.dn = patch.dn !== null && DN_LIST.indexOf(nearestDN(patch.dn, NaN)) >= 0; if (custom.dn) c.dn = nearestDN(patch.dn, c.dn); }
  if (patch.rep !== undefined) { custom.rep = patch.rep !== null && String(patch.rep).trim() !== ""; if (custom.rep) c.rep = String(patch.rep).trim(); }
  if (patch.act !== undefined) { custom.act = patch.act !== null && !!ACTIONNEURS[patch.act] && !!TYPES[c.type].act; if (custom.act) c.act = patch.act; }
  c.custom = custom;
  return rebuild(station);
}

/* Station sans évaporateur (évaporateur supprimé dans Brassage) */
export function isOrphan(project, station) {
  return !station.evapId || !listEvaporators(project).some(function (e) { return e.id === station.evapId; });
}

/* Met un projet (ancien ou importé) au format courant, sans toucher au reste de ses données. */
export function migrateProject(project, makeId) {
  if (!isObj(project)) return project;
  ensureEvapIds(project, makeId);
  var list = Array.isArray(project.stations) ? project.stations.filter(isObj) : [], ids = {};
  project.stations = [];
  list.forEach(function (s) {
    var st = normalizeStation(s, nextCode(project.stations));
    if (!st.id || ids[st.id]) st.id = (makeId || newId)();
    ids[st.id] = 1;
    project.stations.push(st);
  });
  return project;
}

/* ---------- Nomenclature ---------- */

export function designation(c) {
  var t = TYPES[c.type]; if (!t) return c.type;
  if (c.act === "TOR") return t.des + " motorisée TOR";
  if (c.act === "modulant") return t.des + " motorisée modulante";
  return t.des;
}

function round2(x) { return Math.round(x * 100) / 100; }

/* Lignes chiffrables d'une station : un composant par ligne, puis tuyauterie, raccords et calorifuge.
   Métrés tirés de l'implantation (layout.js), la même que celle du schéma 2D et du modèle 3D. */
export function stationRows(station) {
  var rows = station.composants.map(function (c) {
    return { rep: c.rep, des: designation(c), dn: c.dn, qte: 1, unite: "u", act: ACTIONNEURS[c.act] || "", role: c.role, key: c.key };
  });
  var g = layout(station), ml = round2(g.tube);
  rows.push({ rep: "", des: "Tube acier", dn: station.dn, qte: ml, unite: "ml", act: "", role: "Antennes, dérivations et by-pass", key: "TUBE" });
  if (g.coudes.length) rows.push({ rep: "", des: "Coude 90°", dn: station.dn, qte: g.coudes.length, unite: "u", act: "", role: "Changements de direction", key: "COUDE" });
  if (g.tes.length) rows.push({ rep: "", des: "Té égal", dn: station.dn, qte: g.tes.length, unite: "u", act: "", role: "Piquages des dérivations et by-pass", key: "TE" });
  if (station.isolation.on) rows.push({ rep: "", des: "Calorifuge élastomère ép. " + station.isolation.ep + " mm", dn: station.dn, qte: ml, unite: "ml", act: "", role: "Isolation de la tuyauterie", key: "CALO" });
  return rows;
}

/* Nomenclature du projet : lignes identiques (désignation, DN, unité) regroupées, repères listés. */
export function projectRows(project) {
  var map = {}, order = [];
  (project.stations || []).forEach(function (s) {
    stationRows(s).forEach(function (r) {
      var k = r.des + "|" + r.dn + "|" + r.unite;
      if (!map[k]) { map[k] = { des: r.des, dn: r.dn, qte: 0, unite: r.unite, reps: [] }; order.push(k); }
      map[k].qte = round2(map[k].qte + r.qte);
      if (r.rep) map[k].reps.push(r.rep);
    });
  });
  return order.map(function (k) { var r = map[k]; return { des: r.des, dn: r.dn, qte: r.qte, unite: r.unite, rep: r.reps.join(", ") }; });
}

/* ---------- Export ---------- */

function frNum(v) { return typeof v === "number" ? String(v).replace(".", ",") : v == null ? "" : String(v); }

export const STATION_COLS = [["rep", "Repère"], ["des", "Désignation"], ["dn", "DN"], ["act", "Actionneur"], ["qte", "Quantité"], ["unite", "Unité"], ["role", "Fonction"]];
export const PROJECT_COLS = [["des", "Désignation"], ["dn", "DN"], ["qte", "Quantité"], ["unite", "Unité"], ["rep", "Repères"]];

/* CSV pour Excel en français : séparateur « ; », virgule décimale, BOM UTF-8, fins de ligne CRLF. */
export function toCSV(rows, cols) {
  function cell(v) { var s = frNum(v); return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  var lines = [cols.map(function (c) { return cell(c[1]); }).join(";")];
  rows.forEach(function (r) { lines.push(cols.map(function (c) { return cell(c[0] === "dn" ? "DN " + r.dn : r[c[0]]); }).join(";")); });
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/* Texte à coller dans un tableur (tabulations). */
export function toTSV(rows, cols) {
  function cell(v) { return frNum(v).replace(/[\t\r\n]+/g, " "); }
  return [cols.map(function (c) { return c[1]; }).join("\t")].concat(rows.map(function (r) {
    return cols.map(function (c) { return cell(c[0] === "dn" ? "DN " + r.dn : r[c[0]]); }).join("\t");
  })).join("\n");
}
