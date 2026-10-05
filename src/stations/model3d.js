/* Modèle 3D low-poly d'une station de vannes (Three.js), construit de façon procédurale
   à partir de la même implantation que le schéma 2D (layout.js). Aucune dépendance au DOM :
   testable avec node. Unités : mètres ; x le long des antennes, y vertical, z vers l'observateur. */
import { Group, Mesh, CylinderGeometry, BoxGeometry, SphereGeometry, TorusGeometry, ConeGeometry, EdgesGeometry, LineSegments, LineBasicMaterial, MeshStandardMaterial, Box3, Vector3 } from "three";
import { layout, DEXT } from "./layout.js";

/* Couleurs par fonction (reprises dans la légende de l'application) */
export const COULEURS = {
  tube: 0x9aa6bf, A: 0x18a9e0, B: 0xe0489b, corps: 0x8d97aa, calo: 0xbfc9df, batterie: 0x5c6b8a,
  isolement: 0xe53935, tor: 0x1e88e5, modulant: 0xfb8c00, equilibrage: 0x8e24aa, filtre: 0x43a047, purge: 0xfdd835
};
export const LEGENDE = [
  ["isolement", "Isolement (levier)"], ["tor", "Actionneur TOR"], ["modulant", "Actionneur modulant"],
  ["equilibrage", "Équilibrage"], ["filtre", "Filtre à tamis"], ["purge", "Purge / vidange"], ["A", "Réseau A"], ["B", "Réseau B"]
];

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

/* ---------- Composants (axe de la conduite = x local, centre à l'origine) ---------- */
function body(k, g) {
  var b = cyl(k * 1.45, k * 4.6, COULEURS.corps); b.rotation.z = Math.PI / 2; g.add(b);
  g.add(new Mesh(new SphereGeometry(k * 1.9, SEG, 8), mat(COULEURS.corps)));
}
function stem(k, h, g) { var s = cyl(k * 0.35, h, COULEURS.corps); s.position.y = h / 2 + k * 1.2; g.add(s); }
function actuatorBox(k, color, g) {
  stem(k, k * 2.2, g);
  var a = new Mesh(new BoxGeometry(k * 4.2, k * 3.2, k * 3.4), mat(color, { roughness: 0.7, metalness: 0 }));
  a.position.y = k * 4.9; g.add(a);
}
var BUILD = {
  iso: function (k, g) {
    body(k, g); stem(k, k * 1.4, g);
    var l = new Mesh(new BoxGeometry(k * 5.5, k * 0.55, k * 1), mat(COULEURS.isolement, { metalness: 0 }));
    l.position.set(k * 2.2, k * 2.9, 0); g.add(l);
  },
  v2v_tor: function (k, g) { body(k, g); actuatorBox(k, COULEURS.tor, g); },
  v3v_tor: function (k, g) {
    body(k, g);
    var p = cyl(k * 1.45, k * 2.4, COULEURS.corps); p.position.y = -k * 1.6; g.add(p);
    actuatorBox(k, COULEURS.tor, g);
  },
  v2v_mod: function (k, g) {
    g.add(new Mesh(new SphereGeometry(k * 2.3, SEG, 10), mat(COULEURS.corps)));
    [-1, 1].forEach(function (s) { var f = cyl(k * 2.5, k * 0.6, COULEURS.corps); f.rotation.z = Math.PI / 2; f.position.x = s * k * 2.7; g.add(f); });
    stem(k, k * 3, g);
    var a = cyl(k * 1.6, k * 5, COULEURS.modulant, { roughness: 0.7, metalness: 0 }); a.position.y = k * 6.4; g.add(a);
  },
  ta: function (k, g) {
    body(k, g); stem(k, k * 2.4, g);
    var w = new Mesh(new TorusGeometry(k * 2, k * 0.42, 8, 18), mat(COULEURS.equilibrage, { metalness: 0 }));
    w.rotation.x = Math.PI / 2; w.position.y = k * 3.8; g.add(w);
  },
  filtre: function (k, g, sens) {
    var b = cyl(k * 1.7, k * 5.2, COULEURS.corps); b.rotation.z = Math.PI / 2; g.add(b);
    var p = cyl(k * 1.25, k * 4.2, COULEURS.filtre, { metalness: 0.1 });
    p.rotation.z = sens * Math.PI / 4; p.position.set(sens * k * 1.1, -k * 1.9, 0); g.add(p);
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
  var D = DEXT[station.dn] / 1000, r = D / 2;
  var calo = station.isolation.on ? r + Math.max(0.006, station.isolation.ep / 1000) : 0;
  var pipes = new Group(); pipes.name = "tuyauterie"; root.add(pipes);
  var X0 = -0.04, L = g.L, Ys = g.y.S, Yh = g.y.SB, Ye = g.y.E, Yb = g.y.EB, xt = g.xTee, x3 = g.xV3V, R = Math.min(0.12, Math.max(1.5 * D, 0.05));

  /* Tuyauterie colorée par réseau : tronc commun, réseau A, réseau B */
  function run(list, color) {
    list.forEach(function (p) {
      var m = p.bend ? bend(p.bend[0], p.bend[1], R, r, p.bend[2], color) : pipe(p[0], p[1], p[2], p[3], r, color);
      if (m) pipes.add(m);
      if (calo) {
        var c = p.bend ? bend(p.bend[0], p.bend[1], R, calo, p.bend[2], COULEURS.calo, { transparent: true, opacity: 0.3, depthWrite: false })
          : pipe(p[0], p[1], p[2], p[3], calo, COULEURS.calo, { transparent: true, opacity: 0.3, depthWrite: false });
        if (c) { c.name = "calorifuge"; c.renderOrder = 2; pipes.add(c); }
      }
    });
  }
  run([[X0, Ys, xt, Ys], [x3, Ye, X0, Ye]], COULEURS.tube);
  run([[xt, Ys, L, Ys], [L, Ye, x3, Ye]], COULEURS.A);
  run([[xt, Ys, xt, Yh - R], { bend: [xt + R, Yh - R, Math.PI / 2] }, [xt + R, Yh, L, Yh],
       [L, Yb, x3 + R, Yb], { bend: [x3 + R, Yb + R, Math.PI] }, [x3, Yb + R, x3, Ye]], COULEURS.B);
  // Té de dérivation
  var te = new Mesh(new SphereGeometry(r * 1.25, SEG, 8), mat(COULEURS.tube)); te.position.set(xt, Ys, 0); pipes.add(te);

  /* Sens de circulation : cônes aux extrémités et sur le tronc commun */
  var arrows = new Group(); arrows.name = "fleches"; root.add(arrows);
  function arrow(x, y, dir, color) {
    var a = new Mesh(new ConeGeometry(Math.max(r, calo) * 1.45, Math.max(r, calo) * 3.2, 12), mat(color, { metalness: 0, roughness: 0.8 }));
    a.position.set(x, y, 0); a.rotation.z = -dir * Math.PI / 2; arrows.add(a);
  }
  var end = L - 0.06;
  arrow(end, Ys, 1, COULEURS.A); arrow(end, Yh, 1, COULEURS.B); arrow(end, Ye, -1, COULEURS.A); arrow(end, Yb, -1, COULEURS.B);
  arrow(0.06, Ys, 1, COULEURS.tube); arrow(0.06, Ye, -1, COULEURS.tube);

  /* Batterie */
  var bh = (Yh - Yb) + 0.5, bat = new Mesh(new BoxGeometry(0.34, bh, 0.8), mat(COULEURS.batterie, { roughness: 0.9, metalness: 0.1 }));
  bat.position.set(X0 - 0.17, (Yh + Yb) / 2, 0); bat.name = "batterie"; root.add(bat);
  var edges = new LineSegments(new EdgesGeometry(bat.geometry), new LineBasicMaterial({ color: opts.edge || 0xffffff, transparent: true, opacity: 0.35 }));
  edges.position.copy(bat.position); root.add(edges);

  /* Composants : un groupe sélectionnable par composant */
  g.items.forEach(function (it) {
    var c = station.composants.filter(function (x) { return x.key === it.key; })[0];
    // Composants grossis (×1,6) par rapport au tube : modèle de principe, lisible sur téléphone
    var k = Math.max(0.006, (DEXT[c.dn] || DEXT[station.dn]) / 2000) * 1.6, grp = new Group();
    var sens = it.ligne === "sortie" ? 1 : -1; // sens de circulation le long de x
    (BUILD[it.type] || BUILD.iso)(k, grp, sens);
    if (it.type === "purge" && it.orient === "down") grp.rotation.z = Math.PI;
    grp.position.set(it.x, it.y, 0);
    grp.name = c.rep; grp.userData = { key: c.key, rep: c.rep };
    root.add(grp); picks[c.key] = grp;
  });

  if (station.orientation === "gauche") root.scale.x = -1; // départs à gauche : modèle en miroir
  root.updateMatrixWorld(true);
  var bounds = new Box3().setFromObject(root);
  return { root: root, picks: picks, bounds: bounds, center: bounds.getCenter(new Vector3()), size: bounds.getSize(new Vector3()), layout: g };
}
