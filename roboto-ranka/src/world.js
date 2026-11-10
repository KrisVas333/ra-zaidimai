// The park (ground, path, props, trees, bushes, hills, clouds), bins, litter, flowers, the build table,
// the trophy room. Static props are merged (one draw call); repeated props are instanced.
import * as THREE from './three.js';
import { Kit, roundedBox as rb, M, keep, canvasTex, roundRect, rng, clamp } from './util.js';
import { drawIcon, BIN_COLORS } from './icons.js';

const cyl = (r1, r2, h, s = 16) => new THREE.CylinderGeometry(r1, r2, h, s);
const sph = (r, a = 16, b = 12) => new THREE.SphereGeometry(r, a, b);
const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);

export const BOUNDS = { minX: -13, maxX: 13, minZ: -9.4, maxZ: 9.4 };
export const BIN_POS = { paper: [-3.3, -6.7], plastic: [0, -6.7], glass: [3.3, -6.7] };
export const KINDS = ['paper', 'plastic', 'glass'];
export const BIN_HEX = { paper: 0x2f6fed, plastic: 0xffcc1f, glass: 0x22a447 };
export const CAST_SPOTS = { leo: [-6.3, -8.3], maja: [6.3, -8.3], neo: [8.2, -7.6], avatar: [-8.2, -7.6] };
// no trees on the front (camera) edge: they would stand between the camera and the play area
const TREES = [[-11.6, -8.2], [11.6, -8.1], [-12.1, 0.6], [12.0, 1.4], [-12.3, 5.2], [12.4, 5.0], [-11.2, 8.6], [11.4, 8.7], [-6.6, -1.6], [6.9, -1.9], [-4.8, -9.6]];
const GAZEBO = [-9.4, -5.4], SWING = [9.4, -5.0], BENCHES = [[-8.4, 4.6], [8.6, 4.6]];

/* ======================= ground ======================= */
let groundTex = null;
function makeGroundTex() {
  if (groundTex) return groundTex;
  const S = 1024, U = S / 80, X = (x) => (x + 40) * U, Z = (z) => (z + 40) * U;
  groundTex = keep(canvasTex(S, S, (g) => {
    g.fillStyle = '#86cf5e'; g.fillRect(0, 0, S, S);
    const r = rng(7);
    for (let i = 0; i < 900; i++) { // soft grass blotches
      const x = r() * S, y = r() * S, rr = 4 + r() * 18;
      g.fillStyle = r() < 0.5 ? 'rgba(120,200,80,.35)' : 'rgba(150,215,95,.35)';
      g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    }
    // park lawn slightly brighter
    g.fillStyle = 'rgba(160,225,105,.35)'; roundRect(g, X(-14.5), Z(-10.5), 29 * U, 21 * U, 3 * U); g.fill();
    // sand paths
    g.lineCap = 'round'; g.lineJoin = 'round';
    const path = (w, col) => {
      g.strokeStyle = col; g.lineWidth = w * U;
      g.beginPath(); g.ellipse(X(0), Z(0.6), 8.6 * U, 5.4 * U, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(X(0), Z(6)); g.lineTo(X(0), Z(11)); g.stroke();
      g.beginPath(); g.moveTo(X(-8.6), Z(0.6)); g.quadraticCurveTo(X(-10), Z(-3), X(-9.4), Z(-5.4)); g.stroke();
      g.beginPath(); g.moveTo(X(8.6), Z(0.6)); g.quadraticCurveTo(X(10), Z(-3), X(9.4), Z(-5.0)); g.stroke();
      g.fillStyle = col; roundRect(g, X(-5.6) - (w - 2) * U / 2, Z(-8.6), (11.2 + (w - 2)) * U, 4.4 * U, 1.6 * U); g.fill();
      g.beginPath(); g.moveTo(X(0), Z(-4.8)); g.lineTo(X(0), Z(-4.2)); g.stroke();
    };
    path(2.6, '#e8c98a');
    path(2.2, '#f3d9a0');
    for (let i = 0; i < 500; i++) { const x = r() * S, y = r() * S; g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, 2, 2); }
  }));
  return groundTex;
}

/* ======================= bins ======================= */
const labelCache = new Map();
function labelTex(kind) {
  if (labelCache.has(kind)) return labelCache.get(kind);
  const t = keep(canvasTex(256, 256, (g) => {
    g.fillStyle = '#ffffff'; roundRect(g, 8, 8, 240, 240, 40); g.fill();
    g.lineWidth = 10; g.strokeStyle = BIN_COLORS[kind]; roundRect(g, 8, 8, 240, 240, 40); g.stroke();
    g.save(); g.translate(28, 28); drawIcon(kind === 'paper' ? 'paper' : kind === 'plastic' ? 'plastic' : 'glass', g, 200); g.restore();
  }));
  labelCache.set(kind, t);
  return t;
}
export class Bin {
  constructor(kind) {
    this.kind = kind;
    const col = BIN_HEX[kind], dark = new THREE.Color(col).multiplyScalar(0.72).getHex();
    const g = (this.group = new THREE.Group());
    this.inner = new THREE.Group(); g.add(this.inner);
    const k = new Kit();
    k.add(rb(1.36, 1.46, 1.12, 0.16), col, [0, 0.83, 0]);
    k.add(rb(1.44, 0.2, 1.2, 0.08), dark, [0, 0.16, 0]);
    k.add(rb(1.44, 0.14, 1.2, 0.06), dark, [0, 1.5, 0]);
    for (const sx of [-1, 1]) k.add(cyl(0.12, 0.12, 0.1, 14), 0x2b2b36, [sx * 0.5, 0.12, -0.6], [0, 0, Math.PI / 2]);
    this.body = new THREE.Mesh(k.geo(), M.toy); this.inner.add(this.body);
    this.lidPivot = new THREE.Group(); this.lidPivot.position.set(0, 1.57, -0.6); this.inner.add(this.lidPivot);
    const lk = new Kit();
    lk.add(rb(1.5, 0.16, 1.26, 0.07), dark, [0, 0.08, 0.6]);
    lk.add(rb(0.46, 0.1, 0.12, 0.04), new THREE.Color(dark).multiplyScalar(0.8).getHex(), [0, 0.2, 1.0]);
    this.lid = new THREE.Mesh(lk.geo(), M.toy); this.lidPivot.add(this.lid);
    this.label = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), new THREE.MeshStandardMaterial({ map: labelTex(kind), roughness: 0.7 }));
    this.label.position.set(0, 0.86, 0.566); this.inner.add(this.label);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 40), new THREE.MeshBasicMaterial({ color: 0x39e6e0, transparent: true, opacity: 0.0, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.03; this.ring.visible = false; g.add(this.ring);
    this.flapT = 0; this.shakeT = 0; this.hopT = 0; this.glowT = 0;
    this.mouth = new THREE.Object3D(); this.mouth.position.set(0, 1.75, 0); g.add(this.mouth);
  }
  flap() { this.flapT = 0.9; }
  shake() { this.shakeT = 0.7; }
  hop() { this.hopT = 0.5; }
  glow(sec = 3) { this.glowT = sec; }
  update(dt, time) {
    if (this.flapT > 0) { this.flapT -= dt; const k = Math.max(0, this.flapT) / 0.9; this.lidPivot.rotation.x = -Math.sin((1 - k) * Math.PI) * 1.2; }
    else this.lidPivot.rotation.x = 0;
    if (this.shakeT > 0) { this.shakeT -= dt; const k = Math.max(0, this.shakeT); this.inner.rotation.y = Math.sin(k * 30) * 0.16 * Math.min(1, k * 2); }
    else this.inner.rotation.y = 0;
    if (this.hopT > 0) { this.hopT -= dt; const k = 1 - Math.max(0, this.hopT) / 0.5; this.inner.position.y = Math.sin(k * Math.PI) * 0.5; this.inner.scale.set(1, 1 + Math.sin(k * Math.PI * 2) * 0.06, 1); }
    else { this.inner.position.y = 0; this.inner.scale.set(1, 1, 1); }
    if (this.glowT > 0) {
      this.glowT -= dt;
      this.ring.visible = true;
      this.ring.material.opacity = 0.55 + Math.sin(time * 6) * 0.3;
      const s = 1 + Math.sin(time * 6) * 0.06; this.ring.scale.set(s, s, s);
    } else this.ring.visible = false;
  }
}

/* ======================= litter ======================= */
const litterGeo = {};
function paperGeo(seed) {
  const key = 'p' + seed;
  if (litterGeo[key]) return litterGeo[key];
  const g = ico(0.27, 1).toNonIndexed();
  const r = rng(seed * 13 + 1), pos = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!map.has(k)) map.set(k, 0.8 + r() * 0.35);
    const s = map.get(k);
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s);
  }
  g.computeVertexNormals();
  const col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) { c.setHSL(0.6, 0.06, 0.82 + r() * 0.14); for (let j = 0; j < 3; j++) { col[(i + j) * 3] = c.r; col[(i + j) * 3 + 1] = c.g; col[(i + j) * 3 + 2] = c.b; } }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return (litterGeo[key] = keep(g));
}
function lathe(profile, seg = 18) { return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg); }
function plasticGeos() {
  if (litterGeo.plastic) return litterGeo.plastic;
  const body = keep(lathe([[0, 0], [0.15, 0], [0.165, 0.04], [0.165, 0.36], [0.13, 0.45], [0.07, 0.52], [0.065, 0.6], [0, 0.6]]));
  const k = new Kit();
  k.add(cyl(0.08, 0.08, 0.09, 14), 0x2f80ed, [0, 0.64, 0]);
  k.add(cyl(0.168, 0.168, 0.13, 18), 0x5aa7ff, [0, 0.2, 0]);
  return (litterGeo.plastic = { body, cap: keep(k.geo()) });
}
function glassGeo() {
  if (litterGeo.glass) return litterGeo.glass;
  return (litterGeo.glass = keep(lathe([[0, 0], [0.15, 0], [0.165, 0.03], [0.165, 0.34], [0.12, 0.44], [0.066, 0.5], [0.06, 0.7], [0.078, 0.72], [0.078, 0.77], [0, 0.77]], 18)));
}

/** a litter piece lying on the ground; userData.kind ∈ paper | plastic | glass */
export function makeLitter(kind, variant = 0, scale = 1.25) {
  const g = new THREE.Group();
  g.userData.kind = kind;
  const inner = new THREE.Group(); g.add(inner);
  if (kind === 'paper') {
    const m = new THREE.Mesh(paperGeo(variant % 3), M.flatToy); m.position.y = 0.25; inner.add(m);
  } else if (kind === 'plastic') {
    const { body, cap } = plasticGeos();
    const holder = new THREE.Group(); holder.rotation.z = Math.PI / 2; holder.position.set(0.3, 0.17, 0); inner.add(holder);
    const b = new THREE.Mesh(body, M.bottle); b.renderOrder = 2; holder.add(b);
    holder.add(new THREE.Mesh(cap, M.toy));
  } else {
    const holder = new THREE.Group(); holder.rotation.z = Math.PI / 2; holder.position.set(0.38, 0.17, 0); inner.add(holder);
    holder.add(new THREE.Mesh(glassGeo(), variant % 2 ? M.glassB : M.glassG));
  }
  g.scale.setScalar(scale);
  g.userData.inner = inner;
  return g;
}

/* ======================= park ======================= */
export function buildPark(parent, { trees = true } = {}) {
  const park = new THREE.Group(); parent.add(park);
  const obstacles = [];

  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: makeGroundTex(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; park.add(ground);
  park.userData.ground = ground;

  // hills + clouds (one mesh each)
  const hk = new Kit(), r = rng(3);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.3, d = 52 + r() * 18, s = 9 + r() * 9;
    hk.add(sph(1, 20, 12), [0x7cc864, 0x6bbd5a, 0x93d470, 0x5fb05a][i % 4], [Math.cos(a) * d, -2.5, Math.sin(a) * d], [0, 0, 0], [s * 1.8, s * 0.75, s]);
  }
  park.add(new THREE.Mesh(hk.geo(), M.toy));
  const ck = new Kit();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4, d = 38 + r() * 14, y = 17 + r() * 7;
    for (let j = 0; j < 4; j++) ck.add(sph(1, 12, 8), 0xffffff, [Math.cos(a) * d + (j - 1.5) * 2.2, y + (j % 2) * 0.8, Math.sin(a) * d + r() * 1.5], [0, 0, 0], [2.2 + r(), 1.5 + r() * 0.6, 1.8]);
  }
  const clouds = new THREE.Mesh(ck.geo(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  park.add(clouds); park.userData.clouds = clouds;

  // static props merged: mushroom gazebo, swing set, benches, flower patches, edge stones
  const pk = new Kit();
  { // red mushroom gazebo
    const [x, z] = GAZEBO;
    pk.add(cyl(0.5, 0.62, 2.5, 18), 0xf4ead3, [x, 1.25, z]);
    pk.add(new THREE.SphereGeometry(2.1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0xe8343f, [x, 2.4, z], [0, 0, 0], [1, 0.62, 1]);
    pk.add(cyl(2.1, 2.0, 0.14, 28), 0xffd7c4, [x, 2.38, z]);
    const dots = [[0, 1.0], [1.1, 0.45], [-1.0, 0.5], [0.45, -1.15], [-0.6, -0.9], [1.4, -0.6], [-1.45, -0.3], [0.2, 0.2], [0.75, 1.4], [-0.9, 1.4]];
    for (const [dx, dz] of dots) {
      const d2 = dx * dx + dz * dz, y = Math.sqrt(Math.max(0, 4.41 - d2)) * 0.62;
      pk.add(sph(0.26, 10, 8), 0xffffff, [x + dx, 2.4 + y, z + dz], [0, 0, 0], [1, 0.45, 1]);
    }
    pk.add(cyl(1.1, 1.15, 0.4, 24), 0xc9733a, [x, 0.2, z]);
  }
  { // swing set
    const [x, z] = SWING;
    for (const sx of [-1.5, 1.5]) for (const sz of [-0.5, 0.5]) pk.add(cyl(0.08, 0.08, 2.9, 10), 0x3a86ff, [x + sx, 1.4, z + sz * 1.4], [sz * 0.5, 0, 0]);
    pk.add(cyl(0.1, 0.1, 3.3, 12), 0xe8343f, [x, 2.75, z], [0, 0, Math.PI / 2]);
    for (const sx of [-0.7, 0.7]) {
      for (const rx of [-0.25, 0.25]) pk.add(cyl(0.02, 0.02, 1.9, 6), 0xdddddd, [x + sx + rx, 1.8, z]);
      pk.add(rb(0.66, 0.08, 0.32, 0.03), 0xffcc2e, [x + sx, 0.85, z]);
    }
    obstacles.push({ x: x - 1.5, z, r: 0.55 }, { x: x + 1.5, z, r: 0.55 });
  }
  for (const [x, z] of BENCHES) {
    for (const dz of [-0.18, 0, 0.18]) pk.add(rb(2.4, 0.08, 0.16, 0.03), 0xd9813f, [x, 0.55, z + dz]);
    for (const dy of [0.82, 1.02]) pk.add(rb(2.4, 0.14, 0.07, 0.03), 0xd9813f, [x, dy, z - 0.3]);
    for (const sx of [-1, 1]) {
      pk.add(rb(0.1, 0.55, 0.5, 0.03), 0x4a4a58, [x + sx * 1.0, 0.27, z]);
      pk.add(rb(0.1, 0.6, 0.08, 0.03), 0x4a4a58, [x + sx * 1.0, 0.8, z - 0.3]);
    }
    obstacles.push({ x: x - 0.7, z, r: 0.75 }, { x: x + 0.7, z, r: 0.75 });
  }
  const fr = rng(11);
  const patch = (x, z) => {
    for (let i = 0; i < 6; i++) {
      const px = x + (fr() - 0.5) * 1.6, pz = z + (fr() - 0.5) * 1.0;
      pk.add(cyl(0.03, 0.03, 0.4, 5), 0x2f8f3c, [px, 0.2, pz]);
      pk.add(sph(0.13, 8, 6), [0xff6fae, 0xffd23f, 0xffffff, 0xff8c2a, 0xb98cff][i % 5], [px, 0.42, pz]);
    }
  };
  for (const [x, z] of [[-13.4, -3], [13.4, -3.4], [-13.2, 4.2], [13.3, 4.6], [-3, 9.9], [3.5, 9.9], [-8, -9.9], [8.5, -9.9]]) patch(x, z);
  const props = new THREE.Mesh(pk.geo(), M.toy);
  park.add(props);
  park.userData.tall = [props]; // things tall enough to hide the robot from the follow camera (see drive.js seeThrough)
  obstacles.push({ x: GAZEBO[0], z: GAZEBO[1], r: 1.45 });

  // trees (instanced)
  if (trees) {
    const tk = new Kit();
    tk.add(cyl(0.2, 0.26, 1.5, 10), 0x8a5a35, [0, 0.75, 0]);
    tk.add(ico(1.15, 1), 0x4cb85a, [0, 2.15, 0], [0, 0, 0], 1, true);
    tk.add(ico(0.8, 1), 0x5cc868, [0.55, 2.6, 0.2], [0, 0, 0], 1, true);
    tk.add(ico(0.75, 1), 0x45a852, [-0.5, 2.5, -0.25], [0, 0, 0], 1, true);
    const im = new THREE.InstancedMesh(tk.geo(), M.toy, TREES.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    TREES.forEach(([x, z], i) => {
      const s = 0.95 + fr() * 0.35;
      m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), fr() * 6), new THREE.Vector3(s, s, s));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, c.setRGB(0.9 + fr() * 0.15, 1, 0.9 + fr() * 0.15));
      obstacles.push({ x, z, r: 0.75 });
    });
    im.computeBoundingSphere();
    park.add(im);
    park.userData.tall.push(im);
  }

  // bushes along the border (instanced)
  {
    const bk = new Kit();
    bk.add(ico(0.7, 1), 0x3f9f4e, [0, 0.45, 0], [0, 0, 0], [1.1, 0.8, 1], true);
    bk.add(ico(0.55, 1), 0x4fb35c, [0.5, 0.4, 0.1], [0, 0, 0], [1, 0.8, 1], true);
    bk.add(ico(0.5, 1), 0x46a855, [-0.5, 0.38, -0.1], [0, 0, 0], [1, 0.8, 1], true);
    const pts = [];
    for (let x = -14.4; x <= 14.4; x += 1.8) { pts.push([x, -10.7], [x, 10.7]); }
    for (let z = -9; z <= 9; z += 1.8) { pts.push([-14.6, z], [14.6, z]); }
    const im = new THREE.InstancedMesh(bk.geo(), M.toy, pts.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    pts.forEach(([x, z], i) => {
      const s = 0.85 + fr() * 0.4;
      m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), fr() * 6), new THREE.Vector3(s, s, s));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, c.setRGB(0.85 + fr() * 0.2, 0.95 + fr() * 0.05, 0.85 + fr() * 0.2));
    });
    im.computeBoundingSphere();
    park.add(im);
  }
  park.userData.obstacles = obstacles;
  return park;
}

export function addBins(parent, obstacles) {
  const bins = {};
  for (const kind of KINDS) {
    const b = new Bin(kind);
    const [x, z] = BIN_POS[kind];
    b.group.position.set(x, 0, z);
    parent.add(b.group);
    bins[kind] = b;
    if (obstacles) obstacles.push({ x, z, r: 0.95 });
  }
  return bins;
}

/** random litter layout: seeded, never inside props, away from bins, reachable */
export function scatterLitter(seed, n, obstacles, { avoid = [], minX = BOUNDS.minX + 1.4, maxX = BOUNDS.maxX - 1.4, minZ = BOUNDS.minZ + 1.2, maxZ = BOUNDS.maxZ - 1.2 } = {}) {
  const r = rng(seed), out = [];
  let guard = 0;
  while (out.length < n && guard++ < 5000) {
    const x = minX + r() * (maxX - minX), z = minZ + r() * (maxZ - minZ);
    if (obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 1.3)) continue;
    if (Object.values(BIN_POS).some(([bx, bz]) => Math.hypot(bx - x, bz - z) < 3.0)) continue;
    if (avoid.some(([ax, az, ar]) => Math.hypot(ax - x, az - z) < (ar || 2.2))) continue;
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 2.0)) continue;
    out.push({ x, z, rot: r() * Math.PI * 2 });
  }
  return out;
}

/* ======================= flowers (instanced, pop-in) ======================= */
export class Flowers {
  constructor(parent, max = 60) {
    const sk = new Kit();
    sk.add(cyl(0.035, 0.035, 0.5, 5), 0x2f8f3c, [0, 0.25, 0]);
    sk.add(sph(0.1, 6, 4), 0x46b852, [0.08, 0.18, 0], [0, 0, 0], [1.4, 0.4, 0.8]);
    const hk = new Kit();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; hk.add(sph(0.11, 8, 6), 0xffffff, [Math.cos(a) * 0.13, 0.55, Math.sin(a) * 0.13], [0, 0, 0], [1, 0.6, 1]); }
    hk.add(sph(0.09, 8, 6), 0xffe066, [0, 0.58, 0]);
    this.stems = new THREE.InstancedMesh(sk.geo(), M.toy, max);
    this.heads = new THREE.InstancedMesh(hk.geo(), M.toy, max);
    this.stems.count = this.heads.count = 0;
    this.stems.frustumCulled = this.heads.frustumCulled = false;
    parent.add(this.stems, this.heads);
    this.list = []; this.max = max;
  }
  add(x, z, color, delay = 0, scale = 1.4) {
    if (this.list.length >= this.max) return;
    const i = this.list.length;
    this.list.push({ x, z, t: -delay, s: scale, rot: Math.random() * 6 });
    this.heads.setColorAt(i, new THREE.Color(color));
    this.heads.instanceColor.needsUpdate = true;
  }
  update(dt) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    this.list.forEach((f, i) => {
      f.t += dt;
      const k = Math.max(0, Math.min(1, f.t / 0.5));
      const e = k === 0 ? 0.0001 : 1 + Math.sin(k * Math.PI) * 0.3 * (1 - k) - (1 - k) ** 3;
      const sc = Math.max(0.0001, e * f.s);
      m4.compose(v.set(f.x, 0, f.z), q.setFromAxisAngle(s.set(0, 1, 0), f.rot), s.set(sc, sc, sc));
      this.stems.setMatrixAt(i, m4); this.heads.setMatrixAt(i, m4);
    });
    this.stems.count = this.heads.count = this.list.length;
    this.stems.instanceMatrix.needsUpdate = this.heads.instanceMatrix.needsUpdate = true;
  }
}

/* ======================= build table (workshop) ======================= */
export function buildTable(parent) {
  const t = new THREE.Group(); parent.add(t);
  const k = new Kit();
  k.add(rb(11, 0.4, 6.4, 0.18), 0xf0c48a, [0, -0.2, 0]);
  for (let i = -5; i <= 5; i++) k.add(new THREE.BoxGeometry(0.03, 0.02, 6.2), 0xe2b073, [i, 0.001, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(rb(0.5, 4, 0.5, 0.1), 0xd29a5f, [sx * 4.8, -2.4, sz * 2.6]);
  k.add(rb(5.4, 0.05, 3.6, 0.2), 0x5b45b0, [0.2, 0.025, 0.1]);
  k.add(rb(5.0, 0.052, 3.2, 0.18), 0x6a55c4, [0.2, 0.026, 0.1]);
  // floor + back wall of the studio
  k.add(new THREE.BoxGeometry(60, 0.1, 40), 0xd9ccff, [0, -4.45, 0]);
  const table = new THREE.Mesh(k.geo(), M.toy); table.receiveShadow = true; t.add(table);
  // soft spotlight disc
  const spot = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), new THREE.MeshBasicMaterial({
    map: keep(canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); })),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  spot.rotation.x = -Math.PI / 2; spot.position.set(0, 0.06, 0); t.add(spot);
  t.userData.spot = spot;
  return t;
}

/** open parts box with 6 compartments (take-apart) */
export function buildPartsBox(parent) {
  const g = new THREE.Group(); parent.add(g);
  const k = new Kit(), W = 3.0, D = 2.0, H = 0.6, T = 0.1, col = 0x39a0e6, dk = 0x2a7cba;
  k.add(rb(W, 0.1, D, 0.04), dk, [0, 0.05, 0]);
  k.add(rb(W, H, T, 0.04), col, [0, H / 2, -D / 2]); k.add(rb(W, H, T, 0.04), col, [0, H / 2, D / 2]);
  k.add(rb(T, H, D, 0.04), col, [-W / 2, H / 2, 0]); k.add(rb(T, H, D, 0.04), col, [W / 2, H / 2, 0]);
  for (const x of [-0.5, 0.5]) k.add(rb(0.06, H * 0.8, D, 0.02), 0x8fd0ff, [x, H * 0.4, 0]);
  k.add(rb(W, H * 0.8, 0.06, 0.02), 0x8fd0ff, [0, H * 0.4, 0]);
  const box = new THREE.Mesh(k.geo(), M.toy); g.add(box);
  const lid = new THREE.Mesh(new Kit().add(rb(W + 0.1, 0.12, D + 0.1, 0.05), dk).geo(), M.toy);
  lid.position.set(0, H + 0.9, -D / 2 - 0.6); lid.rotation.x = -1.2; g.add(lid);
  const slots = [];
  for (const z of [-0.5, 0.5]) for (const x of [-1, 0, 1]) slots.push(new THREE.Vector3(x, 0.25, z));
  g.userData.slots = slots;
  return g;
}

/* ======================= trophy room ======================= */
export function buildRoom(parent) {
  const g = new THREE.Group(); parent.add(g);
  const k = new Kit();
  for (let i = 0; i < 18; i++) k.add(new THREE.BoxGeometry(0.98, 0.2, 14), i % 2 ? 0xdba56c : 0xe3b07a, [-8.5 + i, -0.1, 0]);
  k.add(new THREE.BoxGeometry(18, 9, 0.3), 0xeee2ff, [0, 4.4, -7]);
  k.add(new THREE.BoxGeometry(0.3, 9, 14), 0xd9f4ea, [-9, 4.4, 0]);
  k.add(new THREE.BoxGeometry(18, 0.35, 0.36), 0xffffff, [0, 0.17, -6.82]);
  k.add(new THREE.BoxGeometry(0.36, 0.35, 14), 0xffffff, [-8.82, 0.17, 0]);
  // window on the side wall
  k.add(new THREE.BoxGeometry(0.1, 3.2, 3.6), 0xffffff, [-8.84, 4.6, 1.5]);
  k.add(new THREE.BoxGeometry(0.12, 2.8, 3.2), 0x9fdcff, [-8.82, 4.6, 1.5]);
  k.add(new THREE.BoxGeometry(0.14, 2.8, 0.1), 0xffffff, [-8.8, 4.6, 1.5]);
  k.add(new THREE.BoxGeometry(0.14, 0.1, 3.2), 0xffffff, [-8.8, 4.6, 1.5]);
  // round rug
  k.add(cyl(4.2, 4.2, 0.04, 48), 0x7b5cff, [0.6, 0.02, 0.4]);
  k.add(cyl(3.5, 3.5, 0.05, 48), 0x39e6e0, [0.6, 0.025, 0.4]);
  k.add(cyl(2.8, 2.8, 0.06, 48), 0xb9a6ff, [0.6, 0.03, 0.4]);
  // plant
  k.add(cyl(0.45, 0.35, 0.8, 16), 0xe8734a, [-7.6, 0.4, -5.6]);
  k.add(ico(0.75, 1), 0x4cb85a, [-7.6, 1.4, -5.6], [0, 0, 0], 1, true);
  k.add(ico(0.55, 1), 0x5cc868, [-7.3, 1.95, -5.4], [0, 0, 0], 1, true);
  const room = new THREE.Mesh(k.geo(), M.toy); room.receiveShadow = true; g.add(room);
  // pedestals in an arc
  const pk = new Kit(), peds = [];
  for (let i = 0; i < 5; i++) {
    const a = -0.95 + i * 0.475, x = 0.6 + Math.sin(a) * 5.0, z = -2.4 + -Math.cos(a) * 2.4 + 1.6;
    pk.add(cyl(0.95, 1.05, 1.0, 28), 0xffffff, [x, 0.5, z]);
    pk.add(cyl(1.0, 1.0, 0.1, 28), 0x39e6e0, [x, 1.02, z]);
    peds.push(new THREE.Vector3(x, 1.07, z));
  }
  g.add(new THREE.Mesh(pk.geo(), M.toy));
  g.userData.pedestals = peds;
  return g;
}
export function inBounds(x, z, m = 0) { return x > BOUNDS.minX + m && x < BOUNDS.maxX - m && z > BOUNDS.minZ + m && z < BOUNDS.maxZ - m; }
export function clampBounds(p, m = 0) { p.x = clamp(p.x, BOUNDS.minX + m, BOUNDS.maxX - m); p.z = clamp(p.z, BOUNDS.minZ + m, BOUNDS.maxZ - m); }
