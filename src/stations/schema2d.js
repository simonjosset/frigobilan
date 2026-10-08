/* Schéma de principe 2D d'une station de vannes, en SVG (texte). Module pur.
   Même implantation que le 3D (layout.js), pour tous les types de stations (types.js).
   Symboles dans le style des schémas de principe : vannes à bille (papillon + bille + levier),
   vannes de régulation (servomoteur TOR « M » ou modulant, signal de commande), vannes 3 voies,
   vanne d'équilibrage, robinet à soupape, clapet, filtre à tamis, circulateur, sonde,
   échangeur à plaques, thermoplongeur, purges et vidanges sur piquage, batterie.
   Chaque composant est un groupe <g class="c" data-key data-rep> pour la surbrillance. */
import { layout } from "./layout.js";
import { designation } from "./model.js";

/* Couleurs par défaut : impression et PNG sur fond blanc */
export const PALETTE_CLAIRE = { bg: "#FFFFFF", ink: "#1B2340", muted: "#5B6788", calo: "#DCE3F2", accent: "#B026E0", A: "#0A7FB8", B: "#B0287A", C: "#C2410C", lim: "#C62828" };
export const PALETTE_SOMBRE = { bg: "#0B1739", ink: "#E6EAF7", muted: "#AEB9E1", calo: "#22305E", accent: "#CB3CFF", A: "#00C2FF", B: "#FF6BB5", C: "#FF8A4C", lim: "#FF5A65" };

const P = 66;            // pas d'une colonne (px)
const X0 = 128;          // bord droit de la batterie (px)
const TOP = 104;         // ordonnée de la ligne la plus haute (px)
const S = 11, V = 8;     // demi-longueur et demi-hauteur d'un corps de vanne (px)

function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function n(v) { return Math.round(v * 10) / 10; }

/* Repère affiché sans le code de station (déjà dans le titre) */
export function shortRep(station, rep) { var p = station.code + "-"; return rep.indexOf(p) === 0 ? rep.slice(p.length) : rep; }

/* Ordonnées des lignes à l'écran : de haut en bas, écart proportionnel avec un minimum lisible */
function levelPx(g) {
  var lv = g.levels.slice().sort(function (a, b) { return b.y - a.y; }), py = {}, y = TOP;
  lv.forEach(function (l, i) { if (i) y += Math.max(84, (lv[i - 1].y - l.y) * 200); py[l.id] = y; });
  return { py: py, bottom: y };
}

export function schemaSVG(station, opts) {
  opts = opts || {};
  var pal = Object.assign({}, PALETTE_CLAIRE, opts.palette || {});
  var g = layout(station), T = g.type, flip = station.orientation === "gauche";
  var lp = levelPx(g), PY = lp.py, H = lp.bottom + 86;
  // Largeur : place pour le plus long nom de réseau en bout de ligne
  var longest = g.runs.reduce(function (m, r) { return r.label ? Math.max(m, r.label.replace("{A}", station.reseaux.A).replace("{B}", station.reseaux.B).length) : m; }, 10);
  var xEnd = X0 + (g.endCol + 0.35) * P, W = xEnd + 24 + Math.ceil(longest * 7.4);
  function X(x) { return flip ? W - x : x; }               // miroir quand les départs sont à gauche
  function cx(col) { return X0 + col * P; }
  function pxOfX(x) { return Math.abs(x - g.L) < 1e-6 ? xEnd : X0 + x / g.pitch * P; }
  function pyOfY(y) { var l = g.levels.filter(function (q) { return Math.abs(q.y - y) < 1e-6; })[0]; return l ? PY[l.id] : TOP; }
  var dir = flip ? -1 : 1, anchorEnd = flip ? "end" : "start", anchorStart = flip ? "start" : "end";
  var out = [], comps = [];

  /* ---------- Symboles : autour de (x, y), conduite horizontale, f = sens à l'écran (±1) ---------- */
  function body(x, y) { return '<path class="sym fill" d="M' + n(x - S) + "," + n(y - V) + "L" + n(x) + "," + n(y) + "L" + n(x - S) + "," + n(y + V) + "Z M" + n(x + S) + "," + n(y - V) + "L" + n(x) + "," + n(y) + "L" + n(x + S) + "," + n(y + V) + 'Z"/>'; }
  function ball(x, y) { return '<circle class="sym fill" cx="' + n(x) + '" cy="' + n(y) + '" r="3.4"/>'; }
  function lever(x, y) { return '<path class="sym" d="M' + n(x) + "," + n(y - 3.4) + "V" + n(y - V - 6) + "H" + n(x + 9 * dir) + "v4" + '" fill="none"/>'; }
  function signal(x, top) { return '<path class="sig" d="M' + n(x + 12 * dir) + "," + n(top + 3) + "h" + n(9 * dir) + "v6" + '"/>'; }
  function port(x, y, down) { var k = down ? 1 : -1; return '<path class="sym fill" d="M' + n(x - V) + "," + n(y + k * S) + "L" + n(x) + "," + n(y) + "L" + n(x + V) + "," + n(y + k * S) + 'Z"/>'; }
  /* Servomoteur : TOR = boîte « M », modulant = vérin arrondi ; libellé à gauche, signal de commande à droite */
  function actuator(x, y, act, label) {
    if (act === "modulant") {
      var t2 = y - V - 30;
      return '<path class="sym" d="M' + n(x) + "," + n(y - 4) + "V" + n(t2 + 20) + '"/><rect class="sym fill" x="' + n(x - 7) + '" y="' + n(t2) + '" width="14" height="20" rx="2"/>' +
        signal(x - 2 * dir, t2) + '<text class="note" x="' + n(x - 11 * dir) + '" y="' + n(t2 + 11) + '" text-anchor="' + anchorStart + '">' + (label || "MOD") + "</text>";
    }
    var top = y - V - 26;
    return '<path class="sym" d="M' + n(x) + "," + n(y - 3.4) + "V" + n(top + 16) + '"/>' +
      '<rect class="sym fill" x="' + n(x - 9) + '" y="' + n(top) + '" width="18" height="16"/>' +
      '<text class="sym-t" x="' + n(x) + '" y="' + n(top + 12) + '" text-anchor="middle">M</text>' + signal(x, top) +
      '<text class="note" x="' + n(x - 13 * dir) + '" y="' + n(top + 11) + '" text-anchor="' + anchorStart + '">' + (label || "TOR") + "</text>";
  }
  function flanges(x, y) { return '<path class="sym" d="M' + n(x - S - 3) + "," + n(y - V - 2) + "V" + n(y + V + 2) + "M" + n(x + S + 3) + "," + n(y - V - 2) + "V" + n(y + V + 2) + '"/>'; }
  var SYM = {
    iso: function (x, y) { return body(x, y) + ball(x, y) + lever(x, y); },
    v2v_tor: function (x, y, it) { return body(x, y) + ball(x, y) + actuator(x, y, it.act); },
    v2v_mod: function (x, y, it) { return flanges(x, y) + body(x, y) + '<rect class="sym fill" x="' + n(x - 3.5) + '" y="' + n(y - 7) + '" width="7" height="7"/>' + actuator(x, y, it.act); },
    v2v_reg: function (x, y, it) { return it.act === "modulant" ? flanges(x, y) + body(x, y) + actuator(x, y, "modulant") : body(x, y) + ball(x, y) + actuator(x, y, it.act); },
    v3v_tor: function (x, y, it) { return body(x, y) + port(x, y, it.port !== "up") + ball(x, y) + actuator(x, y, it.act); },
    v3v_reg: function (x, y, it) { return body(x, y) + port(x, y, it.port !== "up") + ball(x, y) + actuator(x, y, it.act); },
    ta: function (x, y) {
      var x1 = x - 8 * dir, y1 = y + V + 6, x2 = x + 9 * dir, y2 = y - V - 9;
      return body(x, y) + '<path class="sym" d="M' + n(x1) + "," + n(y1) + "L" + n(x2) + "," + n(y2) + '"/>' +
        '<path class="sym solid" d="M' + n(x2) + "," + n(y2) + "l" + n(-6 * dir) + ",2 l" + n(3 * dir) + ',4 Z"/>';
    },
    soupape: function (x, y) { return body(x, y) + '<circle class="solid" cx="' + n(x) + '" cy="' + n(y) + '" r="2.6"/><path class="sym" d="M' + n(x) + "," + n(y) + "V" + n(y - V - 7) + "M" + n(x - 6) + "," + n(y - V - 7) + "H" + n(x + 6) + '"/>'; },
    clapet: function (x, y, it, f) { return '<path class="sym fill" d="M' + n(x - 9 * f) + "," + n(y - 7) + "L" + n(x + 6 * f) + "," + n(y) + "L" + n(x - 9 * f) + "," + n(y + 7) + 'Z"/><path class="sym" d="M' + n(x + 7 * f) + "," + n(y - 8) + "V" + n(y + 8) + '"/>'; },
    filtre: function (x, y, it, f) {
      return '<path class="sym fill" d="M' + n(x - 13) + "," + n(y - 8) + "H" + n(x + 13) + "V" + n(y + 3) + "L" + n(x + 3 * f) + "," + n(y + 12) +
        "L" + n(x + 1 * f) + "," + n(y + 7) + "H" + n(x - 13) + 'Z"/><path class="sym thin" d="M' + n(x - 9) + "," + n(y - 3) + "H" + n(x + 9) + '"/>';
    },
    pompe: function (x, y, it, f) {
      return '<path class="sym" d="M' + n(x) + "," + n(y - 12) + "V" + n(y - 20) + '"/><circle class="sym fill" cx="' + n(x) + '" cy="' + n(y - 24) + '" r="4.5"/>' +
        '<circle class="sym fill" cx="' + n(x) + '" cy="' + n(y) + '" r="12"/><path class="sym solid" d="M' + n(x - 6 * f) + "," + n(y - 9) + "L" + n(x + 10 * f) + "," + n(y) + "L" + n(x - 6 * f) + "," + n(y + 9) + 'Z"/>';
    },
    sonde: function (x, y) { return '<path class="sym" d="M' + n(x - 2.5) + "," + n(y - 4) + "V" + n(y - 18) + "M" + n(x + 2.5) + "," + n(y - 4) + "V" + n(y - 18) + '"/><circle class="sym fill" cx="' + n(x) + '" cy="' + n(y - 24) + '" r="6"/><text class="sym-t small" x="' + n(x) + '" y="' + n(y - 21) + '" text-anchor="middle">T</text>'; },
    thermo: function (x, y) {
      var z = "M" + n(x - 15) + "," + n(y);
      for (var i = 0; i < 6; i++) z += "L" + n(x - 12.5 + i * 5) + "," + n(y + (i % 2 ? 4 : -4));
      return '<rect class="sym fill" x="' + n(x - 19) + '" y="' + n(y - 8) + '" width="38" height="16" rx="3"/><path class="sym thin" d="' + z + "L" + n(x + 15) + "," + n(y) + '" fill="none"/>' +
        '<path class="sym" d="M' + n(x + 12) + "," + n(y - 8) + "V" + n(y - 16) + '"/><rect class="sym fill" x="' + n(x + 4) + '" y="' + n(y - 30) + '" width="17" height="14"/><text class="sym-t small" x="' + n(x + 12.5) + '" y="' + n(y - 19.5) + '" text-anchor="middle">TH</text>';
    }
  };
  var hwEch = 0.42 * P;
  SYM.echangeur = function (x, y) {
    var t = PY.HR != null ? PY.HR - 12 : y - 40, b = PY.HD != null ? PY.HD + 12 : y + 40, z = "";
    for (var i = 1; i < 6; i++) z += "M" + n(x - hwEch + i * hwEch / 3) + "," + n(t + 6) + "L" + n(x - hwEch + i * hwEch / 3 - 10) + "," + n(b - 6);
    return '<rect class="sym fill" x="' + n(x - hwEch) + '" y="' + n(t) + '" width="' + n(2 * hwEch) + '" height="' + n(b - t) + '" rx="3"/><path class="sym thin" d="' + z + '"/>';
  };

  /* ---------- Tuyauterie : tronçons, verticales, calorifuge, té ---------- */
  var paths = [];
  g.runs.forEach(function (r) { paths.push({ d: "M" + n(X(pxOfX(r.x1))) + "," + PY[r.level] + "H" + n(X(pxOfX(r.x2))), b: r.branche }); });
  g.verts.forEach(function (v) { var x = X(cx(v.col)); paths.push({ d: "M" + n(x) + "," + PY[v.from] + "V" + PY[v.to], b: v.branche }); });
  if (station.isolation.on) paths.forEach(function (p) { out.push('<path class="calo" d="' + p.d + '"/>'); });
  paths.forEach(function (p) { out.push('<path class="pipe" d="' + p.d + '"/>'); });
  g.tes.forEach(function (t) { out.push('<circle class="solid" cx="' + n(X(pxOfX(t.x))) + '" cy="' + pyOfY(t.y) + '" r="3"/>'); });

  /* Flèches de sens de circulation */
  function arrowH(x, y, right) { var d = (right ? 1 : -1) * dir, xx = X(x); return '<path class="flow" d="M' + n(xx + 5 * d) + "," + y + "l" + n(-10 * d) + ",-5v10Z\"/>"; }
  function arrowV(x, y, up) { var k = up ? -1 : 1; return '<path class="flow" d="M' + n(x) + "," + n(y + 5 * k) + "l-5," + n(-10 * k) + "h10Z\"/>"; }
  g.runs.forEach(function (r) {
    var y = PY[r.level], right = r.flow > 0;
    if (r.end) out.push(arrowH(xEnd - (right ? 14 : 26), y, right));
    else if (!r.battery) out.push(arrowH((pxOfX(r.x1) + pxOfX(r.x2)) / 2 + (right ? 6 : -6), y, right));
  });
  g.verts.forEach(function (v) {
    var ts = g.items.filter(function (i) { return i.vert === v.id; }).map(function (i) { return (i.y - v.y1) / (v.y2 - v.y1); });
    var t = [0.5, 0.18, 0.82].filter(function (c) { return ts.every(function (q) { return Math.abs(q - c) > 0.16; }); })[0];
    if (t != null) out.push(arrowV(X(cx(v.col)), PY[v.from] + t * (PY[v.to] - PY[v.from]), v.y2 > v.y1));
  });

  /* ---------- Batterie ---------- */
  var batLv = {}; g.runs.forEach(function (r) { if (r.battery) batLv[r.level] = r.flow; });
  var bys = Object.keys(batLv).map(function (k) { return PY[k]; }), yTop = Math.min.apply(null, bys) - 70, yBot = Math.max.apply(null, bys) + 70;
  var bx = flip ? X(X0) : 24, bw = X0 - 24;
  out.push('<rect class="sym fill" x="' + n(bx) + '" y="' + yTop + '" width="' + bw + '" height="' + (yBot - yTop) + '"/>');
  out.push('<text class="bat" transform="translate(' + n(bx + bw / 2 - 26 * dir) + "," + ((yTop + yBot) / 2) + ') rotate(-90)" text-anchor="middle">Batterie</text>');
  function batArrow(y, outward) { var d = (outward ? 1 : -1) * dir, c = bx + bw / 2 + 18 * dir; return '<path class="solid" d="M' + n(c - 14 * d) + "," + (y - 2) + "H" + n(c + 6 * d) + "v-3l" + n(10 * d) + ",5 l" + n(-10 * d) + ',5v-3H' + n(c - 14 * d) + 'Z"/>'; }
  Object.keys(batLv).forEach(function (k) { out.push(batArrow(PY[k], batLv[k] > 0)); });

  /* ---------- Limite secondaire / primaire ---------- */
  // Tracée sur les lignes reliées à la batterie (le circuit d'un réseau chaud séparé est tout entier primaire)
  if (g.limite != null) {
    var lx = X(cx(g.limite)), ly1 = TOP - 62, bl = Object.keys(batLv).map(function (k) { return PY[k]; }).sort(function (a, b) { return a - b; });
    var segs = bl.map(function (y, i) { return [i ? y - 44 : ly1 + 14, y + 44]; });
    for (var i = 1; i < segs.length; i++) if (segs[i][0] - segs[i - 1][1] < 90) { segs[i - 1][1] = segs[i][1]; segs.splice(i--, 1); }
    out.push('<path class="lim" d="' + segs.map(function (q) { return "M" + n(lx) + "," + n(q[0]) + "V" + n(q[1]); }).join("") + '"/>',
      '<text class="limt" x="' + n(lx - 6 * dir) + '" y="' + (ly1 + 9) + '" text-anchor="' + anchorStart + '">Secondaire</text>',
      '<text class="limt" x="' + n(lx + 6 * dir) + '" y="' + (ly1 + 9) + '" text-anchor="' + anchorEnd + '">Primaire</text>');
  }

  /* ---------- Composants ---------- */
  g.items.forEach(function (it) {
    var c = station.composants.filter(function (k) { return k.key === it.key; })[0];
    var vt = it.vert ? g.verts.filter(function (v) { return v.id === it.vert; })[0] : null;
    var x = X(cx(it.col)), y = vt ? PY[vt.from] + (it.y - vt.y1) / (vt.y2 - vt.y1) * (PY[vt.to] - PY[vt.from]) : PY[it.level];
    var f = it.vert ? dir : it.dir * dir, sym, lab, lx2 = x, ly, anchor = "middle", hy = y - 6;
    if (it.type === "purge") {
      var up = it.orient !== "down";
      sym = purge(x, y, up); lx2 = x - 12 * dir; ly = up ? y - 30 : y + 40; anchor = anchorStart; hy = y + (up ? -27 : 27);
    } else {
      sym = (SYM[it.type] || SYM.iso)(x, y, it, f);
      if (it.vert) { sym = '<g transform="rotate(' + (it.dir > 0 ? -90 : 90) * dir + " " + n(x) + " " + n(y) + ')">' + sym + "</g>"; lx2 = x + 20 * dir; ly = y + 4; anchor = anchorEnd; hy = y; }
      else if (it.type === "v3v_tor" || it.type === "v3v_reg") { lx2 = x - 14 * dir; ly = it.port === "up" ? y - 34 : y + 30; anchor = anchorStart; } // à gauche de la 3ᵉ voie
      else if (it.type === "sonde") { lx2 = x - 10 * dir; ly = y - 30; anchor = anchorStart; hy = y - 18; }
      else if (it.type === "echangeur") { ly = (PY.HR != null ? PY.HR : y) - 20; hy = y; }
      else if (it.type === "pompe") { ly = y + 28; }
      else ly = y + (it.type === "filtre" ? 28 : 26);
    }
    lab = '<text class="lab" x="' + n(lx2) + '" y="' + n(ly) + '" text-anchor="' + anchor + '">' + esc(shortRep(station, c.rep)) + "</text>";
    comps.push('<g class="c" data-key="' + esc(c.key) + '" data-rep="' + esc(c.rep) + '" tabindex="0"><title>' + esc(c.rep + " · " + designation(c) + " DN " + c.dn) + "</title>" +
      '<circle class="halo" cx="' + n(x) + '" cy="' + n(hy) + '" r="' + (it.type === "echangeur" ? 40 : 24) + '"/>' + sym + lab + "</g>");
  });
  /* Purge ou vidange sur piquage : verticale, vers le haut (point haut) ou vers le bas (vidange) */
  function purge(x, y, up) {
    var k = up ? -1 : 1, y0 = y + k * 4, y1 = y + k * 16, vc = y1 + k * S, y2 = vc + k * S, cap = y2 + k * 4;
    return '<path class="sym thin" d="M' + n(x - 3.5) + "," + n(y0) + "V" + n(y1) + "M" + n(x + 3.5) + "," + n(y0) + "V" + n(y1) + "M" + n(x - 3.5) + "," + n(y1) + "H" + n(x + 3.5) + '"/>' +
      '<path class="sym fill" d="M' + n(x - V) + "," + n(vc - S) + "L" + n(x) + "," + n(vc) + "L" + n(x + V) + "," + n(vc - S) + "Z M" + n(x - V) + "," + n(vc + S) + "L" + n(x) + "," + n(vc) + "L" + n(x + V) + "," + n(vc + S) + 'Z"/>' +
      ball(x, vc) + '<path class="sym" d="M' + n(x + 3.4 * dir) + "," + n(vc) + "H" + n(x + 13 * dir) + "v" + n(-k * 6) + '" fill="none"/>' +
      '<path class="sym" d="M' + n(x) + "," + n(y2) + "V" + n(cap) + "M" + n(x - 6) + "," + n(cap) + "H" + n(x + 6) + '"/>';
  }

  /* ---------- Repères des réseaux ---------- */
  g.runs.forEach(function (r) {
    if (!r.label) return;
    var txt = r.label.replace("{A}", station.reseaux.A).replace("{B}", station.reseaux.B);
    out.push('<text class="net net' + r.branche + '" x="' + n(X(xEnd + 10)) + '" y="' + (PY[r.level] + 4) + '" text-anchor="' + anchorEnd + '">' + esc(txt) + "</text>");
  });

  var title = opts.title || (station.code + " · " + T.nom + " · DN " + station.dn + (station.isolation.on ? " · calorifugée " + station.isolation.ep + " mm" : ""));
  var css = "text{font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}" +
    ".pipe{fill:none;stroke:" + pal.ink + ";stroke-width:2;stroke-linecap:round}.calo{fill:none;stroke:" + pal.calo + ";stroke-width:11;stroke-linecap:round;stroke-linejoin:round}" +
    ".sym{fill:none;stroke:" + pal.ink + ";stroke-width:1.4;stroke-linejoin:round}.sym.fill{fill:" + pal.bg + "}.sym.thin{stroke-width:1}.solid,.sym.solid{fill:" + pal.ink + ";stroke:none}" +
    ".sig{fill:none;stroke:" + pal.ink + ";stroke-width:2.2}.sym-t{fill:" + pal.ink + ";font-size:12px;font-weight:700}.sym-t.small{font-size:8.5px}.flow{fill:" + pal.ink + "}" +
    ".lab{fill:" + pal.ink + ";font-size:11.5px;font-weight:600}.note{fill:" + pal.muted + ";font-size:10.5px}.bat{fill:" + pal.ink + ";font-size:15px;font-weight:600}" +
    ".net{font-size:12px;font-weight:600}.netA{fill:" + pal.A + "}.netB{fill:" + pal.B + "}.netC{fill:" + pal.C + "}.title{fill:" + pal.ink + ";font-size:13px;font-weight:700}" +
    ".lim{stroke:" + pal.lim + ";stroke-width:1.2;stroke-dasharray:8 3 2 3;fill:none}.limt{fill:" + pal.lim + ";font-size:10px;font-weight:600}" +
    ".halo{fill:" + pal.accent + ";opacity:0}.c{cursor:pointer;outline:none}.c.hl .halo,.c:focus-visible .halo{opacity:.18}" +
    ".c.hl .sym,.c:focus-visible .sym{stroke:" + pal.accent + ";stroke-width:2}.c.hl .lab{fill:" + pal.accent + "}.c.hl .sym-t{fill:" + pal.accent + "}";
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n(W) + " " + n(H) + '" width="' + n(W) + '" height="' + n(H) + '" role="img" aria-label="' + esc(title) + '">' +
    "<style>" + css + "</style>" +
    '<rect width="100%" height="100%" fill="' + pal.bg + '"/>' +
    '<text class="title" x="16" y="22">' + esc(title) + "</text>" +
    out.join("") + comps.join("") + "</svg>";
}
