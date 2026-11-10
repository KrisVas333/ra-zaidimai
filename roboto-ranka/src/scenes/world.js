// world („Mano parkas", the sandbox). The child's own figure (the avatar) stands in the park and is what the
// joystick / WASD / arrows move; the robot follows it like a pet. One big round switch (bottom right, key R) swaps
// to driving the robot and back. 8 things to place (4 more unlock with sorting stars), an eraser, undo, max 40.
// w01 on the first visit. Saved in state.park.
import * as THREE from '../three.js';
import { buildPark, addBins, inBounds } from '../world.js';
import { Robot } from '../robot.js';
import { makeKid } from '../chars.js';
import { DriveInput, Driver, FollowCam, seeThrough, steer } from '../drive.js';
import { Kit, roundedBox as rb, M, clamp } from '../util.js';
import { iconURL, SVG } from '../icons.js';
import { Sfx, Voice } from '../audio.js';

const MAX = 40;
const TYPES = ['flower', 'tree', 'bush', 'bench', 'fence', 'lamp', 'birdhouse', 'pond'];
const LABEL = { flower: 'Gėlė', tree: 'Medis', bush: 'Krūmas', bench: 'Suolelis', fence: 'Tvora', lamp: 'Žibintas', birdhouse: 'Inkilas', pond: 'Tvenkinys' };
// unlocks tied to sorting accuracy in the mission (0 wrong bins = 3 stars, up to 2 wrong = 2 stars)
const NEED = { fence: 2, lamp: 2, birdhouse: 3, pond: 3 };
const OBST_R = { tree: 0.7, bush: 0.75, bench: 1.0, fence: 0.9, lamp: 0.35, birdhouse: 0.4 }; // the pond is flat: no obstacle
const FLOWER_COLS = [0xff6fae, 0xffd23f, 0xb98cff, 0xff8c2a, 0x7fd0ff, 0xffffff];
const KID_SPEED = 3.2, PET_GAP = 1.6, ERASE_R = 0.9;
const cyl = (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s);
const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
const sph = (r, a = 8, b = 6) => new THREE.SphereGeometry(r, a, b);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function geos() {
  const stem = new Kit().add(cyl(0.04, 0.04, 0.6, 6), 0x2f8f3c, [0, 0.3, 0]).add(sph(0.12), 0x46b852, [0.1, 0.22, 0], [0, 0, 0], [1.4, 0.4, 0.8]).geo();
  const hk = new Kit();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; hk.add(sph(0.13), 0xffffff, [Math.cos(a) * 0.16, 0.66, Math.sin(a) * 0.16], [0, 0, 0], [1, 0.6, 1]); }
  hk.add(sph(0.11), 0xfff1a8, [0, 0.69, 0]);
  const tk = new Kit();
  tk.add(cyl(0.2, 0.26, 1.5), 0x8a5a35, [0, 0.75, 0]);
  tk.add(ico(1.15), 0x4cb85a, [0, 2.15, 0], [0, 0, 0], 1, true);
  tk.add(ico(0.8), 0x5cc868, [0.55, 2.6, 0.2], [0, 0, 0], 1, true);
  tk.add(ico(0.75), 0x45a852, [-0.5, 2.5, -0.25], [0, 0, 0], 1, true);
  const bk = new Kit();
  bk.add(ico(0.7), 0x3f9f4e, [0, 0.45, 0], [0, 0, 0], [1.1, 0.8, 1], true);
  bk.add(ico(0.55), 0x4fb35c, [0.5, 0.4, 0.1], [0, 0, 0], [1, 0.8, 1], true);
  bk.add(ico(0.5), 0x46a855, [-0.5, 0.38, -0.1], [0, 0, 0], [1, 0.8, 1], true);
  const ck = new Kit();
  for (const dz of [-0.18, 0, 0.18]) ck.add(rb(2.0, 0.08, 0.16, 0.03), 0xd9813f, [0, 0.55, dz]);
  for (const dy of [0.82, 1.02]) ck.add(rb(2.0, 0.14, 0.07, 0.03), 0xd9813f, [0, dy, -0.3]);
  for (const sx of [-1, 1]) { ck.add(rb(0.1, 0.55, 0.5, 0.03), 0x4a4a58, [sx * 0.8, 0.27, 0]); ck.add(rb(0.1, 0.6, 0.08, 0.03), 0x4a4a58, [sx * 0.8, 0.8, -0.3]); }
  // new (round 2b): plain boxes / low cylinders so each stays at a few hundred triangles
  const fk = new Kit(); // fence piece: two posts, two rails, three pointed pickets
  for (const sx of [-1, 1]) fk.add(box(0.18, 1.05, 0.18), 0xe6a15a, [sx * 0.95, 0.52, 0]);
  for (const y of [0.36, 0.76]) fk.add(box(2.0, 0.12, 0.08), 0xe6a15a, [0, y, 0.02]);
  for (const x of [-0.5, 0, 0.5]) { fk.add(box(0.2, 0.86, 0.06), 0xf4ead3, [x, 0.48, 0.08]); fk.add(new THREE.ConeGeometry(0.14, 0.2, 4), 0xf4ead3, [x, 1.0, 0.08], [0, Math.PI / 4, 0], [1, 1, 0.4]); }
  const lk = new Kit(); // park lamp
  lk.add(cyl(0.22, 0.28, 0.2, 10), 0x3a3f5c, [0, 0.1, 0]);
  lk.add(cyl(0.07, 0.09, 2.3, 8), 0x3a3f5c, [0, 1.3, 0]);
  lk.add(box(0.46, 0.4, 0.46), 0xfff1a8, [0, 2.62, 0]);
  lk.add(new THREE.ConeGeometry(0.4, 0.3, 4), 0x3a3f5c, [0, 2.97, 0], [0, Math.PI / 4, 0]);
  lk.add(cyl(0.16, 0.12, 0.08, 8), 0x3a3f5c, [0, 2.39, 0]);
  const hb = new Kit(); // birdhouse on a pole
  hb.add(box(0.12, 1.6, 0.12), 0x8a5a35, [0, 0.8, 0]);
  hb.add(box(0.62, 0.62, 0.56), 0xff8c2a, [0, 1.86, 0]);
  for (const sx of [-1, 1]) hb.add(box(0.5, 0.07, 0.72), 0xd94a3c, [sx * 0.2, 2.3, 0], [0, 0, -sx * 0.72]);
  hb.add(cyl(0.11, 0.11, 0.04, 10), 0x2b1a5a, [0, 1.93, 0.28], [Math.PI / 2, 0, 0]);
  hb.add(cyl(0.025, 0.025, 0.18, 6), 0x8a5a35, [0, 1.72, 0.36], [Math.PI / 2, 0, 0]);
  const pk = new Kit(); // pond: flat water + a ring of stones + a lily pad
  pk.add(cyl(1.35, 1.35, 0.05, 20), 0x5ec8f0, [0, 0.03, 0], [0, 0, 0], [1, 1, 0.72]);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; pk.add(ico(0.17, 0), 0x9aa3ad, [Math.cos(a) * 1.42, 0.08, Math.sin(a) * 1.02], [i, i * 2, 0], [1.2, 0.7, 1], true); }
  pk.add(cyl(0.24, 0.24, 0.02, 8), 0x4caf50, [0.45, 0.065, 0.15]);
  return { stem, head: hk.geo(), tree: tk.geo(), bush: bk.geo(), bench: ck.geo(), fence: fk.geo(), lamp: lk.geo(), birdhouse: hb.geo(), pond: pk.geo() };
}

export async function enter(ctx) {
  const { E, UI, G } = ctx;
  const park = buildPark(ctx.root);
  const obstacles = park.userData.obstacles;
  addBins(ctx.root, obstacles);
  const staticObs = obstacles.slice();
  const fx = ctx.fx();

  // instanced placeables (9 draw calls for up to 40 things)
  const g = geos();
  const mk = (geo) => { const m = new THREE.InstancedMesh(geo, M.toy, MAX); m.count = 0; m.frustumCulled = false; m.castShadow = false; ctx.root.add(m); return m; };
  const IM = {}; for (const k in g) IM[k] = mk(g[k]);
  IM.head.setColorAt(0, new THREE.Color(1, 1, 1)); // allocate instanceColor
  window.__game.parkTris = Object.fromEntries(Object.entries(g).map(([k, ge]) => [k, (ge.index ? ge.index.count : ge.attributes.position.count) / 3]));

  let items = [];
  const live = () => items.filter((it) => !it.gone);
  const save = () => {
    G.state.park = live().map(({ t, x, z, r }) => ({ t, x: +x.toFixed(2), z: +z.toFixed(2), r: +r.toFixed(2) }));
    G.save();
  };
  const addObs = (it) => { if (OBST_R[it.t]) { it.obs = { x: it.x, z: it.z, r: OBST_R[it.t] }; obstacles.push(it.obs); } };
  const dropObs = (it) => { if (it.obs) { const i = obstacles.indexOf(it.obs); if (i >= 0) obstacles.splice(i, 1); it.obs = null; } };
  // load the saved park (validated; unknown types are skipped)
  for (const s of G.state.park || []) {
    if (items.length >= MAX) break;
    if (!s || !TYPES.includes(s.t) || !isFinite(s.x) || !isFinite(s.z) || !inBounds(s.x, s.z, 0.3)) continue;
    const it = { t: s.t, x: s.x, z: s.z, r: isFinite(s.r) ? s.r : 0, born: -99, c: items.length };
    items.push(it); addObs(it);
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const BASE = { flower: 1.5, tree: 0.95 };
  const rebuild = () => {
    const n = {}; for (const k in IM) n[k] = 0;
    for (let i = items.length - 1; i >= 0; i--) if (items[i].gone && E.time - items[i].gone > 0.32) items.splice(i, 1);
    for (const it of items) {
      let e;
      if (it.gone) e = Math.max(0.0001, 1 - (E.time - it.gone) / 0.3) * (1 + 0.25 * Math.sin(Math.min(1, (E.time - it.gone) / 0.3) * Math.PI)); // pop-out
      else { const k = clamp((E.time - it.born) / 0.5, 0, 1); e = k >= 1 ? 1 : Math.max(0.0001, 1 + Math.sin(k * Math.PI) * 0.35 * (1 - k) - (1 - k) ** 3); }
      const s = (BASE[it.t] || 1) * e;
      m4.compose(v.set(it.x, 0, it.z), q.setFromAxisAngle(up, it.r), sc.set(s, s, s));
      if (it.t === 'flower') {
        IM.stem.setMatrixAt(n.stem++, m4);
        IM.head.setMatrixAt(n.head, m4); IM.head.setColorAt(n.head++, col.set(FLOWER_COLS[it.c % FLOWER_COLS.length]));
      } else IM[it.t].setMatrixAt(n[it.t]++, m4);
    }
    for (const k in IM) { IM[k].count = n[k]; IM[k].instanceMatrix.needsUpdate = true; }
    if (IM.head.instanceColor) IM.head.instanceColor.needsUpdate = true;
  };

  /* ---------- the child's figure + the robot (its pet) ---------- */
  const kid = makeKid(G.avatar());
  kid.group.position.set(-1.0, 0, 3.0); kid.group.rotation.y = 0.35; // faces the child at the start
  ctx.root.add(kid.group);
  fx.blobs.track(kid.group, 0.8);
  const kidBody = { group: kid.group, update: (dt, vel) => { if (vel > 0.25) kid.set('walk'); else if (kid.anim === 'walk') kid.set('idle'); kid.update(dt); } };
  const kidDriver = new Driver(kidBody, obstacles, { speed: KID_SPEED, radius: 0.5, quiet: true });

  const robot = new Robot();
  robot.group.scale.setScalar(0.85);
  robot.group.position.set(1.0, 0, 4.4); robot.group.rotation.y = Math.PI;
  ctx.root.add(robot.group);
  fx.blobs.track(robot.group, 1.0);
  const driver = new Driver(robot, obstacles);
  // the two bodies push each other, never pass through
  const kidObs = { x: 0, z: 0, r: 0.45 }, robotObs = { x: 0, z: 0, r: 0.8 };
  driver.extra = [kidObs]; kidDriver.extra = [robotObs];

  let mode = 'walk', toggles = 0;
  const ctrl = () => (mode === 'walk' ? kid.group : robot.group);
  const focus = new THREE.Object3D(); ctx.root.add(focus); focus.position.copy(kid.group.position);
  E.shadowFocus = focus;
  // phone landscape: look only a little ahead, so the figure stays above the two-row palette
  const cam = new FollowCam(kid.group, { ahead: 0.6, back: 1.0 });
  seeThrough(ctx, park.userData.tall, focus);

  /* ---------- UI ---------- */
  let sel = 'flower', erasing = false;
  const pal = UI.add('', 'palette-w panel');
  const grid = document.createElement('div'); grid.className = 'pal-grid'; pal.appendChild(grid);
  const tools = document.createElement('div'); tools.className = 'pal-tools'; pal.appendChild(tools);
  const palBtns = {};
  const locked = (t) => (NEED[t] || 0) > (G.state.bestStars || 0);
  TYPES.forEach((t, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pal-btn' + (t === sel ? ' sel' : '');
    const lk = locked(t);
    b.setAttribute('aria-label', `${i + 1}: ${LABEL[t]}${lk ? ' (užrakinta)' : ''}`); b.setAttribute('aria-pressed', String(t === sel));
    b.innerHTML = `<img src="${iconURL(t, 112)}" alt="">`;
    if (lk) { // a lock and the stars it needs, no text
      b.classList.add('locked');
      b.insertAdjacentHTML('beforeend', `<span class="lk">${SVG.lock}</span><span class="need">${SVG.starOn.repeat(NEED[t])}</span>`);
    }
    b.addEventListener('click', (e) => { e.stopPropagation(); ctx.api.select(t); });
    grid.appendChild(b); palBtns[t] = b;
  });
  const eraseB = document.createElement('button');
  eraseB.type = 'button'; eraseB.className = 'pal-btn erase';
  eraseB.setAttribute('aria-label', 'Trintukas (klavišas E)'); eraseB.setAttribute('aria-pressed', 'false');
  eraseB.innerHTML = `<img src="${iconURL('eraser', 112)}" alt="">`;
  eraseB.addEventListener('click', (e) => { e.stopPropagation(); ctx.api.eraser(!erasing); });
  tools.appendChild(eraseB);
  const undoB = UI.button({ icon: 'undo', label: 'Atšaukti', onClick: () => ctx.api.undo(), parent: tools });
  const count = document.createElement('div'); count.className = 'pal-count'; pal.appendChild(count);
  const tr = UI.add('', 'top-right');
  const backB = UI.button({ icon: 'trophy', cls: 'main', label: 'Atgal į robotų kambarį', onClick: () => ctx.api.back(), parent: tr }); // not the undo arrow: two identical arrows confuse
  const sw = UI.add('', 'corner-br');
  const switchB = UI.button({ icon: 'robot', cls: 'main switch', label: '', onClick: () => ctx.api.toggle(), parent: sw });
  const setSwitch = () => {
    switchB.innerHTML = SVG[mode === 'walk' ? 'robot' : 'kid'];
    switchB.setAttribute('aria-label', mode === 'walk' ? 'Vairuoti robotą (klavišas R)' : 'Vaikščioti pačiam (klavišas R)');
    switchB.classList.toggle('driving', mode === 'drive');
  };
  setSwitch();
  const hist = [];
  const refresh = () => { count.textContent = `${live().length}/${MAX}`; undoB.disabled = !hist.length && !live().length; };
  refresh();

  ctx.api.select = (t) => {
    if (locked(t)) {
      const b = palBtns[t];
      Sfx.play('oops');
      b.classList.remove('wiggle'); void b.offsetWidth; b.classList.add('wiggle');
      // the stars come from the mission, and the way there is the robot-room button: it pulses once the voice has said so
      ctx.say(NEED[t] >= 3 ? 'w_lock3' : 'w_lock2').then(() => { backB.classList.add('pulse'); setTimeout(() => backB.classList.remove('pulse'), 5000); });
      return false;
    }
    sel = t; Sfx.play('click');
    if (erasing) ctx.api.eraser(false, true);
    for (const k in palBtns) { palBtns[k].classList.toggle('sel', k === t); palBtns[k].setAttribute('aria-pressed', String(k === t)); }
    return true;
  };
  ctx.api.eraser = (on, quiet = false) => {
    erasing = on;
    if (!quiet) Sfx.play('click');
    eraseB.classList.toggle('sel', on); eraseB.setAttribute('aria-pressed', String(on));
    for (const k in palBtns) palBtns[k].classList.toggle('sel', !on && k === sel);
  };
  const tooClose = (x, z) => {
    const rp = robot.group.position, kp = kid.group.position;
    return Math.hypot(x - rp.x, z - rp.z) < 1.1 || Math.hypot(x - kp.x, z - kp.z) < 0.8;
  };
  ctx.api.placeAt = (x, z) => {
    const bad = !inBounds(x, z, 0.6) || live().length >= MAX || tooClose(x, z) ||
      staticObs.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.35);
    if (bad) { Sfx.play('oops'); fx.sparkles.add(new THREE.Vector3(x, 0.4, z), { size: 0.6, life: 0.4 }); if (live().length >= MAX) count.classList.add('wiggle'); return false; }
    const it = { t: sel, x, z, r: Math.random() * Math.PI * 2, born: E.time, c: items.length };
    const c = cam.look;
    if (it.t === 'bench' || it.t === 'lamp' || it.t === 'birdhouse') it.r = Math.atan2(c.x - x, (c.z + 8) - z); // faces the child
    if (it.t === 'fence') it.r = 0; // in line, so pieces make a fence
    items.push(it); addObs(it); hist.push({ op: 'add', it });
    Sfx.play('pop');
    fx.sparkles.pop(new THREE.Vector3(x, 0.8, z), 6);
    save(); refresh();
    return true;
  };
  const eraseItem = (best) => {
    best.gone = E.time; dropObs(best); hist.push({ op: 'del', it: best });
    Sfx.play('pop'); Sfx.play('click');
    fx.sparkles.pop(new THREE.Vector3(best.x, 0.7, best.z), 8);
    save(); refresh();
    return true;
  };
  ctx.api.eraseAt = (x, z) => {
    let best = null, bd = ERASE_R;
    for (const it of live()) { const d = Math.hypot(it.x - x, it.z - z); if (d < bd) { bd = d; best = it; } }
    if (!best) { Sfx.play('oops'); fx.sparkles.add(new THREE.Vector3(x, 0.4, z), { size: 0.6, life: 0.4 }); return false; }
    return eraseItem(best);
  };
  // eraser taps: the child taps the thing they SEE (a tree's crown, a lamp's head), not the ground under its foot.
  // Every thing is tested at a few heights on screen; [height, half-width] in world units, after BASE scaling.
  const SEEN = { flower: [1.05, 0.45], tree: [2.9, 1.15], bush: [0.9, 0.9], bench: [1.1, 1.1], fence: [1.1, 1.1], lamp: [3.0, 0.5], birdhouse: [2.3, 0.5], pond: [0.1, 1.3] };
  const pA = new THREE.Vector3(), pB = new THREE.Vector3();
  const onScreen = (p) => { p.project(E.camera); return [((p.x + 1) / 2) * E.w, ((1 - p.y) / 2) * E.h]; };
  const pickSeen = (x, y) => {
    let best = null, bs = 1;
    for (const it of live()) {
      const [h, r] = SEEN[it.t] || [1, 0.6];
      const n = Math.max(1, Math.ceil(h / r));
      for (let i = 0; i <= n; i++) {
        const yy = (h * i) / n;
        const [ax, ay] = onScreen(pA.set(it.x, yy, it.z));
        if (pA.z > 1) continue; // behind the camera
        const [bx, by] = onScreen(pB.set(it.x, yy + 1, it.z));
        const unit = Math.hypot(bx - ax, by - ay); // pixels per world unit at this spot
        const s = Math.hypot(ax - x, ay - y) / Math.max(40, r * unit); // 1 = the edge of what is seen (never under 40 px)
        if (s < bs) { bs = s; best = it; }
      }
    }
    return best;
  };
  ctx.api.eraseSeen = (x, y) => { const it = pickSeen(x, y); return it ? eraseItem(it) : false; };
  ctx.api.useAt = (x, z) => (erasing ? ctx.api.eraseAt(x, z) : ctx.api.placeAt(x, z));
  ctx.api.undo = () => {
    const h = hist.pop();
    if (h && h.op === 'del') { // bring an erased thing back
      const it = h.it; it.gone = 0; it.born = E.time;
      if (!items.includes(it)) items.push(it);
      addObs(it);
    } else {
      const it = h ? h.it : live().pop();
      if (!it) return;
      it.gone = E.time; dropObs(it);
    }
    Sfx.play('click');
    save(); refresh();
  };
  ctx.api.back = () => { Sfx.play('click'); G.go('trophy'); };
  ctx.api.toggle = () => {
    mode = mode === 'walk' ? 'drive' : 'walk';
    toggles++;
    Sfx.play('pop');
    cam.target = ctrl();
    setSwitch();
    switchB.classList.remove('pulse');
    if (mode === 'drive') robot.wiggle(0.6); else kid.set('jump');
    window.__game.worldMode = mode;
  };

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const tapGround = (x, y) => {
    if (erasing && ctx.api.eraseSeen(x, y)) return;
    ndc.set((x / E.w) * 2 - 1, -(y / E.h) * 2 + 1);
    ray.setFromCamera(ndc, E.camera);
    if (ray.ray.intersectPlane(plane, hit)) ctx.api.useAt(hit.x, hit.z);
  };
  // the place in front of whoever is controlled: the child's hands (1.2 ahead) or the robot's claws
  ctx.api.front = () => {
    if (mode === 'drive') return driver.clawPoint();
    const p = kid.group.position, h = kidDriver.heading;
    return new THREE.Vector3(p.x + Math.sin(h) * 1.2, 0, p.z + Math.cos(h) * 1.2);
  };
  const input = new DriveInput(ctx, { tapAnywhere: true, onTap: tapGround, onAction: () => { const c = ctx.api.front(); ctx.api.useAt(c.x, c.z); } });
  ctx.onKey((e) => {
    const n = parseInt(e.key, 10); if (n >= 1 && n <= TYPES.length) ctx.api.select(TYPES[n - 1]);
    const k = e.key.toLowerCase();
    if (k === 'r' && !e.repeat) ctx.api.toggle();
    if (k === 'e' && !e.repeat) ctx.api.eraser(!erasing);
    if (e.key === 'Backspace' || e.key === 'Delete') ctx.api.undo();
  });

  const still = { x: 0, y: 0 };
  ctx.onUpdate((dt) => {
    const iv = input.get();
    const kp = kid.group.position, rp = robot.group.position;
    kidObs.x = kp.x; kidObs.z = kp.z; robotObs.x = rp.x; robotObs.z = rp.z;
    if (mode === 'walk') {
      kidDriver.step(dt, iv);
      // the robot follows like a pet and stops about 1.6 away (no hum while it stands)
      const d = Math.hypot(kp.x - rp.x, kp.z - rp.z);
      let pv = still;
      if (d > PET_GAP) { const s = steer(rp, kp, obstacles); const k = clamp((d - PET_GAP) / 1.4, 0.25, 1); pv = { x: s.x * k, y: s.y * k }; }
      driver.step(dt, pv);
    } else {
      driver.step(dt, iv);
      kidDriver.step(dt, still);
      // the child's figure stays where it was left and turns to watch the robot
      let dd = Math.atan2(rp.x - kp.x, rp.z - kp.z) - kidDriver.heading;
      dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      kidDriver.heading += clamp(dd, -5 * dt, 5 * dt); kid.group.rotation.y = kidDriver.heading;
    }
    focus.position.copy(ctrl().position);
    cam.update(dt);
    rebuild();
  });
  ctx.cleanup(() => Sfx.hum(0));
  // a calm moment for a due movement break (main.js): nothing spoken, nothing held, no menu open, hands off for 2 s
  ctx.calm = () => !Voice.playing && !UI.hasOverlay() && !input.joy && !input.keys.size && !input.auto &&
    E.time - G.lastInput > 2 && driver.vel < 0.3 && kidDriver.vel < 0.3;

  ctx.waiting = 'play';
  if (!G.session.worldVisited) {
    // „... Nori pavažinėti? Paspausk roboto mygtuką." → the switch pulses during that last sentence
    const t = (Voice.lines.w01 && Voice.lines.w01.text) || '';
    const at = t ? Math.max(0, t.indexOf('Nori') / t.length - 0.02) : 0.6;
    let stopT = null;
    ctx.say('w01', { cues: [{ at, fn: () => { if (!toggles) switchB.classList.add('pulse'); } }] }).then(() => {
      stopT = setTimeout(() => switchB.classList.remove('pulse'), 5000 / E.timeScale);
    });
    ctx.cleanup(() => clearTimeout(stopT));
  }
  G.session.worldVisited = true;
  ctx.api.input = input; ctx.api.driver = driver; ctx.api.kidDriver = kidDriver;
  ctx.api.items = () => live().length;
  ctx.api.mode = () => mode;
  ctx.api.locked = locked;
  ctx.api.types = TYPES;
  // QA probe: app-px rectangles of the palette, its buttons, the switch, the trophy button and the joystick hint
  window.__game.worldLayout = () => {
    const r = (el) => { const b = E.rectOf(el); return [b.left, b.top, b.right, b.bottom].map(Math.round); };
    const sp = (o, y) => { const p = o.position.clone(); p.y += y; p.project(E.camera); return [Math.round((p.x + 1) / 2 * E.w), Math.round((1 - p.y) / 2 * E.h)]; };
    return { w: E.w, h: E.h, pal: r(pal), btns: [...grid.children, eraseB, undoB].map(r), sw: r(switchB), trophy: r(tr.firstChild), joy: r(input.hint), mode, kidFeetHead: [sp(kid.group, 0), sp(kid.group, 2.4)], robot: sp(robot.group, 0.5) };
  };
}

export async function auto(ctx) {
  await ctx.until(() => ctx.waiting === 'play' && ctx.api.input);
  await ctx.until(() => !Voice.playing);
  const { input, driver, kidDriver } = ctx.api;
  const before = ctx.api.items();
  const g = window.__game;
  // 1 · walk the child's figure
  const k0 = kidDriver.robot.group.position.clone();
  input.auto = { x: 0.5, y: -0.85 }; await ctx.wait(1.1);
  input.auto = { x: 0, y: 0 }; await ctx.wait(0.3);
  const kidMoved = +kidDriver.robot.group.position.distanceTo(k0).toFixed(2);
  // 2 · one of each unlocked type, a tap on a locked one, then erase one
  const spots = [];
  for (let z = -2; z <= 6; z += 2) for (let x = -8; x <= 8; x += 2.5) spots.push([x, z]);
  const placedTypes = []; let lastPlaced = null;
  for (const t of ctx.api.types) {
    if (ctx.api.locked(t)) continue;
    ctx.api.select(t);
    while (spots.length) { const [x, z] = spots.shift(); if (ctx.api.placeAt(x, z)) { placedTypes.push(t); lastPlaced = [x, z]; break; } }
    await ctx.wait(0.2);
  }
  const lockedType = ctx.api.types.find((t) => ctx.api.locked(t)) || null;
  if (lockedType) { ctx.api.select(lockedType); await ctx.wait(0.3); await ctx.until(() => !Voice.playing); }
  ctx.api.eraser(true);
  const erased = lastPlaced ? ctx.api.eraseAt(lastPlaced[0], lastPlaced[1]) : false;
  await ctx.wait(0.4);
  ctx.api.eraser(false);
  ctx.api.undo(); // brings the erased one back
  await ctx.wait(0.2);
  ctx.api.undo(); // and takes it away again (the last placed thing)
  // 3 · switch, drive the robot, switch back
  ctx.api.toggle();
  const r0 = driver.robot.group.position.clone();
  input.auto = { x: -0.7, y: 0.6 }; await ctx.wait(1.1);
  input.auto = { x: 0, y: 0 }; await ctx.wait(0.3);
  const robotMoved = +driver.robot.group.position.distanceTo(r0).toFixed(2);
  ctx.api.toggle();
  input.auto = null;
  g.worldWalk = { kidMoved, robotMoved, toggles: 2, mode: ctx.api.mode() };
  g.worldPark = { placedTypes, lockedTapped: lockedType, erased, items: ctx.api.items() };
  g.worldPlaced = ctx.api.items() - before;
  await ctx.wait(0.4);
  ctx.api.back();
}
