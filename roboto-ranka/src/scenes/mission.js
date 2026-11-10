// mission (the game): drive the robot around the park, grab 9 litter pieces, deliver each to the right bin.
// Follow camera ~50° down; joystick left, ✊ right; arrows/WASD + space. Fading hints (full the first time per kind,
// then only the material name). Wrong bin → shake, m_wrong, the right bin glows 3 s. m_3 / m_6 / m_done. Stars.
import * as THREE from '../three.js';
import { buildPark, addBins, makeLitter, scatterLitter, KINDS, BIN_POS, CAST_SPOTS, Flowers, BOUNDS } from '../world.js';
import { Robot } from '../robot.js';
import { makeKid } from '../chars.js';
import { DriveInput, Driver, FollowCam, autoDrive, seeThrough } from '../drive.js';
import { iconURL, SVG } from '../icons.js';
import { shuffle, rng } from '../util.js';
import { Sfx, Voice } from '../audio.js';

const ICON = { paper: 'paperBall', plastic: 'plastic', glass: 'glass' };
const GRAB_R = 1.35, BIN_R = 1.35, BIN_REARM = 2.2;
const START = new THREE.Vector3(0, 0, 3.6);

export async function enter(ctx) {
  const { E, UI, G, opts } = ctx;
  const park = buildPark(ctx.root);
  const obstacles = park.userData.obstacles;
  const bins = addBins(ctx.root, obstacles);
  const binObs = {};
  for (const k of KINDS) binObs[k] = obstacles.find((o) => o.x === BIN_POS[k][0] && o.z === BIN_POS[k][1]);
  const fx = ctx.fx();
  const flowers = new Flowers(ctx.root, 48);

  // the cast cheers from behind the bins
  const cast = ['leo', 'maja', 'neo'].map((k) => makeKid(k));
  cast.push(makeKid(G.avatar()));
  const spots = [CAST_SPOTS.leo, CAST_SPOTS.maja, CAST_SPOTS.neo, CAST_SPOTS.avatar];
  cast.forEach((kid, i) => {
    const [x, z] = spots[i];
    kid.group.position.set(x, 0, z); kid.face(0, 0);
    ctx.root.add(kid.group); fx.blobs.track(kid.group, 0.75);
    obstacles.push({ x, z, r: 0.6 });
  });

  // robot
  const robot = new Robot();
  robot.group.scale.setScalar(0.85);
  robot.group.position.copy(START);
  robot.group.rotation.y = Math.PI;
  robot.grip(1);
  ctx.root.add(robot.group);
  E.shadowFocus = robot.group;
  fx.blobs.track(robot.group, 1.0);
  const driver = new Driver(robot, obstacles);
  const cam = new FollowCam(robot.group);
  seeThrough(ctx, park.userData.tall, robot.group);

  // litter: random each play (seeded; ?seed= makes it repeatable for testing)
  const seedQ = new URLSearchParams(location.search).get('seed');
  const seed = seedQ ? +seedQ : (Date.now() % 100000);
  let pts = [];
  for (let s = seed; s < seed + 30 && pts.length < 9; s++) pts = scatterLitter(s, 9, obstacles, { avoid: [[START.x, START.z, 3.0]] });
  const kinds = shuffle(['paper', 'paper', 'paper', 'plastic', 'plastic', 'plastic', 'glass', 'glass', 'glass'], rng(seed + 1));
  const pieces = pts.map((p, i) => {
    const m = makeLitter(kinds[i], i);
    m.position.set(p.x, 0, p.z); m.rotation.y = p.rot;
    ctx.root.add(m);
    return { obj: m, kind: kinds[i], state: 'ground' };
  });
  window.__game.mission = { seed, pieces: pieces.length, layout: pts.map((p) => [+p.x.toFixed(2), +p.z.toFixed(2)]) };

  // a soft ring under the piece in reach
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 36), new THREE.MeshBasicMaterial({ color: 0x39e6e0, transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.visible = false; ctx.root.add(ring);

  /* ---------- UI ---------- */
  const counter = UI.add('', 'counter panel');
  const cslots = [];
  for (let i = 0; i < 9; i++) { const s = document.createElement('div'); s.className = 'c-slot'; counter.appendChild(s); cslots.push(s); }
  const cnum = document.createElement('div'); cnum.className = 'c-num'; cnum.textContent = '0 / 9'; counter.appendChild(cnum);
  const grabWrap = UI.add('', 'grab-wrap');
  const grabBtn = UI.button({ icon: 'fist', cls: 'main grab', label: 'Suimk', onClick: () => ctx.api.grab(), parent: grabWrap });
  const carryIco = document.createElement('div'); carryIco.className = 'carry-ico'; carryIco.hidden = true; grabWrap.appendChild(carryIco);
  const input = new DriveInput(ctx, { onAction: () => ctx.api.grab(), onTap: () => ctx.api.grab() });

  /* ---------- voice queue: praise/intro lines wait their turn; what the child just did is said NOW ---------- */
  let q = Promise.resolve(), gen = 0;
  const sayQ = (id) => { const g = gen; return (q = q.then(() => (g === gen ? ctx.say(id) : null))); };
  // cut whatever is playing or queued (e.g. the 14 s intro) and say this line at once
  const sayNow = (id) => { gen++; const p = ctx.say(id); q = p.then(() => null); return p; };

  /* ---------- state ---------- */
  let carrying = null, collected = 0, wrong = 0, finished = false, driveOn = true;
  const seen = new Set();
  const inZone = {};
  let nearPiece = null, glintT = 0, time = 0;
  const _c = new THREE.Vector3();

  // in reach = near the claws, or right under / beside the robot (forgiving for small hands)
  const nearest = () => {
    driver.clawPoint(_c);
    const rp = robot.group.position;
    let best = null, bd = Infinity;
    for (const p of pieces) {
      if (p.state !== 'ground') continue;
      const dc = Math.hypot(p.obj.position.x - _c.x, p.obj.position.z - _c.z);
      const db = Math.hypot(p.obj.position.x - rp.x, p.obj.position.z - rp.z);
      if ((dc < GRAB_R || db < 1.5) && Math.min(dc, db + 0.2) < bd) { bd = Math.min(dc, db + 0.2); best = p; }
    }
    return best;
  };
  ctx.api.near = () => !!nearest();

  ctx.api.grab = () => {
    if (finished) return;
    if (carrying) { robot.grip('hold'); Sfx.play('clack'); return; } // already holding: a squeeze
    const p = nearest();
    if (!p) { robot.grip(0); Sfx.play('clack'); setTimeout(() => robot.grip(1), 260 / E.timeScale); return; }
    p.state = 'held'; carrying = p;
    robot.grip('hold');
    Sfx.play('snap');
    robot.tip.attach(p.obj);
    const p0 = p.obj.position.clone(), s0 = p.obj.scale.x, r0 = p.obj.rotation.y;
    ctx.tween(0.3, (k) => { p.obj.position.lerpVectors(p0, new THREE.Vector3(0, -0.05, 0.05), k); p.obj.scale.setScalar(s0 + (1.2 - s0) * k); p.obj.rotation.y = r0 * (1 - k); });
    carryIco.innerHTML = `<img src="${iconURL(ICON[p.kind], 64)}" alt="">`; carryIco.hidden = false;
    grabBtn.classList.remove('pulse');
    const full = !seen.has(p.kind); seen.add(p.kind);
    sayNow(`m_${p.kind}${full ? '_full' : ''}`); // the sorting instruction must arrive while the piece is in the claws
    window.__game.lastPick = p.kind;
  };

  async function deliver(binKind) {
    const p = carrying, bin = bins[binKind];
    if (p.kind !== binKind) {
      // wrong bin: it shakes "no", the piece stays in the claws, the right bin glows
      wrong++;
      bin.shake(); Sfx.play('shake');
      bins[p.kind].glow(3);
      sayNow('m_wrong');
      return;
    }
    carrying = null; carryIco.hidden = true;
    p.state = 'binned';
    robot.grip(1);
    ctx.root.attach(p.obj);
    const p0 = p.obj.position.clone(), s0 = p.obj.scale.x;
    const tgt = bin.mouth.getWorldPosition(new THREE.Vector3()).setY(1.3);
    bin.flap(); Sfx.play('lid');
    await ctx.tween(0.5, (k, raw) => { p.obj.position.lerpVectors(p0, tgt, k); p.obj.position.y += Math.sin(raw * Math.PI) * 1.7; p.obj.scale.setScalar(s0 * (1 - 0.3 * k)); });
    p.obj.visible = false;
    Sfx.play('chime');
    fx.sparkles.pop(tgt.clone().setY(2.0), 10);
    collected++;
    const s = cslots[collected - 1];
    s.classList.add('fill'); s.innerHTML = `<img src="${iconURL(ICON[p.kind], 64)}" alt="">`;
    cnum.textContent = `${collected} / 9`;
    const kid = cast[(collected - 1) % cast.length]; kid.set('jump');
    window.__game.collected = collected;
    if (collected === 3) sayQ('m_3');
    else if (collected === 6) sayQ('m_6');
    else if (collected === 9) finish();
  }

  ctx.onUpdate((dt) => {
    time += dt;
    for (const k of cast) k.update(dt);
    for (const k of KINDS) bins[k].update(dt, time);
    flowers.update(dt);
    if (driveOn) driver.step(dt, input.get());
    else { robot.update(dt, 0); }
    cam.update(dt);
    // reach ring + pulsing ✊
    const np = carrying || finished ? null : nearest();
    if (np !== nearPiece) { nearPiece = np; grabBtn.classList.toggle('pulse', !!np); }
    ring.visible = !!np;
    if (np) { ring.position.x = np.obj.position.x; ring.position.z = np.obj.position.z; ring.scale.setScalar(1 + Math.sin(time * 6) * 0.08); }
    // bin zones: the claws must push into the bin (driving past a bin never counts); edge-triggered
    driver.clawPoint(_c);
    let hitBin = null;
    for (const k of KINDS) {
      const [bx, bz] = BIN_POS[k];
      const d = Math.hypot(_c.x - bx, _c.z - bz);
      if (d > BIN_REARM) inZone[k] = false;
      else if (d < BIN_R && !inZone[k] && carrying && !hitBin) { inZone[k] = true; hitBin = k; }
    }
    if (hitBin) deliver(hitBin);
    // glints on the remaining pieces
    glintT -= dt;
    if (glintT < 0) {
      glintT = 0.7;
      const left = pieces.filter((p) => p.state === 'ground');
      if (left.length) { const p = left[Math.floor(Math.random() * left.length)]; fx.sparkles.add(p.obj.position.clone().setY(0.8), { size: 1.0, life: 0.6, vy: 0.2 }); }
    }
  });

  async function finish() {
    finished = true;
    ctx.waiting = 'finished';
    grabBtn.classList.remove('pulse');
    const stars = wrong === 0 ? 3 : wrong <= 2 ? 2 : 1;
    G.session.stars = stars;
    G.state.bestStars = Math.max(G.state.bestStars || 0, stars);
    // the parent card reports the lesson run only: a replay from the robot room earns stars but leaves the report alone
    if (!opts.replay) G.state.last = Object.assign({}, G.state.last, { collected, wrongBins: wrong, stars });
    G.save();
    window.__game.lastStars = stars; window.__game.wrongBins = wrong;
    await q; // let m_3/m_6 finish
    driveOn = false; Sfx.hum(0);
    // the park brightens, flowers pop up, everyone cheers
    const h0 = E.hemi.intensity, s0 = E.sun.intensity;
    ctx.tween(1.5, (k) => { E.hemi.intensity = h0 + 0.45 * k; E.sun.intensity = s0 + 0.4 * k; });
    const fr = rng(seed + 7);
    const cols = [0xff6fae, 0xffd23f, 0xffffff, 0xff8c2a, 0xb98cff, 0x7fd0ff];
    for (let i = 0; i < 40; i++) {
      const x = BOUNDS.minX + 1 + fr() * (BOUNDS.maxX - BOUNDS.minX - 2), z = BOUNDS.minZ + 1 + fr() * (BOUNDS.maxZ - BOUNDS.minZ - 2);
      if (obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.4)) continue;
      flowers.add(x, z, cols[i % cols.length], 0.3 + fr() * 1.6, 1.2 + fr() * 0.5);
    }
    Sfx.play('fanfare');
    fx.confetti.burst(robot.group.position.clone().setY(2), 120, 2.6, 7);
    for (const k of cast) { k.face(robot.group.position.x, robot.group.position.z); k.set('cheer'); }
    robot.wiggle(1.6);
    await ctx.say('m_done');
    // stars
    const card = document.createElement('div');
    card.innerHTML = '<div class="stars"></div><div class="ov-row"></div>';
    const st = card.querySelector('.stars');
    for (let i = 0; i < 3; i++) { const s = document.createElement('div'); s.className = 'star'; s.innerHTML = SVG.starOff; st.appendChild(s); }
    const { close } = UI.overlay(card);
    for (let i = 0; i < stars; i++) {
      await ctx.wait(0.45);
      const s = st.children[i]; s.innerHTML = SVG.starOn; s.classList.add('slap'); Sfx.play('star');
    }
    await ctx.wait(0.4);
    const next = ctx.signal();
    ctx.api.next = () => next.fire();
    const btn = UI.button({ icon: opts.replay ? 'back' : 'next', cls: 'main go pop-in', label: opts.replay ? 'Atgal į robotų kambarį' : 'Toliau', onClick: () => { Sfx.play('click'); next.fire(); }, parent: card.querySelector('.ov-row') });
    btn.focus({ preventScroll: true });
    ctx.waiting = 'stars';
    await next.promise;
    close();
    G.go(opts.replay ? 'trophy' : 'break'); // the lesson's movement break comes before the quiz
  }

  /* ---------- intro ---------- */
  ctx.waiting = 'drive';
  if (!opts.replay) sayQ('m01');
  sayQ('m02');
  const stopIdle = ctx.idle(() => { input.hint.classList.remove('gone'); grabBtn.classList.add('pulse'); });
  ctx.cleanup(stopIdle);
  ctx.cleanup(() => Sfx.hum(0));

  // test hooks
  ctx.api.state = () => ({ collected, wrong, carrying: carrying && carrying.kind });
  ctx.api.driver = driver; ctx.api.input = input; ctx.api.pieces = pieces;
}

export async function auto(ctx) {
  await ctx.until(() => ctx.api.driver && ctx.waiting === 'drive');
  const { driver, input, pieces } = ctx.api;
  const robotPos = () => driver.robot.group.position;
  const obstacles = driver.obstacles;
  let triedWrong = false, guard = 0;
  const go = (goal, done, skip = []) => autoDrive(ctx, input, driver, goal, done, { skip });
  while (pieces.some((p) => p.state !== 'binned') && guard++ < 30) {
    const held = pieces.find((x) => x.state === 'held');
    const p = held || pieces.filter((x) => x.state === 'ground').sort((a, b) => robotPos().distanceTo(a.obj.position) - robotPos().distanceTo(b.obj.position))[0];
    if (!p) break;
    if (!held) {
      const at = p.obj.position.clone();
      await go(at, () => { const c = driver.clawPoint(); return Math.hypot(c.x - at.x, c.z - at.z) < 1.0 || ctx.api.near(); });
      ctx.api.grab();
      await ctx.wait(0.4);
      if (p.state !== 'held') continue;
    }
    const order = !triedWrong ? [KINDS.find((k) => k !== p.kind), p.kind] : [p.kind];
    triedWrong = true;
    for (const k of order) {
      const [bx, bz] = BIN_POS[k];
      const ob = obstacles.find((o) => o.x === bx && o.z === bz);
      const w0 = ctx.api.state().wrong;
      await go(new THREE.Vector3(bx, 0, bz), () => p.state === 'binned' || (k !== p.kind && ctx.api.state().wrong > w0), [ob]);
      await ctx.wait(0.3);
      if (k !== p.kind) { input.auto = { x: 0, y: 1 }; await ctx.wait(0.6); input.auto = { x: 0, y: 0 }; }
    }
    input.auto = { x: 0, y: 0 };
    const t0 = ctx.E.time;
    await ctx.until(() => p.state === 'binned' || ctx.E.time - t0 > 3);
  }
  input.auto = null;
  await ctx.until(() => ctx.waiting === 'stars');
  ctx.api.next();
}
