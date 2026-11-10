// The cast (Leo, Neo, Maja) and the child's 4 avatars as blocky toy figures, animated by code.
// No logos anywhere. Each figure: legs ×2, torso, arms ×2, head (+hair), face decal = 7 draw calls.
import * as THREE from './three.js';
import { Kit, roundedBox, M, keep, canvasTex, damp } from './util.js';

const rb = roundedBox;
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb_, h, s = 16) => new THREE.CylinderGeometry(rt, rb_, h, s);

export const CAST = {
  leo: {
    name: 'Leo', skin: 0xf3c29c, hair: 'spiky', hairColor: 0x3b1b63, brow: 0x2a1446,
    shirt: 0x7a3fd0, sleeve: 0x7a3fd0, forearm: 0xf4ead3, pants: 0x1c1c24, shoe: 0xf4ead3, stripe: 0x7a3fd0,
    neck: 0xf4ead3, wrist: true,
  },
  neo: {
    name: 'Neo', skin: 0xf7c7a3, hair: 'curly', hairColor: 0xd8742a, brow: 0xa2521b,
    shirt: 0xffcc2e, sleeve: 0xffcc2e, forearm: null, pants: 0x6e5d2c, shoe: 0xffcc2e, pockets: true, headphones: 0xf4ead3,
  },
  maja: {
    name: 'Maja', skin: 0xb87a4f, hair: 'beanie', hairColor: 0x4a2a17, brow: 0x3a2010, hat: 0x2f5e3b,
    shirt: 0x2f5e3b, sleeve: 0x2f5e3b, forearm: 0x2f5e3b, pants: 0x4a2f1f, shoe: 0x43a35a, hood: true,
  },
};
export const AVATARS = [
  { name: 'A', skin: 0x9b6544, hair: 'cap', hairColor: 0x1d1a1a, brow: 0x1d1a1a, shirt: 0xff5a4e, sleeve: 0xff5a4e, forearm: null, pants: 0x3a5cbf, shoe: 0xffffff, ui: '#ff5a4e' },
  { name: 'B', skin: 0xf6d0b1, hair: 'pigtails', hairColor: 0xf2c24c, brow: 0xb88a2a, shirt: 0x22c7b8, sleeve: 0x22c7b8, forearm: null, pants: 0x24305e, shoe: 0xff6fae, ui: '#22c7b8' },
  { name: 'C', skin: 0xd8a072, hair: 'bob', hairColor: 0x5a3520, brow: 0x3e2414, shirt: 0xff7eb6, sleeve: 0xff7eb6, forearm: null, pants: 0x6f6f7d, shoe: 0x7b5cff, ui: '#ff7eb6' },
  { name: 'D', skin: 0x6e452b, hair: 'puff', hairColor: 0x161212, brow: 0x161212, shirt: 0x3a86ff, sleeve: 0x3a86ff, forearm: null, pants: 0xe0a33a, shoe: 0xffffff, band: 0xffd23f, ui: '#3a86ff' },
];

/* ---------- face texture (dot eyes, brows, smile, blush) ---------- */
const faceCache = new Map();
function faceTex(spec, blink = false) {
  const key = spec.name + (blink ? 'b' : '');
  if (faceCache.has(key)) return faceCache.get(key);
  const brow = '#' + new THREE.Color(spec.brow).getHexString();
  const t = keep(canvasTex(256, 256, (g) => {
    // blush
    for (const x of [58, 198]) {
      const gr = g.createRadialGradient(x, 168, 2, x, 168, 30);
      gr.addColorStop(0, 'rgba(255,120,130,.55)'); gr.addColorStop(1, 'rgba(255,120,130,0)');
      g.fillStyle = gr; g.fillRect(x - 32, 136, 64, 64);
    }
    // eyes
    for (const x of [86, 170]) {
      if (blink) {
        g.strokeStyle = '#24152f'; g.lineWidth = 7; g.lineCap = 'round';
        g.beginPath(); g.arc(x, 112, 15, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      } else {
        g.fillStyle = '#24152f'; g.beginPath(); g.ellipse(x, 118, 15, 20, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 5, 110, 5.5, 0, Math.PI * 2); g.fill();
      }
    }
    // brows
    g.strokeStyle = brow; g.lineWidth = 9; g.lineCap = 'round';
    for (const x of [86, 170]) { g.beginPath(); g.arc(x, 96, 20, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); }
    // nose
    g.fillStyle = 'rgba(190,100,80,.35)'; g.beginPath(); g.ellipse(128, 142, 10, 7, 0, 0, Math.PI * 2); g.fill();
    // smile
    g.strokeStyle = '#7a2a2a'; g.lineWidth = 7.5;
    g.beginPath(); g.arc(128, 150, 30, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke();
  }));
  faceCache.set(key, t);
  return t;
}

/* ---------- hair styles (head-local, head centre at y=0.52) ---------- */
function hair(k, s) {
  const c = s.hairColor;
  const cap = () => { k.add(rb(1.18, 0.42, 1.0, 0.2), c, [0, 0.88, -0.03]); k.add(rb(1.16, 0.72, 0.3, 0.14), c, [0, 0.6, -0.36]); };
  switch (s.hair) {
    case 'spiky': {
      cap();
      const cone = new THREE.ConeGeometry(0.17, 0.52, 6);
      const spots = [[-0.36, -0.26], [0, -0.32], [0.36, -0.26], [-0.42, 0.06], [-0.14, 0.02], [0.14, 0.04], [0.42, 0.06], [-0.26, 0.3], [0.04, 0.34], [0.3, 0.3]];
      for (const [x, z] of spots) k.add(cone, c, [x, 1.12, z], [z * 1.3, 0, -x * 1.5]);
      k.add(cone, c, [-0.22, 0.98, 0.42], [1.55, 0, 0.35], [0.9, 0.8, 0.9]);
      k.add(cone, c, [0.14, 0.98, 0.44], [1.6, 0, -0.3], [0.9, 0.8, 0.9]);
      k.add(cone, c, [0.44, 0.9, 0.3], [1.2, 0, -0.9], [0.8, 0.7, 0.8]);
      break;
    }
    case 'curly': {
      k.add(rb(1.14, 0.36, 0.96, 0.18), c, [0, 0.86, -0.03]);
      const b = sph(0.19, 10, 8);
      for (let row = 0; row < 3; row++) {
        const n = 9 + row * 2;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + row * 0.3;
          const ring = [0.24, 0.44, 0.56][row], y = [1.12, 1.02, 0.86][row];
          const x = Math.cos(a) * ring, z = Math.sin(a) * ring * 0.92 - 0.02;
          if (row === 2 && z > 0.22 && Math.abs(x) < 0.4) continue; // keep the face clear
          k.add(b, c, [x, y, z]);
        }
      }
      k.add(b, c, [0, 1.18, 0]);
      for (const [x, y] of [[-0.45, 0.62], [0.45, 0.62], [-0.3, 0.58], [0.3, 0.58], [0, 0.6]]) k.add(b, c, [x, y, -0.4]);
      break;
    }
    case 'beanie': {
      k.add(rb(0.24, 0.92, 0.72, 0.1), c, [-0.56, 0.36, -0.06]);
      k.add(rb(0.24, 0.92, 0.72, 0.1), c, [0.56, 0.36, -0.06]);
      k.add(rb(1.12, 1.0, 0.3, 0.12), c, [0, 0.34, -0.36]);
      k.add(rb(1.02, 0.16, 0.2, 0.07), c, [0, 0.86, 0.38]);
      k.add(rb(1.22, 0.52, 1.06, 0.24), s.hat, [0, 1.02, -0.02]);
      k.add(rb(1.27, 0.22, 1.1, 0.09), new THREE.Color(s.hat).multiplyScalar(0.8).getHex(), [0, 0.8, -0.02]);
      break;
    }
    case 'cap': {
      cap();
      k.add(rb(1.04, 0.16, 0.2, 0.07), c, [0.06, 0.94, 0.4], [0, 0, -0.12]);
      break;
    }
    case 'pigtails': {
      cap();
      k.add(rb(1.02, 0.16, 0.2, 0.07), c, [0, 0.92, 0.4]);
      for (const sx of [-1, 1]) {
        k.add(sph(0.26, 12, 10), c, [sx * 0.72, 0.5, -0.12], [0, 0, 0], [0.9, 1.2, 0.9]);
        k.add(sph(0.09, 8, 6), 0xff6fae, [sx * 0.6, 0.68, -0.1]);
      }
      break;
    }
    case 'bob': {
      cap();
      k.add(rb(0.22, 0.66, 0.86, 0.1), c, [-0.6, 0.5, -0.04]);
      k.add(rb(0.22, 0.66, 0.86, 0.1), c, [0.6, 0.5, -0.04]);
      k.add(rb(1.2, 0.84, 0.32, 0.14), c, [0, 0.5, -0.34]);
      k.add(rb(1.08, 0.2, 0.2, 0.08), c, [0, 0.9, 0.4]);
      break;
    }
    case 'puff': {
      k.add(rb(1.16, 0.36, 0.98, 0.18), c, [0, 0.86, -0.04]);
      k.add(sph(0.56, 16, 12), c, [0, 1.1, -0.14], [0, 0, 0], [1.3, 0.92, 1.12]);
      k.add(rb(1.2, 0.1, 1.02, 0.05), s.band, [0, 0.9, -0.02]);
      break;
    }
  }
}

/* ---------- figure ---------- */
export class Kid {
  constructor(spec) {
    this.spec = spec;
    const s = spec;
    const g = (this.group = new THREE.Group());
    this.body = new THREE.Group(); g.add(this.body);

    // legs
    this.legs = [-1, 1].map((sx) => {
      const k = new Kit();
      k.add(rb(0.32, 0.72, 0.34, 0.1), s.pants, [0, -0.36, 0]);
      k.add(rb(0.36, 0.2, 0.5, 0.08), s.shoe, [0, -0.76, 0.06]);
      if (s.stripe) k.add(rb(0.37, 0.05, 0.4, 0.02), s.stripe, [0, -0.72, 0.06]);
      if (s.pockets) k.add(rb(0.06, 0.2, 0.18, 0.025), new THREE.Color(s.pants).multiplyScalar(0.8).getHex(), [sx * 0.17, -0.3, 0]);
      const pivot = new THREE.Group(); pivot.position.set(sx * 0.2, 0.85, 0);
      pivot.add(new THREE.Mesh(k.geo(), M.toy));
      this.body.add(pivot);
      return pivot;
    });

    // upper body (pivots at hip so it can lean)
    this.upper = new THREE.Group(); this.upper.position.y = 0.85; this.body.add(this.upper);
    const tk = new Kit();
    tk.add(rb(0.95, 0.92, 0.58, 0.16), s.shirt, [0, 0.46, 0]);
    if (s.neck) tk.add(cyl(0.22, 0.24, 0.07, 16), s.neck, [0, 0.93, 0]);
    if (s.headphones) {
      tk.add(new THREE.TorusGeometry(0.3, 0.07, 8, 22), s.headphones, [0, 0.97, 0.02], [Math.PI / 2, 0, 0]);
      for (const sx of [-1, 1]) tk.add(cyl(0.13, 0.13, 0.1, 14), s.headphones, [sx * 0.3, 0.93, 0.14], [0, 0, Math.PI / 2]);
    }
    if (s.hood) {
      const dk = new THREE.Color(s.shirt).multiplyScalar(0.82).getHex();
      tk.add(rb(0.9, 0.38, 0.34, 0.14), dk, [0, 0.95, -0.24]);
      tk.add(rb(0.6, 0.24, 0.06, 0.03), dk, [0, 0.24, 0.29]);
      for (const sx of [-1, 1]) tk.add(cyl(0.025, 0.025, 0.3, 6), 0xf4ead3, [sx * 0.12, 0.7, 0.31]);
    }
    this.upper.add(new THREE.Mesh(tk.geo(), M.toy));

    // arms
    this.arms = [-1, 1].map((sx) => {
      const k = new Kit();
      k.add(rb(0.28, 0.38, 0.3, 0.1), s.sleeve, [0, -0.12, 0]);
      k.add(rb(0.23, 0.44, 0.25, 0.1), s.forearm == null ? s.skin : s.forearm, [0, -0.46, 0]);
      k.add(sph(0.15, 12, 10), s.skin, [0, -0.74, 0]);
      const pivot = new THREE.Group(); pivot.position.set(sx * 0.6, 0.8, 0);
      pivot.add(new THREE.Mesh(k.geo(), M.toy));
      if (s.wrist && sx === 1) { // glowing violet device on the LEFT wrist (figure faces +Z, its left = +X)
        const dev = new THREE.Mesh(rb(0.28, 0.11, 0.29, 0.04), M.glowViolet);
        dev.position.y = -0.6; pivot.add(dev); this.device = dev;
      }
      this.upper.add(pivot);
      return pivot;
    });

    // head
    this.neck = new THREE.Group(); this.neck.position.y = 0.92; this.upper.add(this.neck);
    const hk = new Kit();
    hk.add(cyl(0.17, 0.19, 0.14, 12), s.skin, [0, 0.04, 0]);
    hk.add(rb(1.12, 1.0, 0.94, 0.3), s.skin, [0, 0.52, 0]);
    for (const sx of [-1, 1]) hk.add(sph(0.13, 10, 8), s.skin, [sx * 0.57, 0.48, 0]);
    hair(hk, s);
    this.neck.add(new THREE.Mesh(hk.geo(), M.toy));
    this.faceMat = new THREE.MeshStandardMaterial({ map: faceTex(s), transparent: true, roughness: 0.8, depthWrite: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), this.faceMat);
    face.position.set(0, 0.48, 0.478);
    this.neck.add(face);

    this.anim = 'idle';
    this.t = Math.random() * 10;
    this.pose = { lL: 0, lR: 0, aLx: 0, aLz: 0, aRx: 0, aRz: 0, up: 0, hy: 0, hz: 0, by: 0, sq: 1 };
    this.blinkT = 2 + Math.random() * 3;
    g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  }

  set(anim) { if (this.anim !== anim) { this.anim = anim; this.at = 0; } return this; }
  face(x, z) { this.group.rotation.y = Math.atan2(x - this.group.position.x, z - this.group.position.z); }

  update(dt) {
    this.t += dt; this.at = (this.at || 0) + dt;
    const t = this.t, P = this.pose;
    const T = { lL: 0, lR: 0, aLx: 0, aLz: 0.08, aRx: 0, aRz: -0.08, up: 0, hy: 0, hz: Math.sin(t * 0.9) * 0.04, by: Math.sin(t * 2.4) * 0.025, sq: 1 + Math.sin(t * 2.4) * 0.012 };
    switch (this.anim) {
      case 'walk': case 'run': {
        const f = this.anim === 'run' ? 13 : 9, a = this.anim === 'run' ? 0.8 : 0.55, s = Math.sin(t * f);
        T.lL = s * a; T.lR = -s * a; T.aLx = -s * a * 0.9; T.aRx = s * a * 0.9;
        T.by = Math.abs(Math.cos(t * f)) * (this.anim === 'run' ? 0.12 : 0.07); T.up = this.anim === 'run' ? 0.14 : 0.04; T.sq = 1;
        break;
      }
      case 'wave': T.aRz = -2.6 + Math.sin(t * 9) * 0.35; T.aRx = -0.2; T.hz = 0.1; break;
      case 'point': T.aRx = -1.9; T.aRz = -0.25; T.hy = 0.25; break;
      case 'look': T.hy = Math.sin(t * 1.7) * 0.7; T.hz = 0; break;
      case 'yuck': {
        T.up = -0.3; T.hy = 0.55; T.hz = -0.12;
        T.aLx = -1.25 + Math.sin(t * 14) * 0.08; T.aRx = -1.25 - Math.sin(t * 14) * 0.08; T.aLz = 0.35; T.aRz = -0.35;
        break;
      }
      case 'cheer': {
        const j = Math.max(0, Math.sin(t * 7));
        T.by = j * 0.6; T.sq = j < 0.08 ? 0.9 : 1.04;
        T.aLz = 2.7 + Math.sin(t * 14) * 0.15; T.aRz = -2.7 - Math.sin(t * 14) * 0.15;
        T.lL = -j * 0.3; T.lR = -j * 0.3;
        break;
      }
      // movement break (scenes/break.js): moves a child copies in the room
      case 'stretch': { // up tall like the robot arm, on tiptoes, a slow sway
        const s = Math.sin(t * 1.6);
        T.aLz = 3.0 + s * 0.07; T.aRz = -3.0 + s * 0.07; T.aLx = T.aRx = -0.05;
        T.by = 0.07; T.sq = 1.08; T.hz = s * 0.05;
        break;
      }
      case 'squat': { // depth `amt` 0..1 is driven by the scene: knees forward, body down, lean and reach to the ground
        const a = Math.max(0, Math.min(1, this.amt || 0));
        T.lL = T.lR = -0.78 * a; T.by = -0.24 * a; T.up = 0.85 * a;
        T.aLx = T.aRx = -0.55 * a; T.aLz = 0.08 + 0.12 * a; T.aRz = -0.08 - 0.12 * a; T.hz = 0;
        break;
      }
      case 'march': { // knees up in place, arms swing, the head ticks like a robot
        const f = 5.6, s = Math.sin(t * f);
        T.lL = -Math.max(0, s) * 1.15; T.lR = -Math.max(0, -s) * 1.15;
        T.aLx = s * 0.85; T.aRx = -s * 0.85; T.aLz = 0.25; T.aRz = -0.25;
        T.hy = Math.sin(t * f * 0.5) > 0 ? 0.22 : -0.22; T.by = Math.abs(s) * 0.05; T.up = 0;
        break;
      }
      case 'jump': { // one hop
        const k = Math.min(1, this.at / 0.55), j = Math.sin(k * Math.PI);
        T.by = j * 0.9; T.sq = k > 0.95 ? 0.9 : 1.05; T.aLz = 1.6 * j + 0.08; T.aRz = -1.6 * j - 0.08;
        if (k >= 1) this.anim = 'idle';
        break;
      }
    }
    const L = Math.min(1, dt * 14);
    for (const k in T) {
      if (k === 'by' || k === 'sq') P[k] = (this.anim === 'cheer' || this.anim === 'jump' || this.anim === 'walk' || this.anim === 'run') ? T[k] : P[k] + (T[k] - P[k]) * L;
      else P[k] += (T[k] - P[k]) * L;
    }
    this.legs[0].rotation.x = P.lL; this.legs[1].rotation.x = P.lR;
    this.arms[1].rotation.set(P.aLx, 0, P.aLz); this.arms[0].rotation.set(P.aRx, 0, P.aRz);
    this.upper.rotation.x = P.up;
    this.neck.rotation.set(0, P.hy, P.hz);
    this.body.position.y = P.by;
    this.body.scale.set(1 + (1 - P.sq) * 0.5, P.sq, 1 + (1 - P.sq) * 0.5);
    // blink (swap face texture briefly)
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.faceMat.map = faceTex(this.spec, this.blinkT > -0.13);
      if (this.blinkT <= -0.13) { this.blinkT = 2.5 + Math.random() * 3.5; this.faceMat.map = faceTex(this.spec); }
    }
    if (this.device) this.device.material.color.setHSL(0.75, 1, 0.68 + Math.sin(t * 3) * 0.08);
  }
}

export function makeKid(key) {
  if (typeof key === 'number') return new Kid(AVATARS[key] || AVATARS[0]);
  return new Kid(CAST[key]);
}
