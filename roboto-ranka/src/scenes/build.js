// build: 10 placements in 3 chapters. Ghost shows where the next part goes; a tray of 3 candidates;
// wrong → wobble back (b_wrong1, then b_wrong2; after 2 wrong the right part pulses); 7-hole counting hint (b21_hint);
// two "stop and look" moments (spin the chassis · open/close the pincers); b33 the arm flies on; b3_done party.
import * as THREE from '../three.js';
import { buildTable } from '../world.js';
import { Robot, makePart, makeBeamPart, ROBOT_COLORS, HOLE } from '../robot.js';
import { M, Ease, shuffle, rng, deg, disposeTree } from '../util.js';
import { fitFov, setBackdrop } from '../engine.js';
import { Sfx, Voice } from '../audio.js';

const PRAISE = ['ok1', 'ok2', 'ok3', 'ok4'];

/** bounding box of the visible meshes only (hidden sub-parts must not shift the centre) */
function visBox(obj) {
  const b = new THREE.Box3(), tmp = new THREE.Box3();
  obj.updateMatrixWorld(true);
  obj.traverseVisible((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    b.union(tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  return b;
}

export async function enter(ctx) {
  const { E, UI, G } = ctx;
  setBackdrop('studio');
  E.hemi.intensity = 1.5;
  buildTable(ctx.root);
  const fx = ctx.fx();
  const r = rng((Date.now() & 0xffff) + 5);

  /* ---------- robot (all parts hidden; arm built separately on the table) ---------- */
  const robot = new Robot();
  robot.group.position.set(0, 0.05, 0.1);
  robot.group.rotation.y = -0.55;
  ctx.root.add(robot.group);
  E.shadowFocus = robot.group;
  const arm = robot.arm;
  ctx.root.add(arm);
  arm.position.set(1.15, 0.13, 0.45); arm.rotation.set(0, Math.PI / 2, 0);
  const allParts = [robot.hub, robot.wheels[0], robot.wheels[1], robot.skid, robot.beamA, robot.beamB, robot.clawA, robot.clawB, robot.pin, robot.band];
  for (const p of allParts) { p.visible = false; p.userData.part = true; }
  robot.a = robot.aTarget = deg(14); robot.applyGrip();
  ctx.onUpdate((dt) => robot.update(dt));

  /* ---------- camera views ---------- */
  const views = {
    ch1: { pos: new THREE.Vector3(0.0, 3.5, 5.9), look: new THREE.Vector3(0, 0.62, 0.1), hw: 2.6, hh: 1.9, d: 6 },
    ch2: { pos: new THREE.Vector3(0.1, 4.6, 6.2), look: new THREE.Vector3(0.2, 0.35, 0.3), hw: 3.5, hh: 2.3, d: 7.4 },
    end: { pos: new THREE.Vector3(0.0, 3.0, 6.4), look: new THREE.Vector3(0, 0.8, 0.4), hw: 3.0, hh: 1.9, d: 6.4 },
  };
  let view = views.ch1;
  const setFov = () => { E.camera.fov = fitFov(view.hw, view.hh + 1.0, view.d); E.camera.updateProjectionMatrix(); layoutTray(); };
  const goView = (v, dur = 1.2) => { view = v; setFov(); return ctx.camTo(v.pos, v.look, dur); };
  ctx.setCam(new THREE.Vector3(0, 6, 9), views.ch1.look);

  /* ---------- tray in camera space ---------- */
  // laid out at a virtual distance of 4.6 and scaled by 0.5, so it floats in front of the table at the same screen size
  const tray = new THREE.Group(); tray.scale.setScalar(0.5); tray.visible = false; E.camera.add(tray);
  const TRAY_D = 4.6;
  const padMat = new THREE.MeshBasicMaterial({ color: 0x2b1a5a, transparent: true, opacity: 0.82, depthWrite: false });
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x39e6e0 });
  ctx.cleanup(() => { E.camera.remove(tray); disposeTree(tray); padMat.dispose(); rimMat.dispose(); });
  const slots = [0, 1, 2].map(() => {
    const s = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.7, 40), padMat); pad.position.z = -0.6; pad.renderOrder = -2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.035, 8, 48), rimMat); rim.position.z = -0.6;
    s.add(pad, rim); tray.add(s);
    return s;
  });
  let spacing = 1.8, trayWide = false;
  function layoutTray() {
    const hh = TRAY_D * Math.tan(((E.camera.fov / 2) * Math.PI) / 180), hw = hh * E.camera.aspect;
    spacing = Math.min(trayWide ? 2.4 : 1.85, hw * (trayWide ? 0.62 : 0.5));
    const k = trayWide ? spacing / 2.2 : Math.min(1, spacing / 1.7);
    const y = -hh + Math.max(0.7 * k + 0.14, Math.min(0.95, hh * 0.36)); // whole circle stays on screen (phone landscape)
    slots.forEach((s, i) => { s.position.set((i - 1) * spacing, y, -TRAY_D); s.scale.setScalar(k); });
  }
  setFov();
  E.onResize.add(setFov); ctx.cleanup(() => E.onResize.delete(setFov));

  /* ---------- ghost ---------- */
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x39e6e0, transparent: true, opacity: 0.4, depthWrite: false });
  ctx.cleanup(() => ghostMat.dispose());
  let ghosts = [];
  const clearGhost = () => { for (const gm of ghosts) ctx.root.remove(gm); ghosts = []; };
  const showGhost = (target) => {
    clearGhost();
    ctx.root.updateMatrixWorld(true);
    const meshes = target.isMesh ? [target] : target.children.filter((c) => c.isMesh && !c.userData.part);
    for (const m of meshes) {
      const gm = new THREE.Mesh(m.geometry, ghostMat);
      gm.matrixAutoUpdate = false;
      gm.matrix.copy(m.matrixWorld).multiply(new THREE.Matrix4().makeScale(1.04, 1.04, 1.04));
      gm.renderOrder = 3;
      gm.userData.ghost = true;
      ctx.root.add(gm); ghosts.push(gm);
    }
  };
  ctx.onUpdate(() => { ghostMat.opacity = 0.28 + (Math.sin(E.time * 4) * 0.5 + 0.5) * 0.32; });

  /* ---------- step UI ---------- */
  const sb = UI.add('<div class="step-num">1</div><div class="step-x2" hidden>2×</div><div class="chapters"><span></span><span></span><span></span></div>', 'stepbox');
  const setStep = (n, x2, ch) => {
    sb.querySelector('.step-num').textContent = n;
    const b = sb.querySelector('.step-x2'); b.hidden = !x2; if (x2) b.textContent = x2;
    [...sb.querySelectorAll('.chapters span')].forEach((s, i) => (s.className = i + 1 < ch ? 'done' : i + 1 === ch ? 'on' : ''));
  };

  /* ---------- tray content ---------- */
  let trayItems = [];
  const display = (kind, correctTarget) => {
    let inner;
    if (correctTarget) {
      inner = correctTarget.clone(true);
      inner.visible = true;
      inner.traverse((o) => { if (o !== inner && o.userData.part) o.visible = false; });
      inner.position.set(0, 0, 0); inner.rotation.set(0, 0, 0); inner.scale.set(1, 1, 1);
    } else if (kind.startsWith('beam')) {
      inner = makeBeamPart(+kind[4], kind.endsWith('o') ? ROBOT_COLORS.orange : ROBOT_COLORS.green);
      inner.children[0].rotation.y = 0;
    } else inner = makePart(kind);
    inner.traverse((o) => { o.castShadow = false; });
    return inner;
  };
  let dragFrom = null;
  const fillTray = (step, targetIdx) => {
    clearTray();
    trayWide = !!step.count;
    layoutTray();
    const kinds = shuffle(step.tray.slice(), r);
    kinds.forEach((kind, i) => {
      const correct = kind === step.part;
      const target = correct ? step.targets()[targetIdx] : null;
      const inner = display(kind, target);
      const wrap = new THREE.Group();
      const box = visBox(inner);
      inner.position.sub(box.getCenter(new THREE.Vector3()));
      wrap.add(inner);
      if (kind.startsWith('beam')) { wrap.rotation.set(0.95, Math.PI / 2, 0); wrap.scale.setScalar(0.85); }
      else { const rad = box.getBoundingSphere(new THREE.Sphere()).radius; wrap.scale.setScalar(0.5 / Math.max(0.05, rad)); wrap.rotation.x = 0.35; }
      const holder = new THREE.Group(); holder.add(wrap); holder.scale.setScalar(0.001);
      slots[i].add(holder);
      ctx.tween(0.45, (k) => holder.scale.setScalar(Math.max(0.001, k)), { ease: Ease.back, delay: i * 0.08 });
      const item = { kind, correct, inner, wrap, holder, slot: i, spin: !kind.startsWith('beam'), target };
      item.hot = ctx.hot({ obj: holder, r: 0.75, minPx: 88, label: `Dalis ${i + 1}`, onTap: () => ctx.api.pick(i) });
      item.hot.b.addEventListener('pointerdown', (e) => { dragFrom = { i, y: E.pt(e).y }; });
      trayItems[i] = item;
    });
  };
  const clearTray = () => {
    for (const it of trayItems) { if (!it) continue; it.hot.remove(); if (it.holder.parent) it.holder.parent.remove(it.holder); }
    trayItems = [];
  };
  // a swipe up from a tray part also picks it (drag-to-place feel)
  const onUp = (e) => { if (dragFrom && dragFrom.y - E.pt(e).y > 40) ctx.api.pick(dragFrom.i); dragFrom = null; }; // app-local "up"
  window.addEventListener('pointerup', onUp); ctx.cleanup(() => window.removeEventListener('pointerup', onUp));
  ctx.onUpdate((dt) => { for (const it of trayItems) if (it && it.spin && !it.flying) it.wrap.rotation.y += dt * 0.7; });
  // the three tap areas never overlap: their width is clamped to the on-screen spacing of the tray circles
  // (on a turned phone they were ~220 px wide but only ~162 px apart)
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  ctx.onUpdate(() => {
    if (!tray.visible || slots.length < 2) return;
    slots[0].getWorldPosition(_a).project(E.camera); slots[1].getWorldPosition(_b).project(E.camera);
    const gap = Math.hypot((_a.x - _b.x) * 0.5 * E.w, (_a.y - _b.y) * 0.5 * E.h);
    const cap = Math.max(56, Math.min(220, Math.floor(gap - 6)));
    for (const it of trayItems) if (it) { it.hot.maxPx = cap; it.hot.minPx = Math.min(88, cap); }
  });

  /* ---------- picking ---------- */
  let cur = null;
  let wrongTotal = 0, praiseN = 0, placed = 0;
  ctx.onKey((e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 3 && ctx.waiting === 'part') ctx.api.pick(n - 1); });

  const pulseRight = () => { const it = trayItems.find((t) => t && t.correct); if (it) { it.hot.pulse(true); it.pulse = true; } };
  ctx.onUpdate(() => { for (const it of trayItems) if (it && it.pulse && !it.flying) it.holder.scale.setScalar(1 + Math.sin(E.time * 7) * 0.08); });

  ctx.api.pick = (i) => {
    if (!cur || ctx.waiting !== 'part') return;
    const it = trayItems[i];
    if (!it || it.flying) return;
    if (it.correct) { place(it); return; }
    Sfx.play('oops');
    const w0 = it.wrap.rotation.z;
    ctx.tween(0.5, (k, raw) => { it.wrap.rotation.z = w0 + Math.sin(raw * Math.PI * 4) * 0.35 * (1 - raw); it.holder.position.y = Math.sin(raw * Math.PI) * 0.25; }, { ease: Ease.linear });
    cur.wrong++;
    if (cur.step.count) countHint();
    else ctx.say(wrongTotal === 0 ? 'b_wrong1' : 'b_wrong2');
    wrongTotal++;
    if (cur.wrong >= 2) pulseRight();
  };
  ctx.api.pickCorrect = () => { const i = trayItems.findIndex((t) => t && t.correct); if (i >= 0) ctx.api.pick(i); };
  ctx.api.pickWrong = () => { const i = trayItems.findIndex((t) => t && !t.correct); if (i >= 0) ctx.api.pick(i); };

  // counting hint: light the 7 holes of the right beam in time with b21_hint
  let lit = [];
  const litMat = new THREE.MeshBasicMaterial({ color: 0x8ffffb });
  const litGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.03, 16);
  ctx.cleanup(() => { litMat.dispose(); litGeo.dispose(); });
  const clearLit = () => { for (const l of lit) if (l.parent) l.parent.remove(l); lit = []; };
  ctx.api.count = () => countHint();
  function countHint() {
    const it = trayItems.find((t) => t && t.correct);
    if (!it) return;
    clearLit();
    const beamMesh = it.inner.isMesh ? it.inner : it.inner.children.find((c) => c.isMesh);
    const t = Voice.lines.b21_hint.text;
    const words = ['viena', 'dvi', 'trys', 'keturios', 'penkios', 'šešios', 'septynios'];
    const cues = words.map((w, i) => ({
      at: Math.max(0, t.indexOf(w) / t.length - 0.01),
      fn: () => {
        if (!beamMesh || it.flying) return;
        const d = new THREE.Mesh(litGeo, litMat);
        d.position.set(0, 0.08, (i - 3) * HOLE); d.scale.setScalar(1.3);
        beamMesh.add(d); lit.push(d);
        Sfx.play('tick');
      },
    }));
    ctx.say('b21_hint', { cues }).then(() => pulseRight());
  }

  function place(it) {
    ctx.waiting = 'flying';
    it.flying = true;
    it.hot.remove();
    clearLit();
    const target = it.target;
    Sfx.play('whoosh');
    ctx.root.attach(it.inner);
    ctx.root.updateMatrixWorld(true);
    const p0 = it.inner.position.clone(), q0 = it.inner.quaternion.clone(), s0 = it.inner.scale.clone();
    const tp = new THREE.Vector3(), tq = new THREE.Quaternion(), ts = new THREE.Vector3();
    target.matrixWorld.decompose(tp, tq, ts);
    const mid = p0.clone().lerp(tp, 0.5); mid.y += 1.2;
    ctx.tween(0.75, (k) => {
      const a = p0.clone().lerp(mid, k), b = mid.clone().lerp(tp, k);
      it.inner.position.copy(a.lerp(b, k));
      it.inner.quaternion.slerpQuaternions(q0, tq, k);
      it.inner.scale.lerpVectors(s0, ts, k);
    }, { ease: Ease.inOut }).then(() => {
      ctx.root.remove(it.inner);
      target.visible = true;
      if (target === robot.band) { robot.bandA = -1; robot.applyGrip(); }
      Sfx.play('snap');
      const wp = target.getWorldPosition(new THREE.Vector3());
      fx.sparkles.pop(wp.add(new THREE.Vector3(0, 0.3, 0)), 10);
      cur.resolve();
    });
  }

  async function doStep(step, n) {
    const targets = step.targets();
    tray.visible = true; // the empty circles only show while a part is being chosen (never over the robot at a "look" moment)
    for (let idx = 0; idx < targets.length; idx++) {
      setStep(n, step.x2 ? (idx === 0 ? '2×' : '1×') : null, step.ch);
      showGhost(targets[idx]);
      fillTray(step, idx);
      const done = new Promise((res) => (cur = { step, idx, resolve: res, wrong: 0 }));
      ctx.waiting = 'part';
      if (idx === 0) ctx.say(step.line);
      const stopIdle = ctx.idle(() => pulseRight());
      await ctx.guard(done);
      stopIdle();
      clearGhost();
      clearTray();
      placed++;
      if (step.part === 'wheel' && idx === 1) { robot.skid.visible = true; Sfx.play('pop'); fx.sparkles.pop(robot.skid.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0)), 6); }
      if (placed % 2 === 1) await ctx.say(PRAISE[praiseN++ % 4]);
      else await ctx.wait(0.35);
    }
    tray.visible = false;
  }

  /* ---------- the flow ---------- */
  const STEPS = [
    { ch: 1, line: 'b11', part: 'hub', tray: ['plate', 'hub', 'brick'], targets: () => [robot.hub] },
    { ch: 1, line: 'b12', part: 'wheel', tray: ['gear', 'wheel', 'ball'], targets: () => [robot.wheels[1], robot.wheels[0]], x2: true },
    { ch: 2, line: 'b21', part: 'beam7g', tray: ['beam5g', 'beam7g', 'beam9g'], targets: () => [robot.beamA], count: true },
    { ch: 2, line: 'b22', part: 'beam7o', tray: ['beam5o', 'beam7o', 'beam9o'], targets: () => [robot.beamB], count: true },
    { ch: 2, line: 'b23', part: 'pin', tray: ['axle', 'pin', 'smallbrick'], targets: () => [robot.pin] },
    { ch: 3, line: 'b31', part: 'claw', tray: ['wheel', 'claw', 'tile'], targets: () => [robot.clawA, robot.clawB], x2: true },
    { ch: 3, line: 'b32', part: 'band', tray: ['pin', 'band', 'gear'], targets: () => [robot.band] },
  ];

  goView(views.ch1, 1.4);
  await ctx.say('b00');
  await doStep(STEPS[0], 1);
  await doStep(STEPS[1], 2);

  // STOP 1: spin and look
  setStep(2, null, 1);
  const spinUI = UI.add('', 'side-left');
  const spinBy = (d) => { Sfx.play('click'); const r0 = robot.group.rotation.y; ctx.tween(0.45, (k) => (robot.group.rotation.y = r0 + d * k)); };
  UI.button({ icon: 'left', label: 'Pasuk į kairę', onClick: () => spinBy(-Math.PI / 3), parent: spinUI });
  UI.button({ icon: 'right', label: 'Pasuk į dešinę', onClick: () => spinBy(Math.PI / 3), parent: spinUI });
  ctx.api.spin = spinBy;
  let drag = null;
  const cv = E.renderer.domElement;
  const pd = (e) => { drag = { x: E.pt(e).x }; };
  const pm = (e) => { if (drag && ctx.stage === 'spin') { const x = E.pt(e).x; robot.group.rotation.y += (x - drag.x) * 0.012; drag.x = x; } };
  const pu = () => { drag = null; };
  cv.addEventListener('pointerdown', pd); window.addEventListener('pointermove', pm); window.addEventListener('pointerup', pu);
  ctx.cleanup(() => { cv.removeEventListener('pointerdown', pd); window.removeEventListener('pointermove', pm); window.removeEventListener('pointerup', pu); });
  ctx.stage = 'spin';
  const go1 = ctx.signal();
  ctx.api.next = () => go1.fire();
  ctx.waiting = 'spin';
  await ctx.say('b1_done');
  const n1 = UI.next(() => { Sfx.play('click'); go1.fire(); });
  const stopIdle1 = ctx.idle(() => n1.btn.classList.add('pulse'));
  await go1.promise;
  stopIdle1(); n1.remove(); spinUI.remove(); ctx.stage = null; ctx.waiting = null;

  // chapter 2: the arm
  Sfx.play('whoosh');
  const r0 = robot.group.rotation.y;
  ctx.tween(1.0, (k) => { robot.group.position.set(-2.1 * k, 0.05, 0.1 - 0.5 * k); robot.group.rotation.y = r0 + (-0.25 - r0) * k; });
  await goView(views.ch2, 1.1);

  // count-the-holes helper button (only while a beam is being chosen)
  const helpUI = UI.add('', 'side-left');
  UI.button({ icon: 'count', label: 'Skaičiuok skylutes', onClick: () => { Sfx.play('click'); if (ctx.waiting === 'part') countHint(); }, parent: helpUI });
  await doStep(STEPS[2], 3);
  await doStep(STEPS[3], 4);
  helpUI.remove();
  await doStep(STEPS[4], 5);

  // STOP 2: open / close the pincers (≥ 2 taps before → appears)
  setStep(5, null, 2);
  let taps = 0;
  const go2 = ctx.signal();
  let n2 = null;
  ctx.api.tapPincers = () => {
    taps++;
    robot.grip(robot.isOpen() ? 0 : 1);
    Sfx.play(robot.isOpen() ? 'click' : 'clack');
    if (taps === 2 && !n2) n2 = UI.next(() => { Sfx.play('click'); go2.fire(); });
  };
  ctx.api.next = () => { if (taps >= 2) go2.fire(); };
  const pincerHot = ctx.hot({ obj: robot.pin, offset: [0, 0.1, 0.5], r: 1.1, minPx: 120, label: 'Žnyplės', onTap: () => ctx.api.tapPincers() });
  ctx.waiting = 'pincers';
  ctx.say('b2_done');
  pincerHot.pulse(true);
  const stopIdle2 = ctx.idle(() => { pincerHot.pulse(true); if (n2) n2.btn.classList.add('pulse'); });
  await go2.promise;
  stopIdle2(); pincerHot.remove(); if (n2) n2.remove(); ctx.waiting = null;

  // chapter 3: claws + band (pincers open while the claws go on)
  robot.grip(1);
  await ctx.wait(0.4);
  await doStep(STEPS[5], 6);
  // band ghost must match the current (open) pincer shape
  robot.band.visible = true; robot.bandA = -1; robot.applyGrip(); robot.band.visible = false;
  await doStep(STEPS[6], 7);
  // band on → pincers snap shut by themselves
  robot.grip(0);
  Sfx.play('boing');
  await ctx.wait(0.6);

  // b33: the whole arm glows; tap it → it flies onto the front of the robot
  setStep(8, null, 3);
  const glow = M.plastic.clone(); glow.emissive.set(0x39e6e0);
  ctx.cleanup(() => glow.dispose());
  const armMeshes = []; arm.traverse((o) => { if (o.isMesh && o !== robot.band) { armMeshes.push(o); o.material = glow; } });
  ctx.onUpdate(() => { glow.emissiveIntensity = 0.25 + (Math.sin(E.time * 5) * 0.5 + 0.5) * 0.45; });
  const go3 = ctx.signal();
  ctx.api.mount = () => go3.fire();
  const armHot = ctx.hot({ obj: robot.pin, offset: [0, 0.1, 0.4], r: 1.2, minPx: 130, label: 'Ranka', onTap: () => ctx.api.mount() });
  armHot.pulse(true);
  ctx.waiting = 'mount';
  ctx.say('b33');
  const stopIdle3 = ctx.idle(() => armHot.pulse(true));
  await go3.promise;
  stopIdle3(); armHot.remove(); ctx.waiting = 'flying';
  Sfx.play('whoosh');
  robot.group.attach(arm);
  const ap = arm.position.clone(), aq = arm.quaternion.clone(), tq = new THREE.Quaternion();
  const tp = new THREE.Vector3(0, 0.2, 1.5);
  await ctx.tween(0.9, (k, raw) => {
    arm.position.lerpVectors(ap, tp, k); arm.position.y += Math.sin(raw * Math.PI) * 1.0;
    arm.quaternion.slerpQuaternions(aq, tq, k);
  });
  for (const m of armMeshes) m.material = M.plastic;
  Sfx.play('snap');
  placed++;
  const rr = robot.group.rotation.y, rp = robot.group.position.clone();
  ctx.tween(1.0, (k) => { robot.group.position.lerpVectors(rp, new THREE.Vector3(0, 0.05, -0.6), k); robot.group.rotation.y = rr + (-0.45 - rr) * k; });
  await goView(views.end, 1.0);

  // b3_done: happy wiggle, blink, confetti
  robot.wiggle(1.6); robot.blink();
  fx.confetti.burst(new THREE.Vector3(0, 1.6, -0.4), 110, 2.2, 6);
  Sfx.play('fanfare');
  window.__game.buildPlacements = placed;
  ctx.G.rec('build', placed);
  ctx.waiting = 'done';
  await ctx.say('b3_done');
  robot.blink();
  await ctx.wait(0.6);
  G.go('program');
}

export async function auto(ctx) {
  const W = () => ctx.until(() => ctx.waiting === 'part' && !Voice.playing);
  const pickN = async (n, wrongFirst = false) => {
    for (let i = 0; i < n; i++) {
      await W();
      if (wrongFirst && i === 0) {
        ctx.api.pickWrong();
        await ctx.wait(0.3);
        await ctx.until(() => !Voice.playing && ctx.waiting === 'part');
      }
      ctx.api.pickCorrect();
      await ctx.until(() => ctx.waiting !== 'flying'); // place() sets 'flying' synchronously
    }
  };
  await pickN(1, true); // hub, after one wrong pick (b_wrong1)
  await pickN(2); // wheels
  await ctx.until(() => ctx.waiting === 'spin' && !Voice.playing);
  ctx.api.spin(1); await ctx.wait(0.5); ctx.api.next();
  await pickN(1, true); // green beam, after one wrong pick (counting hint)
  await pickN(1, true); // orange beam, wrong pick again
  await pickN(1, true); // pin (b_wrong2)
  await ctx.until(() => ctx.waiting === 'pincers');
  ctx.api.tapPincers(); await ctx.wait(0.3); ctx.api.tapPincers(); await ctx.wait(0.3); ctx.api.next();
  await pickN(2); // claws
  await pickN(1); // band
  await ctx.until(() => ctx.waiting === 'mount');
  ctx.api.mount();
}
