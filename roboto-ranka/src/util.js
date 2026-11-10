// Small helpers: math, easing, seeded random, rounded boxes, geometry merging with vertex colours,
// shared materials, canvas textures and disposal.
import * as THREE from './three.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;
export const deg = (d) => (d * Math.PI) / 180;

export const Ease = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  elastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  bounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

/** mulberry32 seeded random */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(arr, r = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- resource keeping / disposal ---------- */
export const KEEP = new WeakSet();
export const keep = (x) => (KEEP.add(x), x);

export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && !KEEP.has(o.geometry)) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (KEEP.has(m)) continue;
        for (const v of Object.values(m)) if (v && v.isTexture && !KEEP.has(v)) v.dispose();
        m.dispose();
      }
    }
    if (o.isInstancedMesh) o.dispose();
  });
}

/* ---------- rounded box (cached, analytic normals) ---------- */
const rbCache = new Map();
export function roundedBox(w, h, d, r = 0.1, k = 3) {
  const key = [w, h, d, r, k].join(',');
  let g = rbCache.get(key);
  if (g) return g;
  r = Math.max(0.001, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  const N = 2 * k + 1;
  g = new THREE.BoxGeometry(w, h, d, N, N, N);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const v = new THREE.Vector3(), inner = new THREE.Vector3(), n = new THREE.Vector3();
  const remap = (x, half) => {
    const i = Math.round(((x + half) / (2 * half)) * N);
    if (i <= k) return -half + r * (i / k);
    return half - r * ((N - i) / k);
  };
  for (let i = 0; i < pos.count; i++) {
    v.set(remap(pos.getX(i), hw), remap(pos.getY(i), hh), remap(pos.getZ(i), hd));
    inner.set(clamp(v.x, -hw + r, hw - r), clamp(v.y, -hh + r, hh - r), clamp(v.z, -hd + r, hd - r));
    n.subVectors(v, inner);
    if (n.lengthSq() < 1e-12) n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
    else n.normalize();
    v.copy(inner).addScaledVector(n, r);
    pos.setXYZ(i, v.x, v.y, v.z);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  g.computeBoundingSphere();
  keep(g);
  rbCache.set(key, g);
  return g;
}

/* ---------- merge with vertex colours ---------- */
const _c = new THREE.Color();
export function mergeParts(parts) {
  let count = 0;
  const list = [];
  for (const p of parts) {
    let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    if (p.flat) { g.deleteAttribute('normal'); g.computeVertexNormals(); }
    g.applyMatrix4(p.matrix);
    list.push([g, p.color]);
    count += g.attributes.position.count;
  }
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  let o = 0;
  for (const [g, color] of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    _c.set(color);
    for (let i = 0; i < n; i++) {
      col[(o + i) * 3] = _c.r; col[(o + i) * 3 + 1] = _c.g; col[(o + i) * 3 + 2] = _c.b;
    }
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();
/** Kit: collect coloured primitives, then merge into one geometry (one draw call). */
export class Kit {
  constructor() { this.parts = []; }
  add(geo, color, p = [0, 0, 0], r = [0, 0, 0], s = 1, flat = false) {
    const m = new THREE.Matrix4().compose(
      _v.set(p[0], p[1], p[2]),
      _q.setFromEuler(_e.set(r[0], r[1], r[2])),
      typeof s === 'number' ? _s.set(s, s, s) : _s.set(s[0], s[1], s[2]),
    );
    this.parts.push({ geo, color, matrix: m, flat });
    return this;
  }
  geo() { return mergeParts(this.parts); }
}

/* ---------- shared materials ---------- */
export const M = {};
export function initMats() {
  M.toy = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 }));
  M.plastic = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0 }));
  M.flatToy = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }));
  M.bottle = keep(new THREE.MeshStandardMaterial({ color: 0x9fdcff, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.62, depthWrite: false }));
  M.glassG = keep(new THREE.MeshStandardMaterial({ color: 0x1f8a46, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.9 }));
  M.glassB = keep(new THREE.MeshStandardMaterial({ color: 0x8a4f1c, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.9 }));
  M.eyes = keep(new THREE.MeshBasicMaterial({ color: 0xc9fffd }));
  M.glowViolet = keep(new THREE.MeshBasicMaterial({ color: 0xc28bff }));
  M.blob = keep(new THREE.MeshBasicMaterial({ map: keep(blobTexture()), transparent: true, depthWrite: false, opacity: 0.32, color: 0x1c1440 }));
}

/* ---------- canvas textures ---------- */
export function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  return c;
}
export function canvasTex(w, h, draw) {
  const t = new THREE.CanvasTexture(canvas(w, h, draw));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function blobTexture() {
  return canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** true when obj and all its parents are visible */
export function isShown(o) {
  while (o) { if (!o.visible) return false; o = o.parent; }
  return true;
}

export function hexMix(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}
