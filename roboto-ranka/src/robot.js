// The robot: generic toy-brick parts, brand-neutral. Hub „valdiklis" with light eyes, 2 wheels + skid ball,
// pincer arm „žnyplės": two 7-hole beams (green + orange) crossing on a grey pin, 2 dark claws, red rubber band.
import * as THREE from './three.js';
import { Kit, roundedBox as rb, M, keep, deg, damp } from './util.js';

export const A_CLOSED = deg(8), A_OPEN = deg(22), A_HOLD = deg(12.5);
export const HOLE = 0.26;
const HALF7 = 3 * HOLE + 0.13; // beam half-length for 7 holes (0.91)
const cyl = (r1, r2, h, s = 18) => new THREE.CylinderGeometry(r1, r2, h, s);
const sph = (r, a = 16, b = 12) => new THREE.SphereGeometry(r, a, b);
const C = { white: 0xf4f6fb, aqua: 0x39e6e0, dark: 0x2b2b36, hole: 0x1d1240, grey: 0x9aa3ad, green: 0x3ec46d, orange: 0xff8c2a, red: 0xef2b3a, violet: 0x2b1a5a };

/* ---------- cached part geometries ---------- */
const gc = new Map();
const cached = (key, fn) => { if (!gc.has(key)) gc.set(key, keep(fn())); return gc.get(key); };

export const GEO = {
  hub: (color = C.white) => cached('hub' + color, () => {
    const k = new Kit();
    k.add(rb(1.3, 0.8, 1.1, 0.16), color, [0, 0.64, 0]);
    k.add(rb(1.12, 0.1, 0.92, 0.05), C.aqua, [0, 1.06, 0]);
    for (const sx of [-1, 1]) {
      k.add(cyl(0.17, 0.17, 0.04, 22), C.violet, [sx * 0.28, 0.7, 0.552], [Math.PI / 2, 0, 0]);
      k.add(cyl(0.08, 0.08, 0.2, 12), C.grey, [sx * 0.68, 0.38, -0.05], [0, 0, Math.PI / 2]);
      k.add(rb(0.06, 0.16, 0.3, 0.02), 0xd9dde6, [sx * 0.66, 0.78, 0.15]);
    }
    return k.geo();
  }),
  eyes: () => cached('eyes', () => {
    const k = new Kit();
    for (const sx of [-1, 1]) k.add(cyl(0.12, 0.12, 0.04, 22), 0xffffff, [sx * 0.28, 0, 0], [Math.PI / 2, 0, 0]);
    return k.geo();
  }),
  wheel: () => cached('wheel', () => {
    const k = new Kit(), rz = [0, 0, Math.PI / 2];
    k.add(cyl(0.38, 0.38, 0.26, 28), C.dark, [0, 0, 0], rz);
    k.add(cyl(0.25, 0.25, 0.28, 24), C.aqua, [0, 0, 0], rz);
    k.add(cyl(0.09, 0.09, 0.3, 14), C.white, [0, 0, 0], rz);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; k.add(cyl(0.045, 0.045, 0.29, 10), C.violet, [0, Math.cos(a) * 0.17, Math.sin(a) * 0.17], rz); }
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; k.add(new THREE.BoxGeometry(0.27, 0.05, 0.08), 0x3c3c4a, [0, Math.cos(a) * 0.38, Math.sin(a) * 0.38], [a, 0, 0]); }
    return k.geo();
  }),
  skid: () => cached('skid', () => {
    const k = new Kit();
    k.add(sph(0.13), C.grey, [0, 0.13, 0]);
    k.add(rb(0.32, 0.12, 0.32, 0.04), 0xc7ccd4, [0, 0.27, 0]);
    return k.geo();
  }),
  beam: (n, color) => cached('beam' + n + color, () => {
    const k = new Kit(), len = n * HOLE;
    k.add(rb(0.22, 0.14, len, 0.06), color, [0, 0, 0]);
    const disc = cyl(0.074, 0.074, 0.02, 16);
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * HOLE;
      k.add(disc, C.hole, [0, 0.071, z]);
      k.add(disc, C.hole, [0, -0.071, z]);
    }
    return k.geo();
  }),
  claw: (side) => cached('claw' + side, () => { // side +1: hook points toward -x
    const k = new Kit();
    k.add(rb(0.12, 0.28, 0.46, 0.04), C.dark, [0, 0, 0.2]);
    k.add(rb(0.2, 0.28, 0.1, 0.035), C.dark, [-side * 0.05, 0, 0.42]);
    k.add(rb(0.14, 0.3, 0.14, 0.04), 0x444456, [0, 0, -0.02]);
    return k.geo();
  }),
  pin: () => cached('pin', () => {
    const k = new Kit();
    k.add(cyl(0.06, 0.06, 0.46, 14), C.grey, [0, 0.08, 0]);
    k.add(cyl(0.1, 0.1, 0.05, 16), 0xb7bec7, [0, -0.13, 0]);
    k.add(cyl(0.1, 0.1, 0.05, 16), 0xb7bec7, [0, 0.29, 0]);
    return k.geo();
  }),
  // distractors (generic, smooth, no studs, no logos)
  plate: () => cached('plate', () => new Kit().add(rb(1.1, 0.14, 0.7, 0.05), 0xbfc5cf).geo()),
  brick: () => cached('brick', () => new Kit().add(rb(1.0, 0.7, 0.7, 0.12), 0xe2484a).geo()),
  smallbrick: () => cached('smallbrick', () => new Kit().add(rb(0.45, 0.4, 0.45, 0.08), 0xffcc2e).geo()),
  tile: () => cached('tile', () => new Kit().add(rb(0.7, 0.08, 0.7, 0.03), 0x3a86ff).geo()),
  ball: () => cached('ball', () => new Kit().add(sph(0.26), 0xff7eb6).geo()),
  axle: () => cached('axle', () => {
    const k = new Kit();
    k.add(new THREE.BoxGeometry(0.08, 1.5, 0.2), 0x4a4a58, [0, 0, 0]);
    k.add(new THREE.BoxGeometry(0.2, 1.5, 0.08), 0x4a4a58, [0, 0, 0]);
    return k.geo();
  }),
  gear: () => cached('gear', () => {
    const k = new Kit(), rz = [Math.PI / 2, 0, 0];
    k.add(cyl(0.34, 0.34, 0.14, 24), 0x8a93a3, [0, 0, 0], rz);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; k.add(new THREE.BoxGeometry(0.1, 0.14, 0.14), 0x8a93a3, [Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0], [0, 0, a]); }
    k.add(cyl(0.08, 0.08, 0.16, 12), C.dark, [0, 0, 0], rz);
    return k.geo();
  }),
  bandLoop: () => cached('bandLoop', () => new THREE.TorusGeometry(0.34, 0.06, 10, 36)),
};

function bandGeo(a) {
  const hw = HALF7 * Math.sin(a) + 0.11 + 0.035, hh = 0.19;
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    pts.push(new THREE.Vector3(hw * Math.sign(c) * Math.pow(Math.abs(c), 0.35), hh * Math.sign(s) * Math.pow(Math.abs(s), 0.35), 0));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 56, 0.036, 6, true);
}

let bandMat = null;
function getBandMat() { return bandMat || (bandMat = keep(new THREE.MeshStandardMaterial({ color: C.red, roughness: 0.5 }))); }

/* ---------- the robot ---------- */
export class Robot {
  constructor({ hub = C.white, shadows = true } = {}) {
    const g = (this.group = new THREE.Group());
    this.chassis = new THREE.Group(); g.add(this.chassis);
    const mk = (geo, mat = M.plastic) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadows; return m; };

    this.hub = mk(GEO.hub(hub)); this.chassis.add(this.hub);
    this.eyes = mk(GEO.eyes(), M.eyes); this.eyes.position.set(0, 0.7, 0.575); this.eyes.castShadow = false; this.hub.add(this.eyes);
    this.wheels = [-1, 1].map((sx) => { const w = new THREE.Group(); w.position.set(sx * 0.8, 0.38, -0.05); w.add(mk(GEO.wheel())); this.chassis.add(w); return w; });
    [this.wheelR, this.wheelL] = this.wheels;
    this.skid = mk(GEO.skid()); this.skid.position.set(0, 0, -0.42); this.chassis.add(this.skid);

    this.arm = new THREE.Group(); this.arm.position.set(0, 0.2, 1.5); g.add(this.arm);
    this.beamA = new THREE.Group(); this.beamB = new THREE.Group(); this.beamB.position.y = 0.16;
    this.beamAMesh = mk(GEO.beam(7, C.green)); this.beamBMesh = mk(GEO.beam(7, C.orange));
    this.beamA.add(this.beamAMesh); this.beamB.add(this.beamBMesh);
    this.clawA = mk(GEO.claw(1)); this.clawA.position.set(0, 0.08, HALF7); this.clawA.rotation.y = -deg(23.5); this.beamA.add(this.clawA);
    this.clawB = mk(GEO.claw(-1)); this.clawB.position.set(0, -0.08, HALF7); this.clawB.rotation.y = deg(23.5); this.beamB.add(this.clawB);
    this.pin = mk(GEO.pin()); this.arm.add(this.beamA, this.beamB, this.pin);
    this.band = mk(bandGeo(A_CLOSED), getBandMat()); this.band.position.set(0, 0.08, -HALF7 * Math.cos(A_CLOSED)); this.arm.add(this.band);
    this.tip = new THREE.Object3D(); this.tip.position.set(0, 0.06, 1.2); this.arm.add(this.tip);

    this.a = A_CLOSED; this.aTarget = A_CLOSED; this.bandA = A_CLOSED;
    this.spin = 0; this.blinkT = 1.5; this.wig = 0;
    this.applyGrip();
  }

  /** v: 0 closed .. 1 open; 'hold' for a gripped item */
  grip(v) { this.aTarget = v === 'hold' ? A_HOLD : A_CLOSED + (A_OPEN - A_CLOSED) * v; }
  isOpen() { return this.aTarget > A_HOLD + 0.01; }
  applyGrip() {
    this.beamA.rotation.y = this.a; this.beamB.rotation.y = -this.a;
    if (Math.abs(this.bandA - this.a) > 0.002 && this.band.visible) {
      this.band.geometry.dispose();
      this.band.geometry = bandGeo(this.a);
      this.bandA = this.a;
    }
    this.band.position.z = -HALF7 * Math.cos(this.a);
  }
  wiggle(t = 1.2) { this.wig = t; }
  blink() { this.blinkT = 0; }

  update(dt, speed = 0) {
    if (Math.abs(this.a - this.aTarget) > 0.0005) {
      const s = 2.6 * dt;
      this.a += Math.max(-s, Math.min(s, this.aTarget - this.a));
      this.applyGrip();
    }
    this.spin += (speed * dt) / 0.38;
    for (const w of this.wheels) w.rotation.x = this.spin;
    this.blinkT -= dt;
    let ey = 1;
    if (this.blinkT < 0) { ey = Math.abs(this.blinkT + 0.08) / 0.08; if (this.blinkT < -0.16) this.blinkT = 2 + Math.random() * 3; }
    this.eyes.scale.y = Math.max(0.1, Math.min(1, ey));
    if (this.wig > 0) {
      this.wig -= dt;
      const k = Math.max(0, this.wig);
      this.chassis.rotation.z = Math.sin(k * 22) * 0.12 * Math.min(1, k);
      this.chassis.position.y = Math.abs(Math.sin(k * 11)) * 0.18 * Math.min(1, k);
      this.arm.rotation.z = this.chassis.rotation.z; this.arm.position.y = 0.2 + this.chassis.position.y;
    }
  }
}

/** standalone part for the build tray / take-apart box */
export function makePart(kind) {
  const g = new THREE.Group();
  const add = (geo, mat = M.plastic, p = [0, 0, 0], r = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.rotation.set(...r); g.add(m); return m; };
  switch (kind) {
    case 'hub': add(GEO.hub(), M.plastic, [0, -0.64, 0]); add(GEO.eyes(), M.eyes, [0, 0.06, 0.575]); break;
    case 'wheel': add(GEO.wheel(), M.plastic, [0, 0, 0], [0, 0.5, 0]); break;
    case 'beam5': add(GEO.beam(5, g.userData.color || C.green), M.plastic, [0, 0, 0], [0, Math.PI / 2, 0]); break;
    case 'pin': add(GEO.pin(), M.plastic, [0, -0.08, 0]); break;
    case 'claw': add(GEO.claw(1), M.plastic, [0, 0, -0.2], [0, 0.6, 0]); break;
    case 'band': add(GEO.bandLoop(), getBandMat(), [0, 0, 0], [0.5, 0, 0]); break;
    case 'plate': add(GEO.plate()); break;
    case 'brick': add(GEO.brick()); break;
    case 'smallbrick': add(GEO.smallbrick()); break;
    case 'tile': add(GEO.tile()); break;
    case 'ball': add(GEO.ball()); break;
    case 'axle': add(GEO.axle(), M.plastic, [0, 0, 0], [0, 0, 0.5]); break;
    case 'gear': add(GEO.gear()); break;
  }
  g.userData.kind = kind;
  return g;
}
export function makeBeamPart(n, color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(GEO.beam(n, color), M.plastic);
  m.rotation.y = Math.PI / 2;
  g.add(m);
  g.userData.kind = 'beam' + n;
  g.userData.beamMesh = m;
  g.userData.n = n;
  return g;
}
export const ROBOT_COLORS = C;
