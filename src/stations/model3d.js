/* Modèle 3D low-poly d'une station de vannes (Three.js), construit de façon procédurale
   à partir de la même implantation que le schéma 2D (layout.js), pour tous les types de stations.
   Aucune dépendance au DOM : testable avec node. Unités : mètres ; x le long des antennes,
   y vertical, z vers l'observateur. */
import { Group, Mesh, CylinderGeometry, BoxGeometry, SphereGeometry, TorusGeometry, ConeGeometry, EdgesGeometry, LineSegments, LineBasicMaterial, MeshStandardMaterial, Box3, Vector3 } from "three";
import { layout, DEXT } from "./layout.js";

/* Couleurs par fonction (reprises dans la légende de l'application) */
export const COULEURS = {
  tube: 0x9aa6bf, A: 0x18a9e0, B: 0xe0489b, C: 0xf4511e, corps: 0x8d97aa, calo: 0xbfc9df, batterie: 0x5c6b8a,
  isolement: 0xe53935, tor: 0x1e88e5, modulant: 0xfb8c00, equilibrage: 0x8e24aa, filtre: 0x43a047, purge: 0xfdd835,
  pompe: 0x00897b, sonde: 0x90a4ae, soupape: 0x37474f, echangeur: 0xb0bec5, thermo: 0xb71c1c
};
export const LEGENDE = [
  ["isolement", "Isolement (levier)"], ["tor", "Actionneur TOR"], ["modulant", "Actionneur modulant"],
  ["equilibrage", "Équilibrage"], ["soupape", "Robinet à soupape"], ["filtre", "Filtre à tamis"], ["purge", "Purge / vidange"],
  ["pompe", "Circulateur"], ["sonde", "Sonde"], ["echangeur", "Échangeur"], ["thermo", "Thermoplongeur"],
  ["A", "Réseau A"], ["B", "Réseau B / dégivrage"], ["C", "Réseau chaud"]
];
/* Légende utile pour une station : fonctions présentes et réseaux tracés */
var LEG_TYPE = { iso: ["isolement"], purge: ["purge"], filtre: ["filtre"], ta: ["equilibrage"], soupape: ["soupape"], pompe: ["pompe"], sonde: ["sonde"], echangeur: ["echangeur"], thermo: ["thermo"] };
export function legendFor(station) {
  var g = layout(station), keys = {};
  station.composants.forEach(function (c) {
    (LEG_TYPE[c.type] || []).forEach(function (k) { keys[k] = 1; });
    if (c.act === "TOR" && c.type !== "iso" && c.type !== "purge" && c.type !== "ta") keys.tor = 1;
    if (c.act === "modulant") keys.modulant = 1;
  });
  g.runs.concat(g.verts).forEach(function (r) { if (r.branche !== "commun") keys[r.branche] = 1; });
  return LEGENDE.filter(function (l) { return keys[l[0]]; });
}

const SEG = 14; // facettes des cylindres (low-poly)

function mat(color, opts) { return new MeshStandardMaterial(Object.assign({ color: color, roughness: 0.55, metalness: 0.25 }, opts || {})); }
function cyl(r, len, color, opts) { return new Mesh(new CylinderGeometry(r, r, len, SEG), mat(color, opts)); }

/* Tronçon droit de (x1,y1) à (x2,y2) dans le plan z = 0 */
function pipe(x1, y1, x2, y2, r, color, opts) {
  var len = Math.hypot(x2 - x1, y2 - y1); if (len < 1e-4) return null;
  var m = cyl(r, len, color, opts);
  m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0);
  if (Math.abs(y2 - y1) < 1e-6) m.rotation.z = Math.PI / 2; // horizontal ; vertical par défaut
  return m;
}
/* Coude 90° : quart de tore de centre (cx, cy), tourné de `rot` */
function bend(cx, cy, R, r, rot, color, opts) {
  var m = new Mesh(new TorusGeometry(R, r, 10, 8, Math.PI / 2), mat(color, opts));
  m.position.set(cx, cy, 0); m.rotation.z = rot; return m;
}
var ARM = { E: [1, 0], W: [-1, 0], N: [0, 1], S: [0, -1] };
/* Coude au nœud (x, y) entre deux branches perpendiculaires : centre et rotation du quart de tore */
function bendAt(nd, R) {
  var arms = Object.keys(nd.arms).map(function (k) { return ARM[k]; }), a1 = arms[0], a2 = arms[1];
  var cx = nd.x + R * (a1[0] + a2[0]), cy = nd.y + R * (a1[1] + a2[1]);
  var t1 = Math.atan2(-a2[1], -a2[0]), t2 = Math.atan2(-a1[1], -a1[0]);
  var d = ((t2 - t1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return { cx: cx, cy: cy, rot: Math.abs(d - Math.PI / 2) < 1e-6 ? t1 : t2 };
}

/* ---------- Composants (axe de la conduite = x local, centre à l'origine, s = sens ±1) ---------- */
function body(k, g) {
  var b = cyl(k * 1.45, k * 4.6, COULEURS.corps); b.rotation.z = Math.PI / 2; g.add(b);
  g.add(new Mesh(new SphereGeometry(k * 1.9, SEG, 8), mat(COULEURS.corps)));
}
function stem(k, h, g) { var s = cyl(k * 0.35, h, COULEURS.corps); s.position.y = h / 2 + k * 1.2; g.add(s); }
function actuator(k, act, g) {
  if (act === "modulant") {
    stem(k, k * 3, g);
    var a = cyl(k * 1.6, k * 5, COULEURS.modulant, { roughness: 0.7, metalness: 0 }); a.position.y = k * 6.4; g.add(a); return;
  }
  stem(k, k * 2.2, g);
  var b = new Mesh(new BoxGeometry(k * 4.2, k * 3.2, k * 3.4), mat(COULEURS.tor, { roughness: 0.7, metalness: 0 }));
  b.position.y = k * 4.9; g.add(b);
}
function flanges(k, g) { [-1, 1].forEach(function (s) { var f = cyl(k * 2.5, k * 0.6, COULEURS.corps); f.rotation.z = Math.PI / 2; f.position.x = s * k * 2.7; g.add(f); }); }
function port3(k, g, up) { var p = cyl(k * 1.45, k * 2.4, COULEURS.corps); p.position.y = (up ? 1 : -1) * k * 1.6; g.add(p); }
var BUILD = {
  iso: function (k, g) {
    body(k, g); stem(k, k * 1.4, g);
    var l = new Mesh(new BoxGeometry(k * 5.5, k * 0.55, k * 1), mat(COULEURS.isolement, { metalness: 0 }));
    l.position.set(k * 2.2, k * 2.9, 0); g.add(l);
  },
  v2v_tor: function (k, g, s, it) { body(k, g); actuator(k, it.act, g); },
  v3v_tor: function (k, g, s, it) { body(k, g); port3(k, g, it.port === "up"); actuator(k, it.act, g); },
  v3v_reg: function (k, g, s, it) { body(k, g); port3(k, g, it.port === "up"); actuator(k, it.act, g); },
  v2v_mod: function (k, g, s, it) { g.add(new Mesh(new SphereGeometry(k * 2.3, SEG, 10), mat(COULEURS.corps))); flanges(k, g); actuator(k, it.act, g); },
  v2v_reg: function (k, g, s, it) { if (it.act === "modulant") BUILD.v2v_mod(k, g, s, it); else BUILD.v2v_tor(k, g, s, it); },
  ta: function (k, g) {
    body(k, g); stem(k, k * 2.4, g);
    var w = new Mesh(new TorusGeometry(k * 2, k * 0.42, 8, 18), mat(COULEURS.equilibrage, { metalness: 0 }));
    w.rotation.x = Math.PI / 2; w.position.y = k * 3.8; g.add(w);
  },
  soupape: function (k, g) {
    g.add(new Mesh(new SphereGeometry(k * 2, SEG, 10), mat(COULEURS.corps))); flanges(k, g); stem(k, k * 2.6, g);
    var w = new Mesh(new TorusGeometry(k * 1.4, k * 0.35, 8, 14), mat(COULEURS.soupape, { metalness: 0 }));
    w.rotation.x = Math.PI / 2; w.position.y = k * 4; g.add(w);
  },
  clapet: function (k, g, s) {
    var b = cyl(k * 1.7, k * 3.6, COULEURS.corps); b.rotation.z = Math.PI / 2; g.add(b);
    var c = new Mesh(new ConeGeometry(k * 1.75, k * 2.2, SEG), mat(COULEURS.corps)); c.rotation.z = -s * Math.PI / 2; c.position.x = s * k * 2.6; g.add(c);
  },
  filtre: function (k, g, s) {
    var b = cyl(k * 1.7, k * 5.2, COULEURS.corps); b.rotation.z = Math.PI / 2; g.add(b);
    var p = cyl(k * 1.25, k * 4.2, COULEURS.filtre, { metalness: 0.1 });
    p.rotation.z = s * Math.PI / 4; p.position.set(s * k * 1.1, -k * 1.9, 0); g.add(p);
  },
  pompe: function (k, g, s) {
    var v = new Mesh(new SphereGeometry(k * 2.6, SEG, 10), mat(COULEURS.corps)); g.add(v);
    var m = cyl(k * 2.1, k * 4.6, COULEURS.pompe, { roughness: 0.7, metalness: 0.1 }); m.rotation.x = Math.PI / 2; m.position.z = k * 3.6; g.add(m);
    var mano = cyl(k * 0.9, k * 0.5, COULEURS.corps); mano.rotation.x = Math.PI / 2; mano.position.set(0, k * 4.4, 0); g.add(mano);
    stem(k, k * 2.2, g);
  },
  sonde: function (k, g) {
    var t = cyl(k * 0.45, k * 3.4, COULEURS.sonde); t.position.y = k * 2.6; g.add(t);
    var h = cyl(k * 1.1, k * 1.4, COULEURS.sonde); h.position.y = k * 4.8; g.add(h);
  },
  thermo: function (k, g, s, it, P) {
    var len = Math.max(k * 8, P * 0.7), b = cyl(k * 2.3, len, COULEURS.thermo, { roughness: 0.6, metalness: 0.3 }); b.rotation.z = Math.PI / 2; g.add(b);
    var th = new Mesh(new BoxGeometry(k * 3, k * 2.4, k * 2.4), mat(COULEURS.corps)); th.position.set(s * len * 0.32, k * 3.8, 0); g.add(th);
    stem(k, k * 1.4, g); g.children[g.children.length - 1].position.x = s * len * 0.32;
  },
  echangeur: function (k, g, s, it, P, H) {
    var w = 0.84 * P, box = new Mesh(new BoxGeometry(w, H, 0.22), mat(COULEURS.echangeur, { roughness: 0.4, metalness: 0.5 })); g.add(box);
    for (var i = -2; i <= 2; i++) { var pl = new Mesh(new BoxGeometry(0.006, H * 0.92, 0.23), mat(COULEURS.corps)); pl.position.x = i * w / 6; g.add(pl); }
  },
  /* Purge / vidange sur piquage, le long de +y (retournée pour une vidange) */
  purge: function (k, g) {
    var s = cyl(k * 0.55, k * 3.2, COULEURS.corps); s.position.y = k * 1.6; g.add(s);
    var v = cyl(k * 1.1, k * 3, COULEURS.corps); v.position.y = k * 4.4; g.add(v);
    var b = new Mesh(new SphereGeometry(k * 1.4, 10, 8), mat(COULEURS.corps)); b.position.y = k * 4.4; g.add(b);
    var l = new Mesh(new BoxGeometry(k * 3.6, k * 0.5, k * 0.8), mat(COULEURS.purge, { metalness: 0 }));
    l.position.set(k * 1.8, k * 4.4, k * 1.3); g.add(l);
    var c = cyl(k * 1.2, k * 0.6, COULEURS.purge, { metalness: 0 }); c.position.y = k * 6.2; g.add(c);
  }
};

/* Construit la station : { root, picks: {clé → groupe}, bounds } */
export function buildModel(station, opts) {
  opts = opts || {};
  var g = layout(station), root = new Group(), picks = {};
  var D = DEXT[station.dn] / 1000, r = D / 2, P = g.pitch;
  var calo = station.isolation.on ? r + Math.max(0.006, station.isolation.ep / 1000) : 0;
  var pipes = new Group(); pipes.name = "tuyauterie"; root.add(pipes);
  var R = Math.min(0.12, Math.max(1.5 * D, 0.05)), X0 = -0.04;
  var CALO = { transparent: true, opacity: 0.3, depthWrite: false };
  var color = function (b) { return b === "commun" ? COULEURS.tube : COULEURS[b]; };

  /* Tronçons : raccourcis de R aux coudes, prolongés jusqu'à la batterie */
  var bends = {}; g.coudes.forEach(function (nd) { bends[nd.x + "," + nd.y] = nd; });
  function trim(x, y, tx, ty) { var nd = bends[x + "," + y]; if (!nd) return [x, y]; var dx = Math.sign(tx - x), dy = Math.sign(ty - y); return [x + dx * R, y + dy * R]; }
  function add(x1, y1, x2, y2, b) {
    var a = trim(x1, y1, x2, y2), z = trim(x2, y2, x1, y1);
    var m = pipe(a[0], a[1], z[0], z[1], r, color(b)); if (m) pipes.add(m);
    if (calo) { var c = pipe(a[0], a[1], z[0], z[1], calo, COULEURS.calo, CALO); if (c) { c.name = "calorifuge"; c.renderOrder = 2; pipes.add(c); } }
  }
  g.runs.forEach(function (rn) { add(rn.battery ? X0 : rn.x1, rn.y, rn.x2, rn.y, rn.branche); });
  g.verts.forEach(function (v) { add(v.x, v.y1, v.x, v.y2, v.branche); });
  // Coudes : couleur du tube qui y arrive
  function branchAt(nd) { var hit = g.runs.filter(function (rn) { return Math.abs(rn.y - nd.y) < 1e-6 && (Math.abs(rn.x1 - nd.x) < 1e-6 || Math.abs(rn.x2 - nd.x) < 1e-6); })[0]; return hit ? hit.branche : "commun"; }
  g.coudes.forEach(function (nd) {
    var b = bendAt(nd, R); pipes.add(bend(b.cx, b.cy, R, r, b.rot, color(branchAt(nd))));
    if (calo) { var c = bend(b.cx, b.cy, R, calo, b.rot, COULEURS.calo, CALO); c.name = "calorifuge"; c.renderOrder = 2; pipes.add(c); }
  });
  g.tes.forEach(function (nd) { var t = new Mesh(new SphereGeometry(r * 1.25, SEG, 8), mat(COULEURS.tube)); t.position.set(nd.x, nd.y, 0); pipes.add(t); });

  /* Sens de circulation : cônes aux raccordements, au milieu des boucles et des verticales */
  var arrows = new Group(); arrows.name = "fleches"; root.add(arrows);
  function arrow(x, y, ang, b) {
    var s = Math.max(r, calo), a = new Mesh(new ConeGeometry(s * 1.45, s * 3.2, 12), mat(color(b), { metalness: 0, roughness: 0.8 }));
    a.position.set(x, y, 0); a.rotation.z = ang; arrows.add(a);
  }
  g.runs.forEach(function (rn) {
    var ang = -rn.flow * Math.PI / 2;
    if (rn.end) arrow(g.L - 0.06, rn.y, ang, rn.branche);
    if (rn.battery) arrow(0.06, rn.y, ang, rn.branche);
    if (!rn.end && !rn.battery) arrow((rn.x1 + rn.x2) / 2 + 0.25 * P, rn.y, ang, rn.branche);
  });
  g.verts.forEach(function (v) {
    var ts = g.items.filter(function (i) { return i.vert === v.id; }).map(function (i) { return (i.y - v.y1) / (v.y2 - v.y1); });
    var t = [0.5, 0.18, 0.82].filter(function (c) { return ts.every(function (q) { return Math.abs(q - c) > 0.16; }); })[0];
    if (t != null) arrow(v.x, v.y1 + t * (v.y2 - v.y1), v.y2 > v.y1 ? 0 : Math.PI, v.branche);
  });

  /* Batterie : hauteur des lignes qui y sont raccordées */
  var by = g.runs.filter(function (rn) { return rn.battery; }).map(function (rn) { return rn.y; });
  var top = Math.max.apply(null, by) + 0.25, bot = Math.min.apply(null, by) - 0.25;
  var bat = new Mesh(new BoxGeometry(0.34, top - bot, 0.8), mat(COULEURS.batterie, { roughness: 0.9, metalness: 0.1 }));
  bat.position.set(X0 - 0.17, (top + bot) / 2, 0); bat.name = "batterie"; root.add(bat);
  var edges = new LineSegments(new EdgesGeometry(bat.geometry), new LineBasicMaterial({ color: opts.edge || 0xffffff, transparent: true, opacity: 0.35 }));
  edges.position.copy(bat.position); root.add(edges);

  /* Composants : un groupe sélectionnable par composant */
  var hEch = (g.y.HR != null && g.y.HD != null) ? Math.abs(g.y.HR - g.y.HD) + 0.1 : 0.4;
  g.items.forEach(function (it) {
    var c = station.composants.filter(function (x) { return x.key === it.key; })[0];
    // Composants grossis (×1,6) par rapport au tube : modèle de principe, lisible sur téléphone
    var k = Math.max(0.006, (DEXT[c.dn] || DEXT[station.dn]) / 2000) * 1.6, grp = new Group();
    (BUILD[it.type] || BUILD.iso)(k, grp, it.vert ? 1 : it.dir, it, P, hEch);
    if (it.type === "purge" && it.orient === "down") grp.rotation.z = Math.PI;
    if (it.vert) grp.rotation.z = it.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    grp.position.set(it.x, it.y, 0);
    grp.name = c.rep; grp.userData = { key: c.key, rep: c.rep };
    root.add(grp); picks[c.key] = grp;
  });

  if (station.orientation === "gauche") root.scale.x = -1; // départs à gauche : modèle en miroir
  root.updateMatrixWorld(true);
  var bounds = new Box3().setFromObject(root);
  return { root: root, picks: picks, bounds: bounds, center: bounds.getCenter(new Vector3()), size: bounds.getSize(new Vector3()), layout: g };
}
