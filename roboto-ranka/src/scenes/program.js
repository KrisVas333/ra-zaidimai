// program (the digital extra): a straight lane robot → paper ball → blue bin. 4 slots (slot 1 fixed ⬆),
// palette ⬆ ✊ ✋, a big green ▶. The robot honestly does what was written. Correct = ⬆ ✊ ⬆ ✋ → p_ok and the
// three blocks fly into the HUD pocket. Wrong → p_fail, slots 2–4 clear; after 2 fails p_hint + blocks pulse in order.
import * as THREE from '../three.js';
import { buildPark, Bin, makeLitter } from '../world.js';
import { Robot } from '../robot.js';
import { makeKid } from '../chars.js';
import { Kit, roundedBox as rb, M } from '../util.js';
import { fitFov } from '../engine.js';
import { Sfx, Voice } from '../audio.js';
import { block, BLOCK_LABEL } from '../ui.js';

const Z_START = 6.4, Z_PAPER = 1.6, Z_BIN = -4.6;
const REACH = 2.7; // claw tip distance in front of the robot centre
const ST = [Z_START, Z_PAPER + REACH - 0.05, Z_BIN + 0.62 + REACH + 0.15]; // robot z: start · at the paper · at the bin
const BASIC = ['drive', 'grab', 'drive', 'release'];
// programming challenges (from the learned-blocks board in the robot room): p = steps to the paper, b = steps to the bin
const CHALLENGES = [null,
  { p: 1, b: 2, prog: ['drive', 'grab', 'drive', 'release'] },
  { p: 2, b: 3, prog: ['drive', 'drive', 'grab', 'drive', 'release'] },
  { p: 1, b: 3, prog: ['drive', 'grab', 'drive', 'drive', 'release'] },
];
const STEP = 2.2; // one ⬆ = one tile

export async function enter(ctx) {
  const { E, UI, G, opts } = ctx;
  const chN = opts.challenge || 0, ch = CHALLENGES[chN] || null;
  const CORRECT = ch ? ch.prog : BASIC;
  const NSLOT = ch ? 5 : 4;
  const zAt = (i) => (ch ? Z_START - i * STEP : ST[i]); // robot z after i drive steps
  const maxPos = ch ? ch.b : 2;
  const tileZ = (k) => Z_START - REACH - k * STEP; // where the claws are after k steps (challenge tiles)
  buildPark(ctx.root);
  const fx = ctx.fx();

  // lane mat with dashes and a start line (challenge: step tiles instead of dashes, so steps can be counted)
  const lk = new Kit();
  lk.add(rb(2.5, 0.05, 14.4, 0.12), 0x5d5a86, [0, 0.025, 0.6]);
  if (!ch) for (let z = 6.6; z > -3.4; z -= 1.1) lk.add(rb(0.12, 0.02, 0.55, 0.01), 0xffffff, [0, 0.06, z]);
  lk.add(rb(2.5, 0.02, 0.16, 0.01), 0xffffff, [0, 0.06, Z_START + 1.0]);
  const lane = new THREE.Mesh(lk.geo(), M.toy); lane.receiveShadow = true; ctx.root.add(lane);
  const tiles = [];
  if (ch) {
    for (let k = 1; k <= ch.b; k++) {
      const m = new THREE.Mesh(rb(1.8, 0.05, 1.8, 0.12), new THREE.MeshStandardMaterial({ color: k % 2 ? 0x39e6e0 : 0xffffff, roughness: 0.7 }));
      m.position.set(0, 0.06, tileZ(k)); m.receiveShadow = true; m.userData.col = m.material.color.getHex();
      ctx.root.add(m); tiles.push(m);
    }
  }
  const flashTile = (k) => { const t = tiles[k - 1]; if (!t) return; t.material.color.setHex(0xffd23f); t.scale.set(1.08, 1, 1.08); Sfx.play('tick'); setTimeout(() => { t.material.color.setHex(t.userData.col); t.scale.set(1, 1, 1); }, 480 / E.timeScale); };

  const bin = new Bin('paper');
  bin.group.position.set(0, 0, ch ? zAt(ch.b) - REACH - 0.77 : Z_BIN); ctx.root.add(bin.group);

  const paper = makeLitter('paper', 1);
  const PAPER_HOME = new THREE.Vector3(0, 0, ch ? tileZ(ch.p) - 0.05 : Z_PAPER);
  paper.position.copy(PAPER_HOME); ctx.root.add(paper);
  let paperState = 'ground'; // ground | held | binned

  const robot = new Robot();
  robot.group.position.set(0, 0, Z_START); robot.group.rotation.y = Math.PI;
  robot.grip(1);
  ctx.root.add(robot.group);
  E.shadowFocus = robot.group;

  const kids = [['leo', -3.3, 2.6], ['neo', 3.4, 0.2], ['maja', -3.1, -2.2]].map(([k, x, z]) => {
    const kid = makeKid(k); kid.group.position.set(x, 0, z); kid.face(0, z); ctx.root.add(kid.group);
    fx.blobs.track(kid.group, 0.8);
    return kid;
  });

  let barEl = null;
  const _v = new THREE.Vector3();
  const yOf = (x, y, z) => { _v.set(x, y, z).project(E.camera); return ((1 - _v.y) / 2) * E.h; }; // app-local px
  const place = () => {
    // framed so the robot's start sits above the command bar and the bin below the caption
    E.camera.clearViewOffset();
    let hh = 6.1;
    E.camera.fov = fitFov(5.6, hh, 16.4); E.camera.updateProjectionMatrix();
    ctx.setCam(new THREE.Vector3(3.0, 7.6, 14.6), new THREE.Vector3(0, 0.0, 1.6));
    E.camera.updateMatrixWorld();
    const top = barEl ? E.rectOf(barEl).top : E.h; // app-local (the canvas fills #app)
    // fit the bin + the kids (top of the picture) and the robot's start (bottom) between the caption and the
    // command bar. Desktop: the caption sits under the 76 px HUD and is 2 lines (bottom ≈ 156). Phone landscape
    // (#app.compact): the caption rides in the HUD band and can wrap to 4 lines (≈ 112 px).
    const bandTop = E.h <= 520 ? 112 : 162, bandBot = top - 4;
    for (let i = 0; i < 3; i++) {
      const span = yOf(0, 0, Z_START + 1.0) - yOf(0, 2.3, Z_BIN);
      if (span <= bandBot - bandTop) break;
      hh *= span / (bandBot - bandTop) * 1.01;
      E.camera.fov = fitFov(5.6, hh, 16.4); E.camera.updateProjectionMatrix();
    }
    const d = Math.round(yOf(0, 2.3, Z_BIN) - bandTop);
    E.camera.setViewOffset(E.w, E.h, 0, d, E.w, E.h);
  };
  place();
  E.onResize.add(place); ctx.cleanup(() => { E.onResize.delete(place); E.camera.clearViewOffset(); });

  let lastZ = robot.group.position.z;
  ctx.onUpdate((dt) => {
    const z = robot.group.position.z, v = dt > 0 ? Math.abs(z - lastZ) / dt : 0; lastZ = z;
    robot.update(dt, v);
    bin.update(dt, E.time);
    for (const k of kids) k.update(dt);
  });

  /* ---------- program UI ---------- */
  const bar = UI.add('', 'prog-bar' + (ch ? ' ch' : ''));
  const pal = document.createElement('div'); pal.className = 'panel palette'; bar.appendChild(pal);
  const slotsWrap = document.createElement('div'); slotsWrap.className = 'panel slots'; bar.appendChild(slotsWrap);
  const runWrap = document.createElement('div'); bar.appendChild(runWrap);

  const palBtns = {};
  for (const kind of ['drive', 'grab', 'release']) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `blk ${kind}`;
    b.innerHTML = block(kind).innerHTML;
    b.setAttribute('aria-label', BLOCK_LABEL[kind]);
    b.addEventListener('click', (e) => { e.stopPropagation(); ctx.api.add(kind); });
    // real client px on purpose: only a distance and elementFromPoint use them (both work when the game is turned)
    b.addEventListener('pointerdown', (e) => { drag = { kind, x: e.clientX, y: e.clientY }; });
    pal.appendChild(b);
    palBtns[kind] = b;
  }
  // basic: 4 slots, slot 1 fixed ⬆ · challenge: up to 5 slots, nothing pre-filled
  const prog = ch ? Array(NSLOT).fill(null) : ['drive', null, null, null];
  const FIRST = ch ? 0 : 1; // first editable slot
  const slotEls = prog.map((_, i) => {
    if (i > 0) { const a = document.createElement('div'); a.className = 'arrow-sep'; slotsWrap.appendChild(a); }
    const s = document.createElement('button');
    s.type = 'button'; s.className = 'slot' + (i < FIRST ? ' fixed' : '');
    s.setAttribute('aria-label', `Vieta ${i + 1}`);
    s.dataset.i = i;
    s.innerHTML = `<span class="num">${i + 1}</span>`;
    s.addEventListener('click', (e) => { e.stopPropagation(); ctx.api.clear(i); });
    slotsWrap.appendChild(s);
    return s;
  });
  const runBtn = UI.button({ icon: 'play', cls: 'main go', label: 'Paleisk programą', onClick: () => ctx.api.run(), parent: runWrap });
  barEl = bar; place();

  const render = () => {
    slotEls.forEach((s, i) => {
      const old = s.querySelector('.blk'); if (old) old.remove();
      if (prog[i]) { const b = block(prog[i]); b.setAttribute('aria-hidden', 'true'); s.appendChild(b); }
      s.setAttribute('aria-label', `Vieta ${i + 1}${prog[i] ? ': ' + BLOCK_LABEL[prog[i]] : ''}`);
    });
    const full = ch ? prog.filter(Boolean).length >= CORRECT.length : prog.every(Boolean);
    runBtn.classList.toggle('pulse', full && !running && !solved);
    hintPulse();
  };
  const popSlot = (i) => { const b = slotEls[i].querySelector('.blk'); if (b) b.classList.add('pop-in'); };

  let drag = null, running = false, fails = 0, hintOn = false, solved = false;
  // drag a palette block onto a slot (tap works too)
  const onUp = (e) => {
    const d = drag; drag = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) < 24) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const s = el && el.closest && el.closest('.slot');
    if (s && +s.dataset.i >= FIRST) ctx.api.set(+s.dataset.i, d.kind);
  };
  window.addEventListener('pointerup', onUp); ctx.cleanup(() => window.removeEventListener('pointerup', onUp));

  const editable = () => !running && !solved;
  ctx.api.add = (kind) => {
    if (!editable()) return;
    const i = prog.findIndex((p, k) => k >= FIRST && !p);
    if (i < 0) { Sfx.play('oops'); return; }
    prog[i] = kind; Sfx.play('pop'); render(); popSlot(i);
    if (prog.every(Boolean)) runBtn.focus({ preventScroll: true });
  };
  ctx.api.set = (i, kind) => { if (!editable() || i < FIRST || i >= NSLOT) return; prog[i] = kind; Sfx.play('pop'); render(); popSlot(i); };
  ctx.api.clear = (i) => {
    if (!editable()) return;
    if (i < FIRST) { Sfx.play('oops'); slotEls[0].classList.add('wiggle'); setTimeout(() => slotEls[0].classList.remove('wiggle'), 520); return; }
    if (!prog[i]) return;
    prog[i] = null; Sfx.play('click'); render();
  };
  const runnable = () => (ch ? prog.some(Boolean) : prog.every(Boolean));
  ctx.onKey((e) => {
    const n = { 1: 'drive', 2: 'grab', 3: 'release' }[e.key];
    if (n) ctx.api.add(n);
    if (e.key === 'Backspace' || e.key === 'Delete') { for (let i = NSLOT - 1; i >= FIRST; i--) if (prog[i]) { ctx.api.clear(i); break; } }
    // Enter runs the program (a focused button keeps its own Enter)
    if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON' && runnable()) { e.preventDefault(); ctx.api.run(); }
  });

  function hintPulse() {
    for (const k in palBtns) palBtns[k].classList.remove('pulse');
    if (!hintOn || running || solved || ch) return;
    const i = prog.findIndex((p, k) => k > 0 && !p);
    if (i > 0) palBtns[CORRECT[i]].classList.add('pulse');
  }
  const lock = (on) => {
    for (const b of [...Object.values(palBtns), ...slotEls, runBtn]) b.disabled = on;
    bar.style.opacity = on ? 0.92 : 1;
  };

  /* ---------- honest execution ---------- */
  let pos = 0;
  const tipWorld = () => robot.tip.getWorldPosition(new THREE.Vector3());
  const moveTo = (z, dur) => {
    const z0 = robot.group.position.z;
    return ctx.tween(dur ?? Math.max(0.45, Math.abs(z - z0) / 3.2), (k) => { robot.group.position.z = z0 + (z - z0) * k; });
  };
  async function drive() {
    Sfx.hum(0.8);
    if (pos < maxPos) {
      const z1 = zAt(pos + 1);
      // a paper lying on the lane in the way rolls aside (the robot drives past it)
      if (paperState === 'ground' && Math.abs(paper.position.x) < 1 && paper.position.z > z1 - REACH + 0.5 && paper.position.z < robot.group.position.z) {
        const p0 = paper.position.clone();
        ctx.tween(0.7, (k, raw) => { paper.position.set(p0.x + 1.9 * k, Math.sin(raw * Math.PI) * 0.35, p0.z - 0.4 * k); paper.rotation.z = -k * 4; }, { delay: 0.15 });
      }
      await moveTo(z1);
      pos++;
    } else {
      // nothing left on the lane: it bumps into the bin
      await moveTo(zAt(pos) - 0.35, 0.3);
      bin.shake(); Sfx.play('shake');
      await moveTo(zAt(pos), 0.4);
    }
    Sfx.hum(0);
  }
  async function grab() {
    if (paperState === 'held') { robot.grip('hold'); Sfx.play('clack'); await ctx.wait(0.4); return; }
    if (!robot.isOpen()) { robot.grip(1); await ctx.wait(0.35); }
    const near = paperState === 'ground' && tipWorld().setY(0).distanceTo(paper.position) < 0.9;
    if (near) {
      robot.grip('hold');
      await ctx.wait(0.2);
      robot.tip.attach(paper);
      const p0 = paper.position.clone(), s0 = paper.scale.x;
      paperState = 'held';
      Sfx.play('snap');
      await ctx.tween(0.35, (k) => { paper.position.lerpVectors(p0, new THREE.Vector3(0, -0.14, 0.05), k); paper.scale.setScalar(s0 + (1.0 - s0) * k); });
    } else {
      robot.grip(0); // closes on air
      await ctx.wait(0.25);
      Sfx.play('clack');
      fx.sparkles.add(tipWorld().add(new THREE.Vector3(0, 0.3, 0)), { size: 0.6, life: 0.5, vy: 0.4 });
      await ctx.wait(0.3);
    }
  }
  async function release() {
    robot.grip(1); Sfx.play('click');
    if (paperState !== 'held') { await ctx.wait(0.5); return; }
    ctx.root.attach(paper);
    const p0 = paper.position.clone();
    if (pos === maxPos) {
      // into the bin: the piece hops in, the lid flaps
      const tgt = bin.mouth.getWorldPosition(new THREE.Vector3()).setY(1.2);
      bin.flap(); Sfx.play('lid');
      await ctx.tween(0.55, (k, raw) => { paper.position.lerpVectors(p0, tgt, k); paper.position.y += Math.sin(raw * Math.PI) * 1.6; });
      paper.visible = false; paperState = 'binned';
      Sfx.play('chime');
      fx.sparkles.pop(tgt.clone().setY(1.9), 10);
    } else {
      // drops on the lane / grass where it is
      await ctx.tween(0.35, (k) => { paper.position.y = p0.y * (1 - k); paper.scale.setScalar(1 + 0.25 * k); }, { ease: (t) => t * t });
      paper.position.y = 0; paperState = 'ground';
      Sfx.play('pop');
    }
    await ctx.wait(0.25);
  }
  const ACT = { drive, grab, release };

  async function resetWorld() {
    // the robot rolls back to the start, the paper goes back to its spot
    if (paperState === 'held') ctx.root.attach(paper);
    const pp = paper.position.clone();
    paper.visible = true;
    robot.grip(1);
    const z0 = robot.group.position.z;
    await ctx.tween(0.9, (k) => {
      robot.group.position.z = z0 + (Z_START - z0) * k;
      paper.position.lerpVectors(pp, PAPER_HOME, k); paper.position.y += Math.sin(k * Math.PI) * 0.8;
      paper.rotation.z *= 1 - k;
    });
    paper.position.copy(PAPER_HOME); paper.rotation.set(0, 0, 0); paper.scale.setScalar(1.25);
    paperState = 'ground'; pos = 0;
  }

  ctx.api.run = async () => {
    if (!editable()) return;
    if (!runnable()) { Sfx.play('oops'); runBtn.classList.remove('wiggle'); void runBtn.offsetWidth; runBtn.classList.add('wiggle'); return; }
    running = true; lock(true); render();
    ctx.waiting = 'running';
    Sfx.play('go');
    ctx.say('p_run');
    await ctx.wait(0.5);
    for (let i = 0; i < NSLOT; i++) {
      slotEls.forEach((s, k) => { const b = s.querySelector('.blk'); if (b) { b.classList.toggle('lit', k === i); b.classList.toggle('dim', k !== i); } });
      if (prog[i]) await ACT[prog[i]]();
      else await ctx.wait(0.35);
    }
    slotEls.forEach((s) => { const b = s.querySelector('.blk'); if (b) b.classList.remove('lit', 'dim'); });
    await ctx.until(() => !Voice.playing);
    if (paperState === 'binned') return success();
    // honest fail: nothing punishing, slots 2–4 clear
    fails++;
    if (ch) (window.__game.challenges ||= {})[chN] = { fails, solved: false };
    else window.__game.programFails = fails;
    Sfx.play('oops');
    await ctx.say('p_fail');
    for (let i = FIRST; i < NSLOT; i++) prog[i] = null;
    await resetWorld();
    running = false; lock(false);
    if (ch) {
      // count the steps: the tiles up to the paper light up one by one
      const t = (Voice.lines.pc_hint && Voice.lines.pc_hint.text.toLowerCase()) || '';
      const a0 = t.indexOf('žingsnius') >= 0 ? t.indexOf('žingsnius') / t.length : 0.2;
      ctx.say('pc_hint', { cues: Array.from({ length: ch.p }, (_, k) => ({ at: Math.min(0.9, a0 + k * 0.08), fn: () => flashTile(k + 1) })) });
    } else if (fails >= 2) {
      hintOn = true;
      const t = Voice.lines.p_hint.text.toLowerCase();
      const i1 = t.indexOf('važiuok'), i2 = t.indexOf('suimk'), i3 = t.indexOf('važiuok', i1 + 3), i4 = t.indexOf('paleisk');
      const flash = (kind) => () => { const b = palBtns[kind]; b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 520 / E.timeScale); Sfx.play('tick'); };
      ctx.say('p_hint', { cues: [[i1, 'drive'], [i2, 'grab'], [i3, 'drive'], [i4, 'release']].map(([i, k]) => ({ at: Math.max(0, i / t.length - 0.02), fn: flash(k) })) });
    }
    render();
    ctx.waiting = 'edit';
  };

  async function success() {
    solved = true;
    ctx.waiting = 'done';
    Sfx.play('fanfare');
    robot.wiggle(1.2);
    kids.forEach((k, i) => { k.face(0, bin.group.position.z); k.set(i === 1 ? 'jump' : 'cheer'); });
    fx.confetti.burst(new THREE.Vector3(0, 2.2, bin.group.position.z + 1), 70, 2, 6);
    if (ch) {
      // challenge solved: save the highest one, then the next challenge or back to the robot room after the third
      G.state.challenge = Math.max(G.state.challenge || 0, chN); G.save();
      (window.__game.challenges ||= {})[chN] = { fails, solved: true };
      await ctx.say('pc_ok');
      await ctx.wait(0.4);
      if (chN < 3) G.go('program', { challenge: chN + 1, intro: false }); else G.go('trophy');
      return;
    }
    const said = ctx.say('p_ok');
    await ctx.wait(0.6);
    // the three blocks fly into the "learned blocks" pocket in the HUD
    G.state.last = Object.assign({}, G.state.last, { programFails: fails });
    G.state.blocks = ['drive', 'grab', 'release'];
    G.save();
    UI.setPocket(G.state.blocks);
    const pocket = document.getElementById('pocket');
    const targets = [...pocket.children];
    targets.forEach((t) => (t.style.visibility = 'hidden'));
    const sources = [slotEls[0], slotEls[1], slotEls[3]].map((s) => s.querySelector('.blk'));
    const flights = sources.map((src, j) => {
      if (!src) return Promise.resolve();
      // app-local boxes; the flying copy lives inside #app so it turns with the game
      const a = E.rectOf(src);
      const t = targets[j] && E.rectOf(targets[j]);
      const b = t && t.width ? t : { left: E.w / 2 - 17, top: 10, width: 34, height: 34 };
      const c = src.cloneNode(true);
      c.classList.remove('lit', 'dim', 'pop-in');
      c.classList.add('fly');
      Object.assign(c.style, { position: 'absolute', left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', margin: 0, zIndex: 25, pointerEvents: 'none' });
      document.getElementById('app').appendChild(c);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2), s = b.width / a.width;
      const anim = c.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 80}px) scale(1.2)`, offset: 0.45 }, { transform: `translate(${dx}px,${dy}px) scale(${s})` }],
        { duration: 900 / E.timeScale, delay: (j * 160) / E.timeScale, easing: 'ease-in-out', fill: 'forwards' });
      return anim.finished.catch(() => {}).then(() => { c.remove(); if (targets[j]) targets[j].style.visibility = ''; Sfx.play('pop'); });
    });
    ctx.cleanup(() => document.querySelectorAll('#app > .blk.fly').forEach((n) => n.remove()));
    await ctx.guard(Promise.all(flights));
    targets.forEach((t) => (t.style.visibility = ''));
    await said;
    await ctx.wait(0.4);
    G.go('mission');
  }

  /* ---------- intro ---------- */
  lock(true);
  render();
  if (ch) {
    // a way back to the robot room (the same trophy picture as in the park)
    const tr = UI.add('', 'top-right');
    UI.button({ icon: 'trophy', cls: 'main', label: 'Atgal į robotų kambarį', onClick: () => { Sfx.play('click'); G.go('trophy'); }, parent: tr });
    // pc01 introduces the first challenge of a visit (later ones follow straight on); the tiles light up as it speaks
    if (opts.intro !== false) {
      const t = (Voice.lines.pc01 && Voice.lines.pc01.text.toLowerCase()) || '';
      const a0 = t.indexOf('kaip toli') >= 0 ? t.indexOf('kaip toli') / t.length : 0.25;
      await ctx.say('pc01', { cues: tiles.map((_, k) => ({ at: Math.min(0.9, a0 + k * 0.06), fn: () => flashTile(k + 1) })) });
    } else {
      // challenges 2 and 3 of the same visit: a short spoken start, so a child who cannot read knows a new task began
      const t = (Voice.lines.pc_next && Voice.lines.pc_next.text.toLowerCase()) || '';
      const a0 = t.indexOf('suskaičiuok') >= 0 ? t.indexOf('suskaičiuok') / t.length : 0.4;
      await ctx.say('pc_next', { cues: tiles.map((_, k) => ({ at: Math.min(0.92, a0 + k * 0.1), fn: () => flashTile(k + 1) })) });
    }
  } else {
    await ctx.say('p01');
    await ctx.say('p02');
  }
  lock(false);
  render();
  ctx.waiting = 'edit';
  palBtns.drive.focus({ preventScroll: true });
  const stopIdle = ctx.idle(() => { if (runnable() && (!ch || prog.filter(Boolean).length >= CORRECT.length)) runBtn.classList.add('pulse'); else palBtns[ch ? 'drive' : 'grab'].classList.add('pulse'); });
  ctx.cleanup(stopIdle);
  ctx.api.challenge = chN;
}

export async function auto(ctx) {
  const ready = () => ctx.until(() => ctx.waiting === 'edit' && !Voice.playing);
  const write = async (kinds) => { for (const k of kinds) { ctx.api.add(k); await ctx.wait(0.15); } };
  const chN = ctx.opts.challenge || 0;
  if (chN) {
    await ready();
    if (chN === 1) { await write(['drive', 'drive', 'grab', 'release']); ctx.api.run(); await ready(); } // too far: grabs air
    await write(CHALLENGES[chN].prog);
    ctx.api.run();
    return;
  }
  await ready();
  await write(['drive', 'grab', 'release']); // ⬆ ⬆ ✊ ✋: drives past the paper, grabs air at the bin
  ctx.api.run();
  await ready();
  await write(['grab', 'release', 'drive']); // ⬆ ✊ ✋ ⬆: grabs it, drops it again, drives on
  ctx.api.run();
  await ready();
  await write(['grab', 'drive', 'release']); // ⬆ ✊ ⬆ ✋
  ctx.api.run();
}
