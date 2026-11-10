// Effects: confetti, sparkles, blob shadows (all instanced: one draw call each).
import * as THREE from './three.js';
import { E } from './engine.js';
import { M, keep, canvasTex } from './util.js';

const COLORS = [0xff4f7b, 0xffd23f, 0x39e6e0, 0x7b5cff, 0x3ec46d, 0xff9a1f, 0xffffff];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _v = new THREE.Vector3();

export class Confetti {
  constructor(parent, max = 180) {
    const geo = new THREE.PlaneGeometry(0.16, 0.26);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.max = max;
    this.p = [];
    const c = new THREE.Color();
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, c.set(COLORS[i % COLORS.length]));
    parent.add(this.mesh);
  }
  burst(pos, n = 90, spread = 2.5, up = 7) {
    if (E.reduced) n = Math.min(n, 24);
    for (let i = 0; i < n && this.p.length < this.max; i++) {
      this.p.push({
        x: pos.x + (Math.random() - 0.5) * 0.6, y: pos.y, z: pos.z + (Math.random() - 0.5) * 0.6,
        vx: (Math.random() - 0.5) * spread * 2, vy: up * (0.6 + Math.random() * 0.6), vz: (Math.random() - 0.5) * spread * 2,
        rx: Math.random() * 6, ry: Math.random() * 6, sx: (Math.random() - 0.5) * 12, sy: (Math.random() - 0.5) * 12,
        life: 2.6 + Math.random() * 1.2,
      });
    }
  }
  update(dt) {
    const p = this.p;
    for (let i = p.length - 1; i >= 0; i--) {
      const c = p[i];
      c.life -= dt;
      if (c.life <= 0 || c.y < -0.5) { p.splice(i, 1); continue; }
      c.vy -= 9 * dt; c.vx *= 1 - 1.2 * dt; c.vz *= 1 - 1.2 * dt; c.vy = Math.max(c.vy, -2.2);
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.rx += c.sx * dt; c.ry += c.sy * dt;
    }
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      const s = Math.min(1, c.life * 2);
      _m.compose(_v.set(c.x, c.y, c.z), _q.setFromEuler(_e.set(c.rx, c.ry, 0)), _s.set(s, s, s));
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.count = p.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

let sparkTex = null;
function sparkTexture() {
  if (sparkTex) return sparkTex;
  sparkTex = keep(canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,230,0.9)'); gr.addColorStop(1, 'rgba(255,255,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 6 : 31; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  }));
  return sparkTex;
}

/** camera-facing sparkles: glints and pops */
export class Sparkles {
  constructor(parent, max = 64) {
    const mat = new THREE.MeshBasicMaterial({ map: sparkTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff6c8 });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.max = max;
    this.p = [];
    parent.add(this.mesh);
  }
  add(pos, { size = 0.9, life = 0.7, vy = 0.6, delay = 0, spread = 0 } = {}) {
    if (this.p.length >= this.max) return;
    this.p.push({ x: pos.x + (Math.random() - 0.5) * spread, y: pos.y + (Math.random() - 0.5) * spread, z: pos.z + (Math.random() - 0.5) * spread, size, life, t: -delay, vy, rot: Math.random() * 3 });
  }
  pop(pos, n = 8) { for (let i = 0; i < n; i++) this.add(pos, { size: 0.5 + Math.random() * 0.6, life: 0.6 + Math.random() * 0.4, vy: 1 + Math.random(), spread: 1, delay: Math.random() * 0.15 }); }
  update(dt) {
    const p = this.p;
    for (let i = p.length - 1; i >= 0; i--) { const s = p[i]; s.t += dt; if (s.t >= s.life) p.splice(i, 1); }
    let n = 0;
    const camQ = E.camera.quaternion;
    for (const s of p) {
      if (s.t < 0) continue;
      const k = s.t / s.life;
      const sc = s.size * Math.sin(Math.PI * Math.min(1, k)) + 0.001;
      _q.copy(camQ).multiply(new THREE.Quaternion().setFromAxisAngle(_v.set(0, 0, 1), s.rot + k * 2));
      _m.compose(_v.set(s.x, s.y + s.vy * s.t, s.z), _q, _s.set(sc, sc, sc));
      this.mesh.setMatrixAt(n++, _m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** soft round shadows under moving things (one draw call) */
export class Blobs {
  constructor(parent, max = 32) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, M.blob, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    this.list = [];
    parent.add(this.mesh);
  }
  track(obj, r = 1, y = 0.015) { this.list.push({ obj, r, y }); }
  untrack(obj) { this.list = this.list.filter((t) => t.obj !== obj); }
  update() {
    let n = 0;
    for (const t of this.list) {
      if (!t.obj.parent || !t.obj.visible) continue;
      t.obj.getWorldPosition(_v);
      const h = Math.max(0, _v.y - t.y);
      const s = t.r * Math.max(0.45, 1 - h * 0.25);
      _m.compose(_v.set(_v.x, t.y, _v.z), _q.identity(), _s.set(s * 2, 1, s * 2));
      this.mesh.setMatrixAt(n++, _m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
