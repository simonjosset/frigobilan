/* Visionneuse 3D d'une station : rendu WebGL à la demande, rotation / zoom / déplacement
   au doigt et à la souris (OrbitControls), vues prédéfinies, sélection d'un composant, export PNG.
   Chargée uniquement à la première ouverture de l'onglet Stations (window.FBStations3D). */
import { Scene, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight, Raycaster, Vector2, Vector3, Color, TOUCH, MOUSE } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildModel } from "./model3d.js";

export { buildModel, COULEURS, LEGENDE, legendFor } from "./model3d.js";

/* Directions de vue (depuis la cible vers la caméra) */
export const VUES = { face: [0, 0, 1], dessus: [0, 1, 0.0001], iso: [0.85, 0.65, 1.15] };

export function supported() {
  try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); }
  catch (e) { return false; }
}

/* opts : { onPick(key|null), onHover(key|null), reducedMotion, accent } */
export function createViewer(container, opts) {
  opts = opts || {};
  var renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = "st3d-canvas";
  renderer.domElement.setAttribute("role", "img");
  container.appendChild(renderer.domElement);

  var scene = new Scene(), camera = new PerspectiveCamera(35, 1, 0.01, 100);
  scene.add(new HemisphereLight(0xffffff, 0x6b7894, 1.6));
  var sun = new DirectionalLight(0xffffff, 1.6); sun.position.set(2, 3, 4); scene.add(sun);
  var fill = new DirectionalLight(0xffffff, 0.5); fill.position.set(-3, -1, -2); scene.add(fill);

  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };
  controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
  controls.screenSpacePanning = true;
  controls.rotateSpeed = 0.6; // plus doux au doigt sur téléphone

  var model = null, accent = new Color(opts.accent || 0xcb3cff), hl = { pick: null, hover: null }, homeDist = 2, tween = null, pending = false;

  function render() { pending = false; renderer.render(scene, camera); }
  function request() { if (!pending) { pending = true; requestAnimationFrame(render); } }
  controls.addEventListener("change", request);

  function resize() {
    var w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%";
    camera.aspect = w / h; camera.updateProjectionMatrix(); request();
  }
  var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(container); else window.addEventListener("resize", resize);

  /* ---------- Surbrillance ---------- */
  function paint(key, on, strength) {
    var grp = model && model.picks[key]; if (!grp) return;
    grp.traverse(function (o) { if (o.material && o.material.emissive) { o.material.emissive.copy(on ? accent : new Color(0)); o.material.emissiveIntensity = on ? strength : 0; } });
  }
  function refreshHL() {
    if (!model) return;
    Object.keys(model.picks).forEach(function (k) { paint(k, false); });
    if (hl.pick) paint(hl.pick, true, 0.75);
    if (hl.hover && hl.hover !== hl.pick) paint(hl.hover, true, 0.4);
    request();
  }

  /* ---------- Caméra ---------- */
  function goTo(name, instant) {
    if (!model) return;
    var d = new Vector3().fromArray(VUES[name] || VUES.iso).normalize();
    if (model.root.scale.x < 0 && name === "iso") d.x = -d.x;
    var size = model.size, fit = Math.max(size.x / camera.aspect, size.y, size.z * 0.6);
    homeDist = fit / (2 * Math.tan(camera.fov * Math.PI / 360)) * 1.25 + size.z / 2;
    var toPos = model.center.clone().add(d.multiplyScalar(homeDist)), toTarget = model.center.clone();
    if (tween) cancelAnimationFrame(tween.id);
    if (instant || opts.reducedMotion) { camera.position.copy(toPos); controls.target.copy(toTarget); controls.update(); request(); return; }
    var p0 = camera.position.clone(), t0 = controls.target.clone(), start = performance.now(), dur = 450;
    tween = { id: 0 };
    (function step(now) {
      var k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(p0, toPos, e); controls.target.lerpVectors(t0, toTarget, e); controls.update(); render();
      if (k < 1) tween.id = requestAnimationFrame(step); else tween = null;
    })(start);
  }

  /* ---------- Sélection : appui bref (doigt) ou clic, survol à la souris ---------- */
  var ray = new Raycaster(), ptr = new Vector2(), down = null;
  function hit(ev) {
    if (!model) return null;
    var r = renderer.domElement.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    var hits = ray.intersectObjects(Object.keys(model.picks).map(function (k) { return model.picks[k]; }), true);
    for (var i = 0; i < hits.length; i++) { var o = hits[i].object; while (o && !(o.userData && o.userData.key)) o = o.parent; if (o) return o.userData.key; }
    return null;
  }
  var el = renderer.domElement;
  el.addEventListener("pointerdown", function (ev) { down = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
  el.addEventListener("pointerup", function (ev) {
    if (!down) return;
    var moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y), long = performance.now() - down.t; down = null;
    if (moved > 6 || long > 600) return;
    var k = hit(ev); hl.pick = k; refreshHL(); if (opts.onPick) opts.onPick(k);
  });
  var hoverFrame = 0;
  el.addEventListener("pointermove", function (ev) {
    if (ev.pointerType !== "mouse" || ev.buttons) return;
    if (hoverFrame) return;
    hoverFrame = requestAnimationFrame(function () {
      hoverFrame = 0; var k = hit(ev);
      if (k !== hl.hover) { hl.hover = k; el.style.cursor = k ? "pointer" : ""; refreshHL(); if (opts.onHover) opts.onHover(k); }
    });
  });
  el.addEventListener("pointerleave", function () { if (hl.hover) { hl.hover = null; refreshHL(); if (opts.onHover) opts.onHover(null); } });

  return {
    canvas: el,
    setStation: function (station, theme) {
      theme = theme || {};
      if (model) { scene.remove(model.root); model.root.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
      scene.background = new Color(theme.bg || 0x0b1739);
      if (theme.accent) accent = new Color(theme.accent);
      var keep = model && !theme.refit;
      model = buildModel(station, { edge: theme.edge });
      scene.add(model.root);
      el.setAttribute("aria-label", "Modèle 3D de la station " + station.code + " : faites glisser pour tourner, pincez pour zoomer, deux doigts pour déplacer.");
      resize(); refreshHL();
      if (!keep) goTo("iso", true); else request();
    },
    highlight: function (key) { hl.pick = key || null; refreshHL(); },
    view: function (name) { goTo(name, false); },
    reset: function () { goTo("iso", false); },
    resize: resize,
    render: render,
    /* Image PNG du rendu courant (data URL) */
    toPNG: function () { render(); return el.toDataURL("image/png"); },
    /* Position à l'écran (coordonnées client) du centre d'un composant, ou null */
    screenOf: function (key) {
      var grp = model && model.picks[key]; if (!grp) return null;
      var v = grp.getWorldPosition(new Vector3()).project(camera), r = el.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    },
    camera: camera, controls: controls,
    dispose: function () { if (ro) ro.disconnect(); controls.dispose(); renderer.dispose(); el.remove(); model = null; }
  };
}
