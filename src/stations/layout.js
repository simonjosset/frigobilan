/* Implantation d'une station de vannes : où se trouve chaque composant et chaque tube.
   Source unique de la géométrie, partagée par le schéma 2D, le modèle 3D et la nomenclature
   (longueurs de tube, coudes, tés). Module pur, valable pour tous les types (types.js).

   Repère : vue en élévation, x horizontal depuis la batterie (m), y vertical (m, vers le haut).
   `col` : colonne de principe (schéma 2D, colonnes vides supprimées) ; `x`, `y` : position en mètres. */
import { typeOf } from "./types.js";

/* Diamètre extérieur des tubes acier (mm) par DN */
export const DEXT = { 15: 21.3, 20: 26.9, 25: 33.7, 32: 42.4, 40: 48.3, 50: 60.3, 65: 76.1, 80: 88.9, 100: 114.3 };

/* Pas entre deux composants, selon le DN (encombrement d'une vanne et de ses raccords) */
export function pitch(dn) { return Math.round((0.18 + 0.004 * dn) * 1000) / 1000; }

function r3(x) { return Math.round(x * 1000) / 1000; }
function eq(a, b) { return Math.abs(a - b) < 1e-6; }

export function layout(station) {
  var T = typeOf(station), P = pitch(station.dn), rise = Math.max(0.2, station.derivation || 0);
  var present = {}; station.composants.forEach(function (c) { present[c.key] = c; });
  var slots = T.slots.filter(function (s) { return present[s.key]; });

  /* Colonnes utilisées (les colonnes vides disparaissent) */
  var used = {};
  function use(c) { if (typeof c === "number" && c >= 1) used[Math.floor(c)] = 1; }
  slots.forEach(function (s) { if (s.level) use(s.col); });
  T.runs.forEach(function (r) { use(r.from); use(r.to); });
  T.verts.forEach(function (v) { use(v.col); });
  if (T.limite) use(T.limite);
  var cols = Object.keys(used).map(Number).sort(function (a, b) { return a - b; }), idx = {};
  cols.forEach(function (c, i) { idx[c] = i + 1; });
  function cpos(c) { return c === 0 ? 0 : idx[Math.floor(c)] + (c - Math.floor(c)); } // colonne compactée
  var endCol = cols.length + 1;
  var required = r3((endCol - 0.5) * P), L = r3(Math.max(station.antenne || 0, required));
  function X(c) { return c === "end" ? L : r3(cpos(c) * P); }

  var Y = {}, ligne = {};
  T.levels.forEach(function (l) { Y[l.id] = r3(l.y + (l.d || 0) * rise); ligne[l.id] = l.ligne; });

  var runs = T.runs.map(function (r) {
    return { id: r.id, level: r.level, y: Y[r.level], x1: X(r.from), x2: X(r.to), c1: r.from === "end" ? endCol : cpos(r.from), c2: r.to === "end" ? endCol : cpos(r.to),
      flow: r.flow, branche: r.branche, label: r.label || null, attach: r.attach || null, battery: r.from === 0, end: r.to === "end" };
  });
  var verts = T.verts.map(function (v) {
    return { id: v.id, col: cpos(v.col), x: X(v.col), y1: Y[v.from], y2: Y[v.to], from: v.from, to: v.to, branche: v.branche };
  });

  /* Composants */
  var items = slots.map(function (s) {
    var c = present[s.key], it = { key: s.key, type: c.type, rep: c.rep, act: c.act, role: c.role, orient: s.orient || "h", port: s.port || null, junction: !!s.junction };
    if (s.vert) {
      var v = verts.filter(function (q) { return q.id === s.vert; })[0];
      it.col = v.col; it.x = v.x; it.y = r3(v.y1 + (s.t || 0.5) * (v.y2 - v.y1)); it.level = null; it.vert = v.id;
      it.orient = "v"; it.dir = v.y2 > v.y1 ? 1 : -1; it.ligne = "by-pass";
    } else {
      it.col = cpos(s.col); it.x = X(s.col); it.y = Y[s.level]; it.level = s.level; it.ligne = ligne[s.level];
      var run = runs.filter(function (r) { return r.level === s.level && it.x >= Math.min(r.x1, r.x2) - 1e-6 && it.x <= Math.max(r.x1, r.x2) + 1e-6; })[0];
      it.dir = run ? run.flow : 1;
    }
    return it;
  });

  /* Raccords : pour chaque nœud, les branches de tube qui en partent (E, W, N, S) */
  var nodes = {};
  function node(x, y) { var k = r3(x) + "," + r3(y); return nodes[k] || (nodes[k] = { x: r3(x), y: r3(y), arms: {} }); }
  runs.forEach(function (r) {
    var a = Math.min(r.x1, r.x2), b = Math.max(r.x1, r.x2);
    if (a > 0) node(a, r.y).arms.E = 1;
    if (!eq(b, L) && !r.attach) node(b, r.y).arms.W = 1;
    if (r.attach) node(a, r.y).attach = r.attach;
  });
  verts.forEach(function (v) {
    var lo = Math.min(v.y1, v.y2), hi = Math.max(v.y1, v.y2);
    node(v.x, lo).arms.N = 1; node(v.x, hi).arms.S = 1;
  });
  // Un tronçon qui traverse un nœud y apporte deux branches
  Object.keys(nodes).forEach(function (k) {
    var nd = nodes[k];
    runs.forEach(function (r) { var a = Math.min(r.x1, r.x2), b = Math.max(r.x1, r.x2); if (eq(r.y, nd.y) && nd.x > a + 1e-6 && nd.x < b - 1e-6) { nd.arms.E = 1; nd.arms.W = 1; } });
  });
  var junctions = {}; items.forEach(function (it) { if (it.junction) junctions[r3(it.x) + "," + r3(it.y)] = it.key; });
  var coudes = [], tes = [], pendants = [], croisements = [];
  Object.keys(nodes).forEach(function (k) {
    var nd = nodes[k], arms = Object.keys(nd.arms), n = arms.length;
    if (junctions[k] || nd.attach) return;                   // vanne 3 voies ou échangeur : pas de raccord
    if (n === 1) pendants.push(nd);
    else if (n === 2 && !(nd.arms.E && nd.arms.W) && !(nd.arms.N && nd.arms.S)) coudes.push(nd);
    else if (n >= 3) tes.push(nd);
  });
  // Contrôle : une verticale ne doit pas couper un tronçon hors d'un nœud
  verts.forEach(function (v) {
    var lo = Math.min(v.y1, v.y2), hi = Math.max(v.y1, v.y2);
    runs.forEach(function (r) { var a = Math.min(r.x1, r.x2), b = Math.max(r.x1, r.x2); if (r.y > lo + 1e-6 && r.y < hi - 1e-6 && v.x > a - 1e-6 && v.x < b + 1e-6) croisements.push({ vert: v.id, run: r.id }); });
  });

  var tube = r3(runs.reduce(function (t, r) { return t + Math.abs(r.x2 - r.x1); }, 0) + verts.reduce(function (t, v) { return t + Math.abs(v.y2 - v.y1); }, 0));
  var lvls = T.levels.map(function (l) { return { id: l.id, y: Y[l.id], ligne: l.ligne }; });
  return {
    type: T, pitch: P, rise: rise, L: L, required: required, allonge: (station.antenne || 0) < required,
    endCol: endCol, y: Y, levels: lvls, runs: runs, verts: verts, items: items,
    limite: T.limite ? cpos(T.limite) + 0.5 : null, xLimite: T.limite ? r3((cpos(T.limite) + 0.5) * P) : null,
    coudes: coudes, tes: tes, pendants: pendants, croisements: croisements, tube: tube
  };
}
