// Engine: renderer, camera, lights, sky, frame loop, tweens and per-scene timers.
import * as THREE from './three.js';
import { Ease, keep, canvasTex, clamp } from './util.js';

export const E = {
  renderer: null, scene: null, camera: null, root: null, timer: null,
  hemi: null, sun: null, time: 0, timeScale: 1, fps: 0,
  touch: false, reduced: false, w: 1, h: 1, rot: false,
  onFrame: new Set(), // global per-frame hooks (ui hotspots, voice cues)
  sceneUpdate: null,
  shadowFocus: null,
  paused: false, // tab hidden: the loop is stopped
  hold: false, // game paused (⏸, scorecard, hidden tab): game time, tweens, scene logic and per-frame hooks freeze
  holdDirty: false, // while held, draw again only when something changed the canvas (resize)
};

/* ---------------- tweens & timers (game time) ---------------- */
const tweens = new Set();
let currentOwner = null;
export function setOwner(o) { currentOwner = o; }
export function killOwner(o) { for (const t of tweens) if (t.owner === o) tweens.delete(t); }

/** tween(duration, fn(easedT, rawT), {ease, delay}) → Promise (never resolves if its scene ended) */
export function tween(dur, fn, opt = {}) {
  return new Promise((res) => {
    tweens.add({ t: -(opt.delay || 0), dur: Math.max(0, dur), fn, ease: opt.ease || Ease.inOut, res, owner: opt.owner || currentOwner, started: false, onStart: opt.onStart });
  });
}
/** to(target, {x:..}, dur, opt) tweens numeric props */
export function to(target, props, dur, opt = {}) {
  let from = null;
  return tween(dur, (k) => {
    if (!from) { from = {}; for (const p in props) from[p] = target[p]; }
    for (const p in props) target[p] = from[p] + (props[p] - from[p]) * k;
  }, opt);
}
export function wait(sec, owner) { return tween(sec, null, { ease: Ease.linear, owner }); }

function stepTweens(dt) {
  for (const t of tweens) {
    t.t += dt;
    if (t.t < 0) continue;
    if (!t.started) { t.started = true; t.onStart && t.onStart(); }
    const raw = t.dur > 0 ? Math.min(1, t.t / t.dur) : 1;
    if (t.fn) t.fn(t.ease(raw), raw);
    if (raw >= 1) { tweens.delete(t); t.res(); }
  }
}

/* ---------------- setup ---------------- */
export function initEngine(container) {
  E.touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  E.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, E.touch ? 1.5 : 2));
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1.0;
  container.appendChild(r.domElement);
  r.domElement.setAttribute('tabindex', '-1');
  E.renderer = r;

  const scene = new THREE.Scene();
  E.scene = scene;
  E.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  scene.add(E.camera);

  E.hemi = new THREE.HemisphereLight(0xdff3ff, 0x8cc46a, 1.7);
  scene.add(E.hemi);
  E.sun = new THREE.DirectionalLight(0xfff2dc, 2.3);
  E.sun.position.set(6, 12, 6);
  E.sun.castShadow = true;
  E.sun.shadow.mapSize.set(1024, 1024);
  const sc = E.sun.shadow.camera;
  sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 1; sc.far = 40;
  E.sun.shadow.normalBias = 0.03;
  E.sun.shadow.bias = -0.0005;
  E.sun.shadow.radius = 3;
  scene.add(E.sun, E.sun.target);

  E.skyTex = keep(skyTexture(['#5cb8ff', '#9fdcff', '#e3f6ff']));
  E.roomTex = keep(skyTexture(['#ffe7c9', '#fff3e3', '#fffaf2']));
  E.studioTex = keep(skyTexture(['#b9a6ff', '#ddd3ff', '#f5f0ff']));
  setBackdrop('sky');

  E.root = new THREE.Group();
  scene.add(E.root);

  E.timer = new THREE.Timer();
  E.timer.connect(document);

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => { resize(); setTimeout(resize, 250); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  window.addEventListener('hashchange', resize); // #rot / #norot

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { E.paused = true; r.setAnimationLoop(null); }
    else { E.paused = false; r.setAnimationLoop(frame); }
  });
  r.setAnimationLoop(frame);
}

export function setBackdrop(kind) {
  const s = E.scene;
  if (kind === 'room') { s.background = E.roomTex; s.fog = new THREE.Fog(0xfff3e3, 30, 90); }
  else if (kind === 'studio') { s.background = E.studioTex; s.fog = new THREE.Fog(0xe9e2ff, 25, 80); }
  else { s.background = E.skyTex; s.fog = new THREE.Fog(0xd6f0ff, 45, 150); }
}

function skyTexture(stops) {
  return canvasTex(16, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, stops[0]); gr.addColorStop(0.55, stops[1]); gr.addColorStop(1, stops[2]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

/* ---------------- always landscape: a touch screen held upright draws the whole game turned 90° ----------------
 * E.rot is true when a touch-first device (primary pointer coarse: phones, tablets) is in portrait — also with
 * rotation lock on, or inside an app that never rotates. #app then gets the landscape box (width = innerHeight,
 * height = innerWidth) and is turned clockwise, so the child simply turns the device. Desktop windows (also touch
 * laptops, whose primary pointer is a mouse/trackpad) and real landscape are never rotated.
 * QA: ?rot=1 or #rot forces it on (any window), ?rot=0 or #norot forces it off.
 * Everything inside #app works in app-local px: E.w × E.h, E.pt(e) for pointer events, E.rectOf(el) for boxes. */
const hashTokens = () => (location.hash || '').slice(1).split(/[&+,]/);
function wantRot() {
  const q = new URLSearchParams(location.search).get('rot'), h = hashTokens();
  if (q === '0' || h.includes('norot')) return false;
  if (q === '1' || h.includes('rot')) return true;
  return innerHeight > innerWidth && matchMedia('(pointer: coarse)').matches;
}
function applyRot() {
  const app = document.getElementById('app');
  if (!app) return;
  const rot = wantRot(), vw = innerWidth, vh = innerHeight;
  E.rot = rot;
  document.documentElement.classList.toggle('rot', rot);
  if (rot) {
    app.style.width = vh + 'px';
    app.style.height = vw + 'px';
    app.style.transform = `translateX(${vw}px) rotate(90deg)`;
  } else {
    app.style.width = app.style.height = app.style.transform = '';
  }
}
const appRect = () => document.getElementById('app').getBoundingClientRect();
/** pointer/mouse event → app-local {x, y} (clockwise turn: x = screen y, y = app right − screen x) */
E.pt = (e) => {
  const a = appRect();
  return E.rot ? { x: e.clientY - a.top, y: a.right - e.clientX } : { x: e.clientX - a.left, y: e.clientY - a.top };
};
/** element box in app-local px: {left, top, width, height, right, bottom} */
E.rectOf = (el) => {
  const a = appRect(), b = el.getBoundingClientRect();
  if (!E.rot) return { left: b.left - a.left, top: b.top - a.top, width: b.width, height: b.height, right: b.right - a.left, bottom: b.bottom - a.top };
  const left = b.top - a.top, top = a.right - b.right;
  return { left, top, width: b.height, height: b.width, right: left + b.height, bottom: top + b.width };
};

export function resize() {
  applyRot();
  const el = E.renderer.domElement.parentElement;
  const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight); // layout size: ignores the CSS turn
  E.w = w; E.h = h;
  // layout classes follow the app's OWN box (not the real viewport, which is portrait when turned)
  const app = document.getElementById('app');
  if (app) {
    app.classList.toggle('compact', h <= 520);
    app.classList.toggle('narrow', w <= 720);
    app.style.setProperty('--aw', w + 'px');
    app.style.setProperty('--ah', h + 'px');
  }
  E.renderer.setSize(w, h, false);
  E.camera.aspect = w / h;
  E.camera.updateProjectionMatrix();
  for (const f of E.onResize || []) f(w, h);
  E.holdDirty = true; // a resized canvas is blank until drawn again (also while paused)
}
E.onResize = new Set();

/** Fit a vertical fov so that a view of `halfW` x `halfH` world units at distance `dist` fits. */
export function fitFov(halfW, halfH, dist) {
  const aspect = E.camera.aspect;
  const needH = Math.max(halfH, halfW / aspect);
  return clamp((2 * Math.atan(needH / dist) * 180) / Math.PI, 20, 75);
}

/* ---------------- frame ---------------- */
let fpsAcc = 0, fpsN = 0;
function frame() {
  E.timer.update();
  const real = Math.min(E.timer.getDelta(), 0.05);
  fpsAcc += real; fpsN++;
  if (fpsAcc >= 1) { E.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  // paused: E.time stands still, nothing steps; the still picture is redrawn only after a resize (render on demand)
  if (E.hold) {
    if (E.holdDirty) { E.holdDirty = false; E.renderer.render(E.scene, E.camera); }
    return;
  }
  const dt = real * E.timeScale;
  E.time += dt;
  E.dt = dt;
  try {
    stepTweens(dt);
    if (E.sceneUpdate) E.sceneUpdate(dt);
    for (const f of E.onFrame) f(dt);
    if (E.shadowFocus) {
      const p = E.shadowFocus.getWorldPosition(new THREE.Vector3());
      E.sun.target.position.copy(p);
      E.sun.position.set(p.x + 5, p.y + 11, p.z + 6);
    }
  } catch (e) {
    if (window.__game.errors.length < 40) {
      window.__game.errors.push(String(e && e.stack || e));
      console.warn('[ra-l07] frame error', e);
    }
  }
  E.renderer.render(E.scene, E.camera);
}
