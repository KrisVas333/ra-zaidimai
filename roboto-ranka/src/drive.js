// Driving: floating joystick (left), keyboard (arrows/WASD + space), soft collisions, follow camera.
import * as THREE from './three.js';
import { E } from './engine.js';
import { clamp, damp } from './util.js';
import { BOUNDS } from './world.js';
import { Sfx } from './audio.js';

/** Input: joystick + keys → vector {x, y} in screen space (y down) */
export class DriveInput {
  constructor(ctx, { onAction, onTap, tapAnywhere = false } = {}) {
    this.v = { x: 0, y: 0 };
    this.keys = new Set();
    this.joy = null;
    this.auto = null; // autoplay steering override {x, y}
    const canvas = E.renderer.domElement;
    const layer = document.getElementById('scene-ui');
    const base = document.createElement('div'); base.className = 'joy-base'; base.hidden = true;
    const knob = document.createElement('div'); knob.className = 'joy-knob'; base.appendChild(knob);
    layer.appendChild(base);
    this.hint = document.createElement('div'); this.hint.className = 'joy-hint'; layer.appendChild(this.hint);
    const R = 62;
    const down = (e) => {
      if (this.joy || e.button > 0) return;
      const { x, y } = E.pt(e); // app-local px (the canvas fills #app; correct when the game is turned)
      if (x > E.w * 0.58) { if (onTap) onTap(x, y); return; }
      this.joy = { id: e.pointerId, x0: x, y0: y, t0: performance.now(), moved: false };
      base.hidden = false; base.style.left = x + 'px'; base.style.top = y + 'px';
      knob.style.transform = 'translate(0,0)';
      this.hint.classList.add('gone');
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    };
    const move = (e) => {
      const j = this.joy; if (!j || e.pointerId !== j.id) return;
      const p = E.pt(e);
      let dx = p.x - j.x0, dy = p.y - j.y0;
      const d = Math.hypot(dx, dy);
      if (d > 10) j.moved = true;
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      this.v.x = d > 6 ? dx / R : 0;
      this.v.y = d > 6 ? dy / R : 0;
    };
    const up = (e) => {
      const j = this.joy; if (!j || e.pointerId !== j.id) return;
      if (!j.moved && performance.now() - j.t0 < 350 && tapAnywhere && onTap) onTap(j.x0, j.y0);
      this.joy = null; base.hidden = true; this.v.x = this.v.y = 0;
    };
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    const kd = (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { this.keys.add(k); e.preventDefault(); this.hint.classList.add('gone'); }
      if ((k === ' ' || k === 'enter') && !e.repeat && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); onAction && onAction(); }
      if (k === ' ' && document.activeElement?.tagName === 'BUTTON') { /* native click */ }
    };
    const ku = (e) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    ctx.cleanup(() => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    });
  }
  get() {
    if (this.auto) return this.auto;
    let x = this.v.x, y = this.v.y;
    const K = this.keys;
    if (K.size) {
      x = (K.has('arrowright') || K.has('d') ? 1 : 0) - (K.has('arrowleft') || K.has('a') ? 1 : 0);
      y = (K.has('arrowdown') || K.has('s') ? 1 : 0) - (K.has('arrowup') || K.has('w') ? 1 : 0);
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    }
    return { x, y };
  }
}

/** Moves a robot on the park plane with soft collisions. */
export class Driver {
  constructor(robot, obstacles, { speed = 4.6, radius = 0.85, quiet = false } = {}) {
    this.robot = robot; this.obstacles = obstacles; this.speed = speed; this.radius = radius; this.quiet = quiet;
    this.heading = robot.group.rotation.y;
    this.vel = 0;
  }
  step(dt, v) {
    const g = this.robot.group;
    const mag = Math.min(1, Math.hypot(v.x, v.y));
    let moved = 0;
    if (mag > 0.08) {
      const target = Math.atan2(v.x, v.y);
      let d = target - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += clamp(d, -9 * dt, 9 * dt);
      const sp = this.speed * mag * (Math.abs(d) > 1.6 ? 0.35 : 1);
      this.vel = damp(this.vel, sp, 10, dt);
    } else this.vel = damp(this.vel, 0, 12, dt);
    g.rotation.y = this.heading;
    const n = Math.max(1, Math.ceil((this.vel * dt) / 0.12));
    for (let i = 0; i < n; i++) {
      g.position.x += (Math.sin(this.heading) * this.vel * dt) / n;
      g.position.z += (Math.cos(this.heading) * this.vel * dt) / n;
      this.collide();
    }
    moved = this.vel;
    this.robot.update(dt, this.vel);
    if (!this.quiet) Sfx.hum(this.vel / this.speed);
    return moved;
  }
  collide() {
    const p = this.robot.group.position, R = this.radius;
    const push = (o) => {
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + R;
      if (d < m && d > 1e-6) { p.x = o.x + (dx / d) * m; p.z = o.z + (dz / d) * m; }
    };
    for (const o of this.obstacles) push(o);
    if (this.extra) for (const o of this.extra) push(o); // moving bodies (the child's figure ↔ its robot in the park)
    p.x = clamp(p.x, BOUNDS.minX + 0.4, BOUNDS.maxX - 0.4);
    p.z = clamp(p.z, BOUNDS.minZ + 1.0, BOUNDS.maxZ - 0.4); // never hide behind the bins / cast row
  }
  /** world point the claws reach (for grabbing) */
  clawPoint(out = new THREE.Vector3()) {
    const g = this.robot.group, s = g.scale.x;
    return out.set(g.position.x + Math.sin(this.heading) * 2.2 * s, 0, g.position.z + Math.cos(this.heading) * 2.2 * s);
  }
}

/** steering toward a goal with obstacle repulsion (autoplay + Neo's robot) */
export function steer(from, goal, obstacles, extra = 0.9) {
  let dx = goal.x - from.x, dz = goal.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d; dz /= d;
  let rx = 0, rz = 0;
  for (const o of obstacles) {
    const ox = from.x - o.x, oz = from.z - o.z, od = Math.hypot(ox, oz), reach = o.r + extra + 1.2;
    if (od < reach && od > 1e-6) {
      const w = (reach - od) / reach;
      rx += (ox / od) * w * 2.2; rz += (oz / od) * w * 2.2;
      // slide around: add a tangent component
      const side = Math.sign(dx * oz - dz * ox) || 1;
      rx += (-oz / od) * w * 1.4 * side; rz += (ox / od) * w * 1.4 * side;
    }
  }
  let x = dx + rx, z = dz + rz;
  const l = Math.hypot(x, z) || 1;
  return { x: x / l, y: z / l, dist: d };
}

/** autoplay helper: steer the player's robot through its real input until done() (game-time timeout) */
export function autoDrive(ctx, input, driver, goal, done, { skip = [], timeout = 40 } = {}) {
  let best = Infinity, stuck = 0, t = 0, tries = 0, detour = null, left = 0;
  return ctx.until(() => {
    const dt = E.dt || 0.016;
    t += dt;
    if (done() || t > timeout) { input.auto = { x: 0, y: 0 }; return true; }
    const obs = skip.length ? driver.obstacles.filter((o) => !skip.includes(o)) : driver.obstacles;
    const p = driver.robot.group.position;
    if (detour) {
      // stuck in a pocket (an obstacle right on the line to the goal): drive to a point beside and
      // a little behind, alternating sides and going wider each time, then try the goal again
      left -= dt;
      const d = steer(p, detour, obs);
      if (left > 0 && d.dist > 0.5) { input.auto = { x: d.x, y: d.y }; return false; }
      detour = null; best = Infinity; stuck = 0;
    }
    const s = steer(p, goal, obs);
    if (s.dist < best - 0.15) { best = s.dist; stuck = 0; } else stuck += dt;
    if (stuck > 1.0) {
      tries++; stuck = 0;
      const gx = goal.x - p.x, gz = goal.z - p.z, gl = Math.hypot(gx, gz) || 1;
      const sign = tries % 2 ? 1 : -1, wide = 2 + Math.min(tries, 5) * 0.8;
      detour = new THREE.Vector3(p.x + (-gz / gl) * sign * wide - (gx / gl) * 1.2, 0, p.z + (gx / gl) * sign * wide - (gz / gl) * 1.2);
      detour.x = clamp(detour.x, BOUNDS.minX + 1.2, BOUNDS.maxX - 1.2);
      detour.z = clamp(detour.z, BOUNDS.minZ + 1.6, BOUNDS.maxZ - 1.2);
      left = 1.2 + 0.4 * Math.min(tries, 5);
    }
    input.auto = { x: s.x, y: s.y };
    return false;
  });
}

/** see-through: fragments of `meshes` (trees, gazebo, swing) lying between the camera and `target`
 *  are cut away in a soft, dithered circle around the target, so a tree never hides the child's robot. */
export function seeThrough(ctx, meshes, target, { radius = 0.17, lift = 0.9 } = {}) {
  const uni = { uST: { value: new THREE.Vector3(-1e5, -1e5, 0) }, uSTR: { value: 1 } };
  const clones = new Map();
  for (const m of meshes) {
    if (!m || !m.material) continue;
    let mat = clones.get(m.material);
    if (!mat) {
      mat = m.material.clone();
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uST = uni.uST; sh.uniforms.uSTR = uni.uSTR;
        sh.fragmentShader = 'uniform vec3 uST;\nuniform float uSTR;\n' + sh.fragmentShader.replace('void main() {', `void main() {
  { float r = length(gl_FragCoord.xy - uST.xy) / uSTR;
    if (r < 1.0 && gl_FragCoord.z < uST.z) {
      if (r < 0.62 || mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard;
    } }`);
      };
      mat.customProgramCacheKey = () => 'see-through-v1';
      clones.set(m.material, mat);
    }
    m.material = mat;
  }
  const v = new THREE.Vector3(), buf = new THREE.Vector2();
  const f = () => {
    target.getWorldPosition(v); v.y += lift * target.scale.y;
    v.project(E.camera);
    E.renderer.getDrawingBufferSize(buf);
    uni.uST.value.set((v.x * 0.5 + 0.5) * buf.x, (v.y * 0.5 + 0.5) * buf.y, v.z * 0.5 + 0.5);
    uni.uSTR.value = buf.y * radius;
  };
  f();
  E.onFrame.add(f);
  ctx.cleanup(() => { E.onFrame.delete(f); for (const mat of clones.values()) mat.dispose(); });
}

/** follow camera, ~50° down, fixed orientation */
export class FollowCam {
  constructor(target, { dist = 13.5, pitch = 50, ahead = 4.2, back = 1.25 } = {}) {
    this.target = target; this.dist = dist; this.pitch = (pitch * Math.PI) / 180; this.ahead = ahead; this.back = back;
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3();
    this.snap();
  }
  goal() {
    // phone landscape (#app.compact): the caption rides in the HUD band, so pull back a little and look ahead
    // (north, toward the bins) so the bins show under that band from the start and the robot sits lower
    const compact = E.h <= 520;
    const a = E.camera.aspect, d = this.dist * (a < 1.25 ? 1.35 : a < 1.6 ? 1.1 : 1) * (compact ? this.back : 1);
    const t = this.target.position;
    const lx = clamp(t.x, BOUNDS.minX + 4, BOUNDS.maxX - 4), lz = clamp(t.z - (compact ? this.ahead : 0), BOUNDS.minZ + 2.5, BOUNDS.maxZ - 1);
    return { lx, lz, d };
  }
  snap() {
    const { lx, lz, d } = this.goal();
    this.look.set(lx, 0.5, lz);
    this.pos.set(lx, 0.5 + Math.sin(this.pitch) * d, lz + Math.cos(this.pitch) * d);
    this.apply();
  }
  update(dt) {
    const { lx, lz, d } = this.goal();
    const k = 1 - Math.exp(-4 * dt);
    this.look.x += (lx - this.look.x) * k; this.look.z += (lz - this.look.z) * k; this.look.y = 0.5;
    this.pos.set(this.look.x, 0.5 + Math.sin(this.pitch) * d, this.look.z + Math.cos(this.pitch) * d);
    this.apply();
  }
  apply() {
    E.camera.fov = E.h <= 520 ? 52 : 42; E.camera.updateProjectionMatrix();
    E.camera.position.copy(this.pos); E.camera.lookAt(this.look);
  }
}
