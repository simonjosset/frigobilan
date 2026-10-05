/* Schéma de principe 2D d'une station de vannes, en SVG (texte). Module pur.
   Même implantation que le 3D (layout.js) ; symboles dans le style du schéma de référence :
   vannes à bille (papillon + bille + levier), vanne de régulation à brides, vanne 3 voies,
   robinet d'équilibrage, filtre à tamis, purges et vidange sur piquage, batterie.
   Chaque composant est un groupe <g class="c" data-key data-rep> pour la surbrillance. */
import { layout } from "./layout.js";
import { designation } from "./model.js";

/* Couleurs par défaut : impression et PNG sur fond blanc */
export const PALETTE_CLAIRE = { bg: "#FFFFFF", ink: "#1B2340", muted: "#5B6788", calo: "#DCE3F2", accent: "#B026E0", A: "#0A7FB8", B: "#B0287A" };
export const PALETTE_SOMBRE = { bg: "#0B1739", ink: "#E6EAF7", muted: "#AEB9E1", calo: "#22305E", accent: "#CB3CFF", A: "#00C2FF", B: "#FF6BB5" };

const P = 66;            // pas d'une colonne (px)
const X0 = 128;          // bord droit de la batterie (px)
const YL = { SB: 78, S: 158, E: 286, EB: 366 }; // ordonnées des lignes (px)
const H = 420;           // hauteur du dessin (px)
const S = 11, V = 8;     // demi-longueur et demi-hauteur d'un corps de vanne (px)

function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function n(v) { return Math.round(v * 10) / 10; }

/* Repère affiché sans le code de station (déjà dans le titre) */
export function shortRep(station, rep) { var p = station.code + "-"; return rep.indexOf(p) === 0 ? rep.slice(p.length) : rep; }

export function schemaSVG(station, opts) {
  opts = opts || {};
  var pal = Object.assign({}, PALETTE_CLAIRE, opts.palette || {});
  var g = layout(station), flip = station.orientation === "gauche";
  var xEnd = X0 + (g.endSlot + 0.35) * P, W = xEnd + 210;
  function X(x) { return flip ? W - x : x; }               // miroir quand les départs sont à gauche
  function sx(slot) { return X0 + slot * P; }
  var dir = flip ? -1 : 1, anchorEnd = flip ? "end" : "start";
  var out = [], comps = [];

  /* ---------- Symboles (dessinés autour de (cx, cy), conduite horizontale) ---------- */
  function body(cx, cy) { return '<path class="sym fill" d="M' + n(cx - S) + "," + n(cy - V) + "L" + n(cx) + "," + n(cy) + "L" + n(cx - S) + "," + n(cy + V) + "Z M" + n(cx + S) + "," + n(cy - V) + "L" + n(cx) + "," + n(cy) + "L" + n(cx + S) + "," + n(cy + V) + 'Z"/>'; }
  function ball(cx, cy) { return '<circle class="sym fill" cx="' + n(cx) + '" cy="' + n(cy) + '" r="3.4"/>'; }
  function lever(cx, cy) { return '<path class="sym" d="M' + n(cx) + "," + n(cy - 3.4) + "V" + n(cy - V - 6) + "H" + n(cx + 9 * dir) + "v4" + '" fill="none"/>'; }
  function motor(cx, cy, label) {
    var top = cy - V - 26;
    return '<path class="sym" d="M' + n(cx) + "," + n(cy - 3.4) + "V" + n(top + 16) + '"/>' +
      '<rect class="sym fill" x="' + n(cx - 9) + '" y="' + n(top) + '" width="18" height="16"/>' +
      '<text class="sym-t" x="' + n(cx) + '" y="' + n(top + 12) + '" text-anchor="middle">M</text>' +
      (label ? '<text class="note" x="' + n(cx + 14 * dir) + '" y="' + n(top + 11) + '" text-anchor="' + anchorEnd + '">' + label + "</text>" : "");
  }
  var SYM = {
    iso: function (cx, cy) { return body(cx, cy) + ball(cx, cy) + lever(cx, cy); },
    v2v_tor: function (cx, cy) { return body(cx, cy) + ball(cx, cy) + motor(cx, cy, "TOR"); },
    v2v_mod: function (cx, cy) {
      var top = cy - V - 30;
      return '<path class="sym" d="M' + n(cx - S - 3) + "," + n(cy - V - 2) + "V" + n(cy + V + 2) + "M" + n(cx + S + 3) + "," + n(cy - V - 2) + "V" + n(cy + V + 2) + '"/>' +
        body(cx, cy) + '<rect class="sym fill" x="' + n(cx - 3.5) + '" y="' + n(cy - 7) + '" width="7" height="7"/>' +
        '<path class="sym" d="M' + n(cx) + "," + n(cy - 7) + "V" + n(top + 20) + '"/><rect class="sym fill" x="' + n(cx - 7) + '" y="' + n(top) + '" width="14" height="20" rx="2"/>' +
        '<text class="note" x="' + n(cx + 12 * dir) + '" y="' + n(top + 11) + '" text-anchor="' + anchorEnd + '">Modulante</text>';
    },
    ta: function (cx, cy) {
      var x1 = cx - 8 * dir, y1 = cy + V + 6, x2 = cx + 9 * dir, y2 = cy - V - 9;
      return body(cx, cy) + '<path class="sym" d="M' + n(x1) + "," + n(y1) + "L" + n(x2) + "," + n(y2) + '"/>' +
        '<path class="sym solid" d="M' + n(x2) + "," + n(y2) + "l" + n(-6 * dir) + ",2 l" + n(3 * dir) + ',4 Z"/>';
    },
    filtre: function (cx, cy) {
      return '<path class="sym fill" d="M' + n(cx - 13) + "," + n(cy - 8) + "H" + n(cx + 13) + "V" + n(cy + 3) + "L" + n(cx + 3 * dir) + "," + n(cy + 12) +
        "L" + n(cx + 1 * dir) + "," + n(cy + 7) + "H" + n(cx - 13) + 'Z"/><path class="sym thin" d="M' + n(cx - 9) + "," + n(cy - 3) + "H" + n(cx + 9) + '"/>';
    },
    v3v_tor: function (cx, cy) {
      return body(cx, cy) + '<path class="sym fill" d="M' + n(cx - V) + "," + n(cy + S) + "L" + n(cx) + "," + n(cy) + "L" + n(cx + V) + "," + n(cy + S) + 'Z"/>' + ball(cx, cy) + motor(cx, cy, "TOR");
    },
    /* Purge ou vidange sur piquage : verticale, vers le haut (point haut) ou vers le bas (vidange) */
    purge: function (cx, cy, up) {
      var k = up ? -1 : 1, y0 = cy + k * 4, y1 = cy + k * 16, vc = y1 + k * S, y2 = vc + k * S, cap = y2 + k * 4;
      return '<path class="sym thin" d="M' + n(cx - 3.5) + "," + n(y0) + "V" + n(y1) + "M" + n(cx + 3.5) + "," + n(y0) + "V" + n(y1) + "M" + n(cx - 3.5) + "," + n(y1) + "H" + n(cx + 3.5) + '"/>' +
        '<path class="sym fill" d="M' + n(cx - V) + "," + n(vc - S) + "L" + n(cx) + "," + n(vc) + "L" + n(cx + V) + "," + n(vc - S) + "Z M" + n(cx - V) + "," + n(vc + S) + "L" + n(cx) + "," + n(vc) + "L" + n(cx + V) + "," + n(vc + S) + 'Z"/>' +
        ball(cx, vc) + '<path class="sym" d="M' + n(cx + 3.4 * dir) + "," + n(vc) + "H" + n(cx + 13 * dir) + "v" + n(-k * 6) + '" fill="none"/>' +
        '<path class="sym" d="M' + n(cx) + "," + n(y2) + "V" + n(cap) + "M" + n(cx - 6) + "," + n(cap) + "H" + n(cx + 6) + '"/>';
    }
  };

  /* ---------- Tuyauterie ---------- */
  var xt = sx(g.teeSlot), x3 = sx(g.v3Slot), r = 14;
  var paths = [
    "M" + n(X(X0)) + "," + YL.S + "H" + n(X(xEnd)),
    "M" + n(X(xt)) + "," + YL.S + "V" + (YL.SB + r) + "Q" + n(X(xt)) + "," + YL.SB + " " + n(X(xt + r)) + "," + YL.SB + "H" + n(X(xEnd)),
    "M" + n(X(X0)) + "," + YL.E + "H" + n(X(xEnd)),
    "M" + n(X(x3)) + "," + YL.E + "V" + (YL.EB - r) + "Q" + n(X(x3)) + "," + YL.EB + " " + n(X(x3 + r)) + "," + YL.EB + "H" + n(X(xEnd))
  ];
  if (station.isolation.on) paths.forEach(function (d) { out.push('<path class="calo" d="' + d + '"/>'); });
  paths.forEach(function (d) { out.push('<path class="pipe" d="' + d + '"/>'); });
  // Flèches de sens de circulation
  function arrow(x, y, right) { var d = (right ? 1 : -1) * dir, xx = X(x); return '<path class="flow" d="M' + n(xx + 5 * d) + "," + y + "l" + n(-10 * d) + ",-5v10Z\"/>"; }
  out.push(arrow(xEnd - 14, YL.S, true), arrow(xEnd - 14, YL.SB, true), arrow(xEnd - 26, YL.E, false), arrow(xEnd - 26, YL.EB, false));

  /* ---------- Batterie ---------- */
  var bx = flip ? X(X0) : 24, bw = X0 - 24;
  out.push('<rect class="sym fill" x="' + n(bx) + '" y="' + (YL.S - 70) + '" width="' + bw + '" height="' + (YL.E - YL.S + 140) + '"/>');
  out.push('<text class="bat" transform="translate(' + n(bx + bw / 2 - 26 * dir) + "," + ((YL.S + YL.E) / 2) + ') rotate(-90)" text-anchor="middle">Batterie</text>');
  function batArrow(y, outward) { var d = (outward ? 1 : -1) * dir, cx = bx + bw / 2 + 18 * dir; return '<path class="solid" d="M' + n(cx - 14 * d) + "," + (y - 2) + "H" + n(cx + 6 * d) + "v-3l" + n(10 * d) + ",5 l" + n(-10 * d) + ',5v-3H' + n(cx - 14 * d) + 'Z"/>'; }
  out.push(batArrow(YL.S, true), batArrow(YL.E, false));

  /* ---------- Composants ---------- */
  g.items.forEach(function (it) {
    var c = station.composants.filter(function (k) { return k.key === it.key; })[0];
    var cx = X(sx(it.slot)), cy = YL[it.level], up = it.orient === "up";
    var sym = it.type === "purge" ? SYM.purge(cx, cy, up || it.orient !== "down") : SYM[it.type](cx, cy);
    var lab, lx = cx, ly, anchor = "middle";
    if (it.type === "purge") { lx = cx - 12 * dir; ly = up ? cy - 30 : cy + 40; anchor = flip ? "start" : "end"; }
    else if (it.type === "v3v_tor") { lx = cx + 16 * dir; ly = cy + 30; anchor = anchorEnd; } // à côté de la voie qui descend
    else ly = cy + (it.type === "filtre" ? 28 : 26);
    lab = '<text class="lab" x="' + n(lx) + '" y="' + n(ly) + '" text-anchor="' + anchor + '">' + esc(shortRep(station, c.rep)) + "</text>";
    var hx = cx, hy = it.type === "purge" ? cy + (up ? -27 : 27) : cy - 6;
    comps.push('<g class="c" data-key="' + esc(c.key) + '" data-rep="' + esc(c.rep) + '" tabindex="0"><title>' + esc(c.rep + " · " + designation(c) + " DN " + c.dn) + "</title>" +
      '<circle class="halo" cx="' + n(hx) + '" cy="' + n(hy) + '" r="24"/>' + sym + lab + "</g>");
  });
  // Té de la dérivation
  out.push('<circle class="solid" cx="' + n(X(xt)) + '" cy="' + YL.S + '" r="3"/>');

  /* ---------- Repères des réseaux ---------- */
  function endLabel(y, txt, net) { return '<text class="net net' + net + '" x="' + n(X(xEnd + 10)) + '" y="' + (y + 4) + '" text-anchor="' + anchorEnd + '">' + esc(txt) + "</text>"; }
  out.push(endLabel(YL.S, "Retour " + station.reseaux.A, "A"), endLabel(YL.SB, "Retour " + station.reseaux.B, "B"),
    endLabel(YL.E, "Départ " + station.reseaux.A, "A"), endLabel(YL.EB, "Départ " + station.reseaux.B, "B"));

  var title = opts.title || (station.code + " · Station de vannes eau glycolée TOR · DN " + station.dn + (station.isolation.on ? " · calorifugée " + station.isolation.ep + " mm" : ""));
  var css = "text{font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}" +
    ".pipe{fill:none;stroke:" + pal.ink + ";stroke-width:2}.calo{fill:none;stroke:" + pal.calo + ";stroke-width:11;stroke-linejoin:round}" +
    ".sym{fill:none;stroke:" + pal.ink + ";stroke-width:1.4;stroke-linejoin:round}.sym.fill{fill:" + pal.bg + "}.sym.thin{stroke-width:1}.solid,.sym.solid{fill:" + pal.ink + ";stroke:none}" +
    ".sym-t{fill:" + pal.ink + ";font-size:12px;font-weight:700}.flow{fill:" + pal.ink + "}" +
    ".lab{fill:" + pal.ink + ";font-size:11.5px;font-weight:600}.note{fill:" + pal.muted + ";font-size:10.5px}.bat{fill:" + pal.ink + ";font-size:15px;font-weight:600}" +
    ".net{font-size:12px;font-weight:600}.netA{fill:" + pal.A + "}.netB{fill:" + pal.B + "}.title{fill:" + pal.ink + ";font-size:13px;font-weight:700}" +
    ".halo{fill:" + pal.accent + ";opacity:0}.c{cursor:pointer;outline:none}.c.hl .halo,.c:focus-visible .halo{opacity:.18}" +
    ".c.hl .sym,.c:focus-visible .sym{stroke:" + pal.accent + ";stroke-width:2}.c.hl .lab{fill:" + pal.accent + "}.c.hl .sym-t{fill:" + pal.accent + "}";
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n(W) + " " + H + '" width="' + n(W) + '" height="' + H + '" role="img" aria-label="' + esc(title) + '">' +
    "<style>" + css + "</style>" +
    '<rect width="100%" height="100%" fill="' + pal.bg + '"/>' +
    '<text class="title" x="16" y="22">' + esc(title) + "</text>" +
    out.join("") + comps.join("") + "</svg>";
}
