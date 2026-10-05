/* Stations de vannes : modèle de données, migration et nomenclature.
   Module pur (aucun accès au DOM ni au stockage) : il est testé avec `node --test`
   et intégré à frigobilan.html par `npm run build` sous le nom global FBStations.

   Une station équipe un évaporateur (repéré par son identifiant stable `evapId`).
   Elle est enregistrée dans le projet : project.stations = [station, …]. */

export const VERSION = 1;
export const DN_LIST = [15, 20, 25, 32, 40, 50, 65, 80, 100];
export const ORIENTATIONS = { droite: "Départs à droite", gauche: "Départs à gauche" };
export const ACTIONNEURS = { manuel: "Manuel", TOR: "Motorisé TOR", modulant: "Motorisé modulant" };

/* Types de composants. `des` : désignation de base, l'actionneur est ajouté s'il est motorisé. */
export const TYPES = {
  iso:     { des: "Vanne à bille d'isolement", prefix: "V", act: "manuel" },
  purge:   { des: "Vanne de purge / vidange", prefix: "P", act: "manuel" },
  filtre:  { des: "Filtre à tamis", prefix: "F", act: null },
  v3v_tor: { des: "Vanne 3 voies à bille", prefix: "V", act: "TOR" },
  v2v_tor: { des: "Vanne 2 voies à bille", prefix: "V", act: "TOR" },
  v2v_mod: { des: "Vanne 2 voies de régulation à siège, à brides", prefix: "V", act: "modulant" },
  ta:      { des: "Robinet d'équilibrage (type TA)", prefix: "R", act: "manuel" }
};

/* Modèles de station. Ordre = du raccordement batterie vers les réseaux, ligne par ligne :
   c'est aussi l'ordre de lecture du schéma de principe et du modèle 3D.
   - ligne « sortie » : sortie de la batterie, puis deux départs vers les retours des réseaux A et B ;
   - ligne « entree » : arrivée des réseaux A et B par la vanne 3 voies, puis entrée de la batterie.
   `opt` : le composant n'existe que si l'option est cochée. `dn` : DN imposé (purges). */
export const MODELES = {
  "glycol-tor": {
    nom: "Eau glycolée · TOR",
    slots: [
      { key: "S-ISO",  type: "iso",     ligne: "sortie", branche: "commun", role: "Isolement sortie batterie" },
      { key: "S-PUR",  type: "purge",   ligne: "sortie", branche: "commun", role: "Purge en point haut", dn: 15 },
      { key: "A-V2M",  type: "v2v_mod", ligne: "sortie", branche: "A",      role: "Régulation du retour réseau A" },
      { key: "A-ISO",  type: "iso",     ligne: "sortie", branche: "A",      role: "Isolement retour réseau A", opt: "isolDeparts" },
      { key: "B-FIL",  type: "filtre",  ligne: "sortie", branche: "B",      role: "Filtre avant la vanne TOR", opt: "filtreTor" },
      { key: "B-V2T",  type: "v2v_tor", ligne: "sortie", branche: "B",      role: "Ouverture / fermeture du retour réseau B" },
      { key: "B-TA",   type: "ta",      ligne: "sortie", branche: "B",      role: "Équilibrage du réseau B" },
      { key: "E-ISO",  type: "iso",     ligne: "entree", branche: "commun", role: "Isolement entrée batterie" },
      { key: "E-PUR",  type: "purge",   ligne: "entree", branche: "commun", role: "Purge en point haut", dn: 15 },
      { key: "E-FIL",  type: "filtre",  ligne: "entree", branche: "commun", role: "Filtre entrée batterie" },
      { key: "E-VID",  type: "purge",   ligne: "entree", branche: "commun", role: "Vidange", dn: 15, opt: "vidange" },
      { key: "E-V3V",  type: "v3v_tor", ligne: "entree", branche: "commun", role: "Sélection réseau A / réseau B" },
      { key: "A-ISOE", type: "iso",     ligne: "entree", branche: "A",      role: "Isolement départ réseau A", opt: "isolDeparts" },
      { key: "B-ISOE", type: "iso",     ligne: "entree", branche: "B",      role: "Isolement départ réseau B", opt: "isolDeparts" }
    ],
    // Composition lue sur le schéma de principe de référence
    options: { isolDeparts: true, filtreTor: false, vidange: true }
  }
};

export const OPTIONS = {
  isolDeparts: "Vannes d'isolement sur les départs réseaux",
  filtreTor: "Filtre à tamis avant la vanne 2 voies TOR",
  vidange: "Vanne de vidange après le filtre"
};

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

function defaults(code) {
  var m = MODELES["glycol-tor"];
  return {
    v: VERSION, id: "", code: code || "ST1", evapId: null, type: "glycol-tor",
    dn: 32, antenne: 1, derivation: 0.5, orientation: "droite",
    isolation: { on: true, ep: 19 },
    reseaux: { A: "Réseau A (régulé)", B: "Réseau B (TOR)" },
    options: Object.assign({}, m.options),
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
  var m = MODELES[station.type] || MODELES["glycol-tor"], prev = {}, count = {};
  (station.composants || []).forEach(function (c) { if (isObj(c) && c.key) prev[c.key] = c; });
  station.composants = m.slots.filter(function (s) { return !s.opt || station.options[s.opt]; }).map(function (s) {
    var t = TYPES[s.type], p = prev[s.key] || {}, custom = isObj(p.custom) ? p.custom : {};
    count[t.prefix] = (count[t.prefix] || 0) + 1;
    var c = {
      key: s.key, type: s.type, ligne: s.ligne, branche: s.branche, role: s.role,
      dn: custom.dn && DN_LIST.indexOf(p.dn) >= 0 ? p.dn : (s.dn || station.dn),
      rep: custom.rep && p.rep ? String(p.rep) : station.code + "-" + t.prefix + count[t.prefix],
      act: custom.act && ACTIONNEURS[p.act] ? p.act : t.act
    };
    if (custom.dn || custom.rep || custom.act) c.custom = { dn: !!custom.dn, rep: !!custom.rep, act: !!custom.act };
    return c;
  });
  return station;
}

/* Complète et corrige une station venant du stockage ou d'un import. */
export function normalizeStation(s, code) {
  var d = defaults(code), o = isObj(s) ? s : {};
  var st = {
    v: VERSION,
    id: o.id ? String(o.id) : "",
    code: o.code ? String(o.code) : d.code,
    evapId: o.evapId ? String(o.evapId) : null,
    type: MODELES[o.type] ? o.type : d.type,
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
export function createStation(project, evapId, makeId) {
  var s = normalizeStation({ evapId: evapId || null }, nextCode(project && project.stations));
  s.id = (makeId || newId)();
  return s;
}

/* Ajoute une station au projet et la retourne. */
export function addStation(project, evapId, makeId) {
  if (!Array.isArray(project.stations)) project.stations = [];
  var s = createStation(project, evapId, makeId);
  project.stations.push(s);
  return s;
}

export function setStation(station, patch) {
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
  if (patch.act !== undefined) { custom.act = patch.act !== null && !!ACTIONNEURS[patch.act]; if (custom.act) c.act = patch.act; }
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

/* Lignes chiffrables d'une station : un composant par ligne, puis tuyauterie et calorifuge.
   Tuyauterie estimée : 2 antennes (entrée et sortie batterie) + 2 dérivations (départs du réseau B), 2 coudes 90°. */
export function stationRows(station) {
  var rows = station.composants.map(function (c) {
    return { rep: c.rep, des: designation(c), dn: c.dn, qte: 1, unite: "u", act: ACTIONNEURS[c.act] || "", role: c.role, key: c.key };
  });
  var ml = round2(2 * station.antenne + 2 * station.derivation);
  if (ml > 0) rows.push({ rep: "", des: "Tube acier", dn: station.dn, qte: ml, unite: "ml", act: "", role: "Antennes et dérivations", key: "TUBE" });
  rows.push({ rep: "", des: "Coude 90°", dn: station.dn, qte: 2, unite: "u", act: "", role: "Dérivations du réseau B", key: "COUDE" });
  if (station.isolation.on && ml > 0) rows.push({ rep: "", des: "Calorifuge élastomère ép. " + station.isolation.ep + " mm", dn: station.dn, qte: ml, unite: "ml", act: "", role: "Isolation de la tuyauterie", key: "CALO" });
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
