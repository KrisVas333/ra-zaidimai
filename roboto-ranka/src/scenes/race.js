// race („Lenktynės", replay): same park, 5 litter pieces each. Neo's yellow robot collects its own (unmarked)
// pieces slowly (~12 s per piece) so a 5-year-old usually wins. rc01 with 3-2-1. First to 5 → rc_win /
// rc_lose. Always friendly: then „again" or back to the robot room. The child's own pieces wear the aqua rings.
import * as THREE from '../three.js';
import { buildPark, addBins, makeLitter, scatterLitter, KINDS, BIN_POS } from '../world.js';
import { Robot } from '../robot.js';
import { makeKid } from '../chars.js';
import { DriveInput, Driver, steer, FollowCam, autoDrive, seeThrough } from '../drive.js';
import { iconURL } from '../icons.js';
import { rng, shuffle } from '../util.js';
import { Sfx, Voice } from '../audio.js';

const GRAB_R = 1.35, BIN_R = 1.35, BIN_REARM = 2.2, NEO_BIN_R = 2.15;

export async function enter(ctx) {
  const { E, UI, G } = ctx;
  const park = buildPark(ctx.root);
  const obstacles = park.userData.obstacles;
  const bins = addBins(ctx.root, obstacles);
  const fx = ctx.fx();
  G.session.raceRuns++;

  const neoKid = makeKid('neo'); neoKid.group.position.set(8.2, 0, -7.6); neoKid.face(0, 0); ctx.root.add(neoKid.group);
  obstacles.push({ x: 8.2, z: -7.6, r: 0.6 });
  fx.blobs.track(neoKid.group, 0.75);

  // robots
  const robot = new Robot();
  robot.group.scale.setScalar(0.85); robot.group.position.set(-2.2, 0, 4.2); robot.group.rotation.y = Math.PI;
  robot.grip(1); ctx.root.add(robot.group);
  E.shadowFocus = robot.group;
  const neo = new Robot({ hub: 0xffd23f, shadows: false });
  neo.group.scale.setScalar(0.85); neo.group.position.set(2.2, 0, 4.2); neo.group.rotation.y = Math.PI;
  neo.grip(1); ctx.root.add(neo.group);
  fx.blobs.track(robot.group, 1.0); fx.blobs.track(neo.group, 1.0);
  const driver = new Driver(robot, obstacles);
  const neoDrv = new Driver(neo, obstacles, { speed: 1.55, quiet: true });
  const cam = new FollowCam(robot.group);
  seeThrough(ctx, park.userData.tall, robot.group);

  // 10 pieces: Neo gets the 5 on the right, the child the other 5
  const seed = (Date.now() % 100000) + G.session.raceRuns * 17;
  let pts = [];
  for (let s = seed; s < seed + 30 && pts.length < 10; s++) pts = scatterLitter(s, 10, obstacles, { avoid: [[-2.2, 4.2, 2.6], [2.2, 4.2, 2.6]] });
  pts.sort((a, b) => a.x - b.x);
  const r = rng(seed + 3);
  const kindsA = shuffle(['paper', 'paper', 'plastic', 'plastic', 'glass'], r), kindsB = shuffle(['paper', 'plastic', 'plastic', 'glass', 'glass'], r);
  // the child's 5 pieces carry an aqua ring (the same colour as the mission's reach ring); Neo's 5 stay plain
  const ringGeo = new THREE.RingGeometry(0.5, 0.7, 28), ringMat = new THREE.MeshBasicMaterial({ color: 0x39e6e0, transparent: true, opacity: 0.85, depthWrite: false });
  const mine = [], neos = [];
  pts.forEach((p, i) => {
    const own = i < 5, kind = own ? kindsA[i] : kindsB[i - 5];
    const m = makeLitter(kind, i); m.position.set(p.x, 0, p.z); m.rotation.y = p.rot; ctx.root.add(m);
    const piece = { obj: m, kind, state: 'ground' };
    if (own) { const rg = new THREE.Mesh(ringGeo, ringMat); rg.rotation.x = -Math.PI / 2; rg.position.set(p.x, 0.035, p.z); ctx.root.add(rg); piece.ring = rg; mine.push(piece); }
    else neos.push(piece);
  });
  ctx.cleanup(() => { ringGeo.dispose(); ringMat.dispose(); });
  window.__game.raceRings = { mine: mine.filter((p) => p.ring).length, neo: neos.filter((p) => p.ring).length };

  /* ---------- UI ---------- */
  const score = UI.add(`<div class="who"><span class="face"><img src="${iconURL('eyes', 92)}" alt=""></span><span class="n-me">0</span></div><div class="vs">:</div><div class="who"><span class="n-neo">0</span><span class="face"><img src="img/neo.jpg" alt=""></span></div>`, 'score panel');
  const grabWrap = UI.add('', 'grab-wrap');
  const grabBtn = UI.button({ icon: 'fist', cls: 'main grab', label: 'Suimk', onClick: () => ctx.api.grab(), parent: grabWrap });
  const carryIco = document.createElement('div'); carryIco.className = 'carry-ico'; carryIco.hidden = true; grabWrap.appendChild(carryIco);
  const input = new DriveInput(ctx, { onAction: () => ctx.api.grab(), onTap: () => ctx.api.grab() });
  const ICON = { paper: 'paperBall', plastic: 'plastic', glass: 'glass' };

  let running = false, over = false, myScore = 0, neoScore = 0, carrying = null;
  const inZone = {};
  const _c = new THREE.Vector3();
  let q = Promise.resolve();
  const sayQ = (id) => (q = q.then(() => ctx.say(id)));

  const nearest = () => {
    driver.clawPoint(_c);
    const rp = robot.group.position;
    let best = null, bd = Infinity;
    for (const p of mine) {
      if (p.state !== 'ground') continue;
      const dc = Math.hypot(p.obj.position.x - _c.x, p.obj.position.z - _c.z), db = Math.hypot(p.obj.position.x - rp.x, p.obj.position.z - rp.z);
      if ((dc < GRAB_R || db < 1.5) && Math.min(dc, db + 0.2) < bd) { bd = Math.min(dc, db + 0.2); best = p; }
    }
    return best;
  };
  ctx.api.near = () => !!nearest();
  const attach = (rb, p) => {
    p.state = 'held'; rb.grip('hold'); rb.tip.attach(p.obj);
    const p0 = p.obj.position.clone(), s0 = p.obj.scale.x;
    ctx.tween(0.3, (k) => { p.obj.position.lerpVectors(p0, new THREE.Vector3(0, -0.05, 0.05), k); p.obj.scale.setScalar(s0 + (1.2 - s0) * k); });
  };
  const dropIn = async (rb, p, bin) => {
    p.state = 'binned'; rb.grip(1);
    ctx.root.attach(p.obj);
    const p0 = p.obj.position.clone(), tgt = bin.mouth.getWorldPosition(new THREE.Vector3()).setY(1.3);
    bin.flap(); Sfx.play('lid');
    await ctx.tween(0.45, (k, raw) => { p.obj.position.lerpVectors(p0, tgt, k); p.obj.position.y += Math.sin(raw * Math.PI) * 1.6; });
    p.obj.visible = false;
    fx.sparkles.pop(tgt.clone().setY(2), 8);
  };

  ctx.api.grab = () => {
    if (!running || over) return;
    if (carrying) { robot.grip('hold'); Sfx.play('clack'); return; }
    const p = nearest();
    if (!p) { robot.grip(0); Sfx.play('clack'); setTimeout(() => robot.grip(1), 260 / E.timeScale); return; }
    carrying = p; attach(robot, p); if (p.ring) p.ring.visible = false; Sfx.play('snap');
    carryIco.innerHTML = `<img src="${iconURL(ICON[p.kind], 64)}" alt="">`; carryIco.hidden = false;
    sayQ(`m_${p.kind}`);
  };
  async function deliver(k) {
    const p = carrying;
    if (p.kind !== k) { bins[k].shake(); Sfx.play('shake'); bins[p.kind].glow(3); sayQ('m_wrong'); return; }
    carrying = null; carryIco.hidden = true;
    await dropIn(robot, p, bins[k]);
    Sfx.play('chime');
    myScore++; score.querySelector('.n-me').textContent = myScore;
    if (myScore >= 5) end(true);
  }

  // Neo's robot: a slow, fixed routine (go to the next own piece → grab → right bin → drop)
  const neoAI = { i: 0, state: 'toPiece', pause: 0, stuck: 0, best: Infinity, side: 0, t0: 0, times: [] };
  function neoStep(dt) {
    const A = neoAI;
    if (A.pause > 0) { A.pause -= dt; neoDrv.step(dt, { x: 0, y: 0 }); return; }
    const p = neos[A.i];
    if (!p) { neoDrv.step(dt, { x: 0, y: 0 }); return; }
    let goal, skip = null;
    if (A.state === 'toPiece') goal = p.obj.position;
    else { const [bx, bz] = BIN_POS[p.kind]; goal = new THREE.Vector3(bx, 0, bz); skip = obstacles.find((o) => o.x === bx && o.z === bz); }
    const s = steer(neo.group.position, goal, skip ? obstacles.filter((o) => o !== skip) : obstacles);
    if (s.dist < A.best - 0.15) { A.best = s.dist; A.stuck = 0; } else A.stuck += dt;
    if (A.stuck > 1.5) { A.side = 0.9; A.stuck = 0; A.best = s.dist; }
    let v = { x: s.x, y: s.y };
    if (A.side > 0) { A.side -= dt; v = { x: -s.y, y: s.x }; }
    neoDrv.step(dt, v);
    if (A.state === 'toPiece') {
      const c = neoDrv.clawPoint();
      if (Math.hypot(c.x - p.obj.position.x, c.z - p.obj.position.z) < 0.9) {
        // a fixed, slow pace: never faster than ~5 s to a pick-up and ~12 s per delivered piece
        if (E.time - A.t0 < 5) { A.pause = 5 - (E.time - A.t0); return; }
        attach(neo, p);
        A.state = 'toBin'; A.pause = 1.2; A.best = Infinity;
      }
    } else {
      const [bx, bz] = BIN_POS[p.kind];
      if (Math.hypot(neo.group.position.x - bx, neo.group.position.z - bz) < NEO_BIN_R) {
        if (E.time - A.t0 < 11.5) { A.pause = 11.5 - (E.time - A.t0); return; }
        dropIn(neo, p, bins[p.kind]).then(() => {
          if (over) return;
          neoScore++; score.querySelector('.n-neo').textContent = neoScore;
          A.times.push(+(E.time - A.t0).toFixed(1)); A.t0 = E.time;
          window.__game.neoTimes = A.times;
          if (neoScore >= 5) end(false);
        });
        A.state = 'toPiece'; A.i++; A.pause = 1.4; A.best = Infinity;
      }
    }
  }

  ctx.onUpdate((dt) => {
    neoKid.update(dt);
    for (const k of KINDS) bins[k].update(dt, E.time);
    if (running && !over) { driver.step(dt, input.get()); neoStep(dt); }
    else { robot.update(dt, 0); neo.update(dt, 0); }
    cam.update(dt);
    const np = running && !over && !carrying ? nearest() : null;
    grabBtn.classList.toggle('pulse', !!np);
    // bin zones: the claws must push into the bin; edge-triggered
    driver.clawPoint(_c);
    let hitBin = null;
    for (const k of KINDS) {
      const [bx, bz] = BIN_POS[k];
      const d = Math.hypot(_c.x - bx, _c.z - bz);
      if (d > BIN_REARM) inZone[k] = false;
      else if (d < BIN_R && !inZone[k] && carrying && !over && !hitBin) { inZone[k] = true; hitBin = k; }
    }
    if (hitBin) deliver(hitBin);
  });

  async function end(won) {
    if (over) return;
    over = true; running = false; Sfx.hum(0);
    ctx.waiting = 'over';
    window.__game.raceResult = { won, me: myScore, neo: neoScore, neoTimes: neoAI.times };
    G.rec('race', { me: myScore, neo: neoScore });
    Sfx.play(won ? 'fanfare' : 'chime');
    fx.confetti.burst(robot.group.position.clone().setY(2), won ? 110 : 50, 2.4, 6);
    neoKid.set('cheer');
    robot.wiggle(1.4); neo.wiggle(1.4);
    await q;
    await ctx.say(won ? 'rc_win' : 'rc_lose');
    const card = document.createElement('div');
    card.innerHTML = `<div class="ov-row" style="margin-top:4px"></div>`;
    const { close } = UI.overlay(card);
    const row = card.querySelector('.ov-row');
    ctx.api.again = () => { close(); Sfx.play('click'); G.go('race'); };
    ctx.api.back = () => { close(); Sfx.play('click'); G.go('trophy'); };
    const again = UI.button({ icon: 'again', cls: 'main go pop-in', label: 'Dar kartą', onClick: ctx.api.again, parent: row });
    UI.button({ icon: 'trophy', cls: 'main pop-in', label: 'Atgal į robotų kambarį', onClick: ctx.api.back, parent: row });
    again.focus({ preventScroll: true });
    ctx.waiting = 'menu';
  }

  // 3-2-1 on the rc01 cues
  const t = Voice.lines.rc01.text;
  const at = (s, from = 0) => Math.max(0, t.indexOf(s, from) / t.length - 0.01);
  const big = (n) => () => { UI.floatNum(n, E.w / 2, E.h * 0.45); Sfx.play('tick'); };
  ctx.waiting = 'countdown';
  await ctx.say('rc01', { cues: [{ at: at('Trys'), fn: big('3') }, { at: at('du', t.indexOf('Trys')), fn: big('2') }, { at: at('vienas'), fn: big('1') }] });
  Sfx.play('go');
  UI.floatNum('!', E.w / 2, E.h * 0.45);
  running = true; neoAI.t0 = E.time;
  ctx.waiting = 'race';
  ctx.api.driver = driver; ctx.api.input = input; ctx.api.mine = mine; ctx.api.carrying = () => carrying;
  ctx.cleanup(() => Sfx.hum(0));
}

export async function auto(ctx) {
  await ctx.until(() => ctx.waiting === 'race' && ctx.api.driver);
  const { driver, input, mine } = ctx.api;
  const obstacles = driver.obstacles;
  const go = (goal, done, skip) => autoDrive(ctx, input, driver, goal, () => done() || ctx.waiting !== 'race', { skip: skip ? [skip] : [] });
  let guard = 0;
  while (ctx.waiting === 'race' && guard++ < 20) {
    const pos = driver.robot.group.position;
    const held = mine.find((x) => x.state === 'held');
    const p = held || mine.filter((x) => x.state === 'ground').sort((a, b) => pos.distanceTo(a.obj.position) - pos.distanceTo(b.obj.position))[0];
    if (!p) break;
    if (!held) {
      const at = p.obj.position.clone();
      await go(at, () => { const c = driver.clawPoint(); return Math.hypot(c.x - at.x, c.z - at.z) < 1.0 || ctx.api.near(); });
      ctx.api.grab();
      await ctx.wait(0.3);
      if (p.state !== 'held') continue;
    }
    const [bx, bz] = BIN_POS[p.kind];
    await go(new THREE.Vector3(bx, 0, bz), () => p.state === 'binned', obstacles.find((o) => o.x === bx && o.z === bz));
    await ctx.wait(0.2);
  }
  input.auto = null;
  await ctx.until(() => ctx.waiting === 'menu');
  await ctx.wait(0.3);
  ctx.api.back();
}
