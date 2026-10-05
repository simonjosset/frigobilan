/* Implantation d'une station de vannes : où se trouve chaque composant.
   Source unique de la géométrie, partagée par le schéma 2D, le modèle 3D et la nomenclature
   (longueurs de tube, coudes, tés). Module pur.

   Repère : vue en élévation, x horizontal depuis la batterie (m), y vertical (m, vers le haut).
   - ligne « sortie » (haute) : sortie batterie → té → départ principal (réseau A) ;
     au té, une dérivation monte puis repart parallèlement (réseau B) ;
   - ligne « entree » (basse) : arrivées des réseaux → vanne 3 voies → batterie ;
     la voie B de la vanne 3 voies descend puis repart parallèlement.
   `slot` : position de principe (colonne) utilisée par le schéma 2D ;
   `x`, `y` : position réelle en mètres utilisée par le 3D et les métrés. */

export const ECART_LIGNES = 0.6;   // m entre la ligne de sortie et la ligne d'entrée

/* Diamètre extérieur des tubes acier (mm) par DN */
export const DEXT = { 15: 21.3, 20: 26.9, 25: 33.7, 32: 42.4, 40: 48.3, 50: 60.3, 65: 76.1, 80: 88.9, 100: 114.3 };

/* Pas entre deux composants, selon le DN (encombrement d'une vanne et de ses raccords) */
export function pitch(dn) { return Math.round((0.18 + 0.004 * dn) * 1000) / 1000; }

function round3(x) { return Math.round(x * 1000) / 1000; }

export function layout(station) {
  var has = {}; station.composants.forEach(function (c) { has[c.key] = c; });
  var P = pitch(station.dn), rise = Math.max(0.2, station.derivation || 0);
  var ySortie = ECART_LIGNES, yEntree = 0, yHaut = ySortie + rise, yBas = yEntree - rise;
  var place = {}; // key → {slot, level}
  function put(key, slot, level, orient) { if (has[key]) place[key] = { slot: slot, level: level, orient: orient || "h" }; }

  // Ligne de sortie : isolement, purge, té de dérivation, puis réseau A tout droit
  put("S-ISO", 1, "S"); put("S-PUR", 2, "S", "up");
  var teeSlot = 3, s = teeSlot + 1;
  // Dérivation (réseau B) en partant du té
  var b = s; if (has["B-FIL"]) put("B-FIL", b++, "SB"); put("B-V2T", b++, "SB"); put("B-TA", b++, "SB");
  // Ligne d'entrée : isolement, purge, filtre, vidange, vanne 3 voies
  var e = 1; put("E-ISO", e++, "E"); put("E-PUR", e++, "E", "up"); put("E-FIL", e++, "E");
  if (has["E-VID"]) put("E-VID", e++, "E", "down");
  var v3Slot = Math.max(e, teeSlot + 1); put("E-V3V", v3Slot, "E");
  // Réseau A : régulation puis isolements alignés en dernière colonne
  put("A-V2M", s, "S");
  var last = Math.max(b, s + 1, v3Slot + 1);
  put("A-ISO", last, "S"); put("A-ISOE", last, "E"); put("B-ISOE", last, "EB");
  var endSlot = last + 1;

  var Y = { S: ySortie, SB: yHaut, E: yEntree, EB: yBas };
  var required = round3((endSlot - 0.5) * P), L = round3(Math.max(station.antenne || 0, required));
  var xTee = round3(teeSlot * P), xV3V = round3(v3Slot * P);
  var items = station.composants.filter(function (c) { return place[c.key]; }).map(function (c) {
    var p = place[c.key];
    return { key: c.key, type: c.type, rep: c.rep, ligne: c.ligne, branche: c.branche, slot: p.slot, level: p.level, orient: p.orient, x: round3(p.slot * P), y: Y[p.level] };
  });
  // Tuyauterie : tronçons droits (dans le sens de circulation), coudes et tés
  var segments = [
    { id: "S", ligne: "sortie", branche: "commun", from: [0, ySortie], to: [L, ySortie] },
    { id: "SB-v", ligne: "sortie", branche: "B", from: [xTee, ySortie], to: [xTee, yHaut] },
    { id: "SB", ligne: "sortie", branche: "B", from: [xTee, yHaut], to: [L, yHaut] },
    { id: "E", ligne: "entree", branche: "commun", from: [L, yEntree], to: [0, yEntree] },
    { id: "EB", ligne: "entree", branche: "B", from: [L, yBas], to: [xV3V, yBas] },
    { id: "EB-v", ligne: "entree", branche: "B", from: [xV3V, yBas], to: [xV3V, yEntree] }
  ];
  var tube = round3(segments.reduce(function (t, g) { return t + Math.abs(g.to[0] - g.from[0]) + Math.abs(g.to[1] - g.from[1]); }, 0));
  return {
    pitch: P, rise: rise, L: L, required: required, allonge: (station.antenne || 0) < required,
    y: Y, endSlot: endSlot, teeSlot: teeSlot, v3Slot: v3Slot, xTee: xTee, xV3V: xV3V,
    items: items, segments: segments,
    coudes: [{ x: xTee, y: yHaut }, { x: xV3V, y: yBas }],
    tes: [{ x: xTee, y: ySortie }],
    tube: tube
  };
}
