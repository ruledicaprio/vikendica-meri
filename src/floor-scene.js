import * as THREE from 'three';

// ============================================================
//  VIKENDICA MERI — 3D floor picker for "Raspored po etažama"
//  The house sliced into its three floors, pulled apart, on a
//  snowy yard. Tap a floor (or its label) to open its rooms; tap
//  the yard (or "Vani") for the exterior photos.
//
//  It drives the card's own tabs and the Vani button, which stay
//  in the page: they are the fallback without WebGL or on data
//  saver, and they own the panels and the lightbox.
// ============================================================

// The hero's "Vlašić noć" palette (hero-scene.js) and style.css.
const C = {
  beam: 0x7a2f26,
  amber: 0xe5a84d,
  pine: 0x173a22,
  snow: 0xdfe6ef,
  line: 0xf5f0e8,
};

// Prizemlje is a box; above it the roof lines narrow towards an apex, so
// 1. sprat is a trapezoid and 2. sprat a steeper, nearly triangular one that
// stops short of the apex with a small flat top.
const W = 6; // width
const D = 4.2; // depth
const CUTS = [0, 2.4, 4.4, 6.2]; // floor boundaries, ground up
const APEX = 7; // where the roof lines would meet
const GAP = 0.55; // exploded spacing between floors
const half = (y) => (y <= CUTS[1] ? W / 2 : ((W / 2) * (APEX - y)) / (APEX - CUTS[1]));

/** One floor: the house's cross-section between y0 and y1, extruded. */
function slabGeometry(y0, y1) {
  const s = new THREE.Shape();
  s.moveTo(-half(y0), 0);
  s.lineTo(half(y0), 0);
  s.lineTo(half(y1), y1 - y0);
  s.lineTo(-half(y1), y1 - y0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: false });
  g.translate(0, 0, -D / 2);
  return g;
}

/**
 * Mount the picker at the top of the floor card. Throws when WebGL is not
 * available, before touching the page, so the caller can keep the tabs.
 */
export function initFloorScene(card) {
  const floorTabs = [0, 1, 2].map((i) => card.querySelector(`#tab-floor-${i}`));
  const outBtn = card.querySelector('.floors__tab--out');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const stage = document.createElement('div');
  stage.className = 'floors__stage';
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  // Looking right of the house, so its labels have room on the right.
  const target = new THREE.Vector3(1.8, 3.2, 0);
  const view = new THREE.Vector3(0.45, 0.4, 0.8).normalize();

  scene.add(new THREE.HemisphereLight(0xbfd0ff, 0x1a1410, 1.4));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.set(6, 10, 8);
  scene.add(sun);

  const house = new THREE.Group();
  scene.add(house);

  const floors = CUTS.slice(0, 3).map((y0, i) => {
    const y1 = CUTS[i + 1];
    const geo = slabGeometry(y0, y1);
    const mat = new THREE.MeshStandardMaterial({ color: C.beam, roughness: 0.75, emissive: C.amber, emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.floor = i;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: C.line, transparent: true, opacity: 0.35 })
    );
    const g = new THREE.Group();
    g.add(mesh, edges);
    const baseY = y0 + i * GAP;
    g.position.y = baseY;
    house.add(g);
    // The slab's corners, for placing its label just right of it on screen.
    const corners = [];
    for (const [y, hw] of [[0, half(y0)], [y1 - y0, half(y1)]])
      for (const x of [-hw, hw]) for (const z of [-D / 2, D / 2]) corners.push(new THREE.Vector3(x, y, z));
    return { g, mesh, mat, edges, baseY, midY: (y1 - y0) / 2, corners, lift: 0 };
  });

  // The yard: Vani.
  const yardMat = new THREE.MeshStandardMaterial({ color: C.snow, roughness: 0.9, emissive: C.amber, emissiveIntensity: 0 });
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.25, 48), yardMat);
  yard.position.y = -0.4;
  yard.userData.out = true;
  house.add(yard);
  const pineMat = new THREE.MeshStandardMaterial({ color: C.pine, roughness: 0.9 });
  const pines = [[-4.1, -1.4, 1], [3.9, -2.4, 1.2], [-3.3, 2.5, 0.8], [4.2, 1.6, 0.7]].map(([x, z, s]) => {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.6 * s, 1.9 * s, 7), pineMat);
    p.position.set(x, -0.27 + 0.95 * s, z);
    p.userData.out = true;
    house.add(p);
    return p;
  });

  /* ── labels: real buttons, so the picker works from the keyboard too ── */
  let sel = Math.max(0, floorTabs.findIndex((t) => t?.getAttribute('aria-selected') === 'true'));
  let hover = null; // a floor index, 'out', or null

  const pin = (text, cls, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `floor-pin ${cls}`;
    b.append(text);
    b.addEventListener('click', onClick);
    return b;
  };
  const pins = floorTabs.map((tab, i) => pin(tab.textContent.trim(), '', () => choose(i)));
  const outPin = pin(outBtn.textContent.trim(), 'floor-pin--out', () => outBtn.click());
  const icon = outBtn.querySelector('svg');
  if (icon) outPin.prepend(icon.cloneNode(true));
  // Reading order top to bottom, as the house stands.
  stage.append(pins[2], pins[1], pins[0], outPin);

  function choose(i) {
    sel = i;
    floorTabs[i].click(); // the tab script owns the panels
    syncPins();
    kick();
  }
  const syncPins = () => pins.forEach((p, i) => p.setAttribute('aria-pressed', String(i === sel)));
  syncPins();

  const v = new THREE.Vector3();
  function put(el, x, y) {
    const w = stage.clientWidth;
    const left = Math.min(Math.max(6, x), w - el.offsetWidth - 6);
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(y - el.offsetHeight / 2)}px)`;
  }
  function placePins() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    floors.forEach((f, i) => {
      // Beside the floor: right of its rightmost corner on screen, at its middle.
      let right = -1;
      for (const c of f.corners) right = Math.max(right, f.g.localToWorld(v.copy(c)).project(camera).x);
      v.set(0, f.midY, 0);
      f.g.localToWorld(v).project(camera);
      put(pins[i], ((right + 1) / 2) * w + 10, ((1 - v.y) / 2) * h);
    });
    v.set(2.2, -0.3, 4.8); // front of the yard
    house.localToWorld(v).project(camera);
    put(outPin, ((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h);
  }

  /* ── rendering: on screen only; continuous for the sway, else on demand ── */
  let raf = 0;
  let visible = false;
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  function frame(now) {
    raf = 0;
    // Turned towards the viewer, so the floors' trapezoid profiles read.
    house.rotation.y = 0.3 + (reduced ? 0 : Math.sin((now / 1000) * 0.35) * 0.12);
    let moving = false;
    floors.forEach((f, i) => {
      const goal = i === sel ? 1 : 0;
      f.lift += reduced ? goal - f.lift : (goal - f.lift) * 0.14;
      if (Math.abs(goal - f.lift) > 0.002) moving = true;
      f.g.position.set(0, f.baseY + f.lift * 0.2, f.lift * 0.9);
      f.mat.emissiveIntensity = f.lift * 0.5 + (hover === i ? 0.15 : 0);
      f.edges.material.color.setHex(i === sel ? C.amber : C.line);
      f.edges.material.opacity = i === sel ? 0.9 : 0.35;
    });
    yardMat.emissiveIntensity = hover === 'out' ? 0.18 : 0;
    camera.lookAt(target);
    renderer.render(scene, camera);
    placePins();
    if (visible && (!reduced || moving)) kick();
  }

  function fit() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Narrow (phone) frames need the camera further back to keep the yard in.
    camera.position.copy(target).addScaledVector(view, camera.aspect < 1.3 ? 27 : 23);
    camera.updateProjectionMatrix();
    kick();
  }

  /* ── picking on the canvas ── */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const targets = [...floors.map((f) => f.mesh), yard, ...pines];
  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.intersectObjects(targets, false)[0]?.object;
    return !o ? null : o.userData.out ? 'out' : o.userData.floor;
  };
  renderer.domElement.addEventListener('click', (e) => {
    const p = pick(e);
    if (p === 'out') outBtn.click();
    else if (p !== null) choose(p);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const p = pick(e);
    if (p === hover) return;
    hover = p;
    renderer.domElement.style.cursor = p === null ? '' : 'pointer';
    kick();
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    hover = null;
    kick();
  });

  card.prepend(stage);
  card.classList.add('has-3d');
  new ResizeObserver(fit).observe(stage);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) kick();
  }).observe(stage);
  fit();
}
