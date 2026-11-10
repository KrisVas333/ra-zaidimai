// trophy (home): a cosy room. r02 on first visit only. 5 pedestals: the unlocked robot (tap → it waves its
// pincers) + 4 grey locked silhouettes with a padlock and „?". On the wall: the sticker book and the learned blocks.
// The avatar stands in the room. Buttons: play the mission again · race · my park · start.
import * as THREE from '../three.js';
import { buildRoom } from '../world.js';
import { Robot } from '../robot.js';
import { makeKid } from '../chars.js';
import { Kit, roundedBox as rb, M, canvasTex, roundRect, keep } from '../util.js';
import { fitFov, setBackdrop } from '../engine.js';
import { drawIcon, drawGlyph } from '../icons.js';
import { Sfx, Voice } from '../audio.js';

const cyl = (a, b, h, s = 16) => new THREE.CylinderGeometry(a, b, h, s);
const GREY = 0xa4a9bd;
// Layout (round 2): the camera sits higher and looks down, so the wall shows ABOVE the pedestal row instead of
// behind it; the sticker book and the blocks hang lower on the wall, under the HUD/caption band, and the „?"
// badges moved from above the silhouettes onto their chests. The avatar stands inside the frame, left of the row.
const Q_S = 0.5, Q_Y = 1.45;
const BOOK = { pos: [-4.8, 3.27, -6.8], w: 2.9 };
const BLOCKS = { pos: [5.0, 3.05, -6.8], w: 3.0 };
const AVATAR = [-4.5, 0, 0.4];
const CAM = { pos: [0.4, 7.2, 11.5], look: [0.4, 2.2, -2.6], halfW: 7.0, halfH: 4.0, dist: 14.4 };
// phone landscape (#app.compact, height <= 520): the caption rides in the HUD band and can wrap to 3 lines, so the
// room is pulled a little further away and tilted up, which drops the wall pieces under that band
// There the menu splits into a left and a right pair (css .trophy-menu), so the avatar stands in the free middle,
// in front of its robot.
const CAM_COMPACT = { ...CAM, pos: [1.0, 7.2, 11.5], look: [1.0, 2.9, -2.6], halfH: 4.33 };
const AVATAR_COMPACT = [-0.7, 0, 0.4];

function silhouette(i) {
  const k = new Kit();
  if (i === 0) { // tower bot
    k.add(rb(0.9, 1.1, 0.7, 0.14), GREY, [0, 0.75, 0]); k.add(rb(0.7, 0.55, 0.6, 0.16), GREY, [0, 1.6, 0]);
    k.add(cyl(0.04, 0.04, 0.4, 8), GREY, [0, 2.05, 0]); k.add(new THREE.SphereGeometry(0.1, 10, 8), GREY, [0, 2.28, 0]);
    for (const sx of [-1, 1]) k.add(rb(0.2, 0.7, 0.2, 0.08), GREY, [sx * 0.6, 0.8, 0], [0, 0, sx * 0.2]);
  } else if (i === 1) { // car
    k.add(rb(1.5, 0.45, 0.9, 0.14), GREY, [0, 0.5, 0]); k.add(rb(0.8, 0.4, 0.8, 0.14), GREY, [-0.1, 0.9, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(cyl(0.25, 0.25, 0.16, 16), GREY, [sx * 0.5, 0.27, sz * 0.48], [Math.PI / 2, 0, 0]);
  } else if (i === 2) { // crane
    k.add(rb(1.2, 0.4, 0.9, 0.12), GREY, [0, 0.3, 0]); k.add(cyl(0.18, 0.18, 0.3, 14), GREY, [0, 0.62, 0]);
    k.add(rb(0.2, 1.6, 0.2, 0.06), GREY, [0.35, 1.3, 0], [0, 0, -0.55]); k.add(rb(0.12, 0.5, 0.12, 0.04), GREY, [0.85, 1.65, 0]);
  } else { // walker
    k.add(rb(1.0, 0.6, 0.8, 0.18), GREY, [0, 1.05, 0]); k.add(rb(0.5, 0.35, 0.5, 0.12), GREY, [0, 1.55, 0.05]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(rb(0.14, 0.8, 0.14, 0.05), GREY, [sx * 0.42, 0.4, sz * 0.3], [sz * 0.15, 0, sx * 0.15]);
  }
  return k.geo();
}
let qTex = null;
function questionTex() {
  return qTex || (qTex = keep(canvasTex(128, 128, (g) => {
    g.fillStyle = '#2b1a5a'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#39e6e0'; g.stroke();
    g.fillStyle = '#fff'; g.font = '700 84px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 64, 70);
  })));
}

export async function enter(ctx) {
  const { E, UI, G, opts } = ctx;
  setBackdrop('room');
  E.hemi.intensity = 1.6;
  G.session.trophyVisits++;
  const room = buildRoom(ctx.root);
  const peds = room.userData.pedestals;
  const fx = ctx.fx();

  // the unlocked robot in the middle
  const robot = new Robot();
  robot.group.position.copy(peds[2]); robot.group.scale.setScalar(0.9);
  ctx.root.add(robot.group);
  E.shadowFocus = robot.group;
  const glowRing = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: 0x39e6e0 }));
  glowRing.rotation.x = Math.PI / 2; glowRing.position.copy(peds[2]).setY(1.1); ctx.root.add(glowRing);

  // locked silhouettes with padlock + „?"
  const lockK = new Kit();
  lockK.add(rb(0.5, 0.42, 0.18, 0.06), 0x6b6f85, [0, 0, 0]);
  lockK.add(new THREE.TorusGeometry(0.15, 0.045, 8, 20, Math.PI), 0x6b6f85, [0, 0.21, 0]);
  lockK.add(cyl(0.05, 0.05, 0.2, 10), 0x2b1a5a, [0, -0.02, 0.09], [Math.PI / 2, 0, 0]);
  const lockGeo = lockK.geo();
  const qMat = new THREE.SpriteMaterial({ map: questionTex(), depthWrite: false });
  const locks = [];
  [0, 1, 3, 4].forEach((pi, i) => {
    const s = new THREE.Mesh(silhouette(i), M.toy);
    s.position.copy(peds[pi]); s.lookAt(0, peds[pi].y, 9);
    s.castShadow = false;
    ctx.root.add(s);
    const lock = new THREE.Mesh(lockGeo, M.toy); lock.position.copy(peds[pi]).add(new THREE.Vector3(0, 0.7, 0.9)); ctx.root.add(lock);
    // the „?" sits on the silhouette's chest, above the padlock (not above its head, where it covered the wall)
    const q = new THREE.Sprite(qMat); q.scale.setScalar(Q_S); q.position.copy(peds[pi]).add(new THREE.Vector3(0, Q_Y, 1.0)); ctx.root.add(q);
    locks.push({ lock, q, qy: q.position.y, base: lock.position.clone(), t: 0, sil: s });
  });

  // wall: sticker book + learned blocks (canvas textures)
  const bookTex = canvasTex(512, 352, (g) => {
    g.fillStyle = '#b48a45'; roundRect(g, 6, 14, 500, 332, 34); g.fill();
    g.fillStyle = '#fff7e6'; roundRect(g, 6, 6, 500, 326, 34); g.fill();
    g.strokeStyle = '#e7c98f'; g.lineWidth = 10; roundRect(g, 6, 6, 500, 326, 34); g.stroke();
    for (let i = 0; i < 6; i++) {
      const cx = 96 + (i % 3) * 160, cy = 100 + Math.floor(i / 3) * 140;
      if (i === 0 && G.state.sticker) { g.save(); g.translate(cx - 62, cy - 62); g.rotate(0); drawIcon('sticker', g, 124); g.restore(); continue; }
      g.setLineDash([10, 9]); g.strokeStyle = '#e0c58c'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, 56, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
  });
  const book = new THREE.Mesh(new THREE.PlaneGeometry(BOOK.w, BOOK.w * 352 / 512), new THREE.MeshStandardMaterial({ map: bookTex, roughness: 0.8 }));
  book.position.set(...BOOK.pos); ctx.root.add(book);
  let blocksMesh = null;
  if (G.state.blocks && G.state.blocks.length) {
    const COL = { drive: '#3a86ff', grab: '#ff8c1a', release: '#22b573' };
    // the learned blocks + under them 3 markers for the solved programming challenges (gold star = solved)
    const solvedN = Math.max(0, Math.min(3, G.state.challenge || 0));
    const blocksTex = canvasTex(512, 200, (g) => {
      G.state.blocks.forEach((b, i) => {
        const x = 20 + i * 166;
        g.fillStyle = 'rgba(0,0,0,.2)'; roundRect(g, x, 20, 140, 124, 24); g.fill();
        g.fillStyle = COL[b] || '#888'; roundRect(g, x, 8, 140, 124, 24); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 7; roundRect(g, x, 8, 140, 124, 24); g.stroke();
        g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round';
        if (b === 'drive') { g.beginPath(); g.moveTo(x + 70, 114); g.lineTo(x + 70, 30); g.moveTo(x + 38, 62); g.lineTo(x + 70, 30); g.lineTo(x + 102, 62); g.stroke(); }
        else drawGlyph(b === 'grab' ? 'fist' : 'hand', g, x + 22, 22, 96); // the same glyphs as the program blocks
      });
      for (let i = 0; i < 3; i++) {
        const cx = 90 + i * 166, cy = 172;
        g.fillStyle = '#ffd23f'; g.strokeStyle = '#2b1a5a'; g.lineWidth = 4;
        if (i < solvedN) { g.save(); g.translate(cx - 24, cy - 24); g.scale(2, 2); const p = new Path2D('M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5-4.8-4.5 6.5-.8z'); g.fill(p); g.lineWidth = 1.6; g.stroke(p); g.restore(); }
        else { g.setLineDash([7, 6]); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, 19, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
      }
    });
    const blocks = new THREE.Mesh(new THREE.PlaneGeometry(BLOCKS.w, BLOCKS.w * 200 / 512), new THREE.MeshStandardMaterial({ map: blocksTex, transparent: true, roughness: 0.8 }));
    blocks.position.set(...BLOCKS.pos); ctx.root.add(blocks); blocksMesh = blocks;
  }

  // the avatar in the room
  const me = makeKid(G.avatar());
  ctx.root.add(me.group); fx.blobs.track(me.group, 0.8);
  me.set('wave');

  const place = () => {
    const compact = E.h <= 520; // the same threshold as #app.compact (engine.js)
    const c = compact ? CAM_COMPACT : CAM;
    me.group.position.set(...(compact ? AVATAR_COMPACT : AVATAR)); me.face(c.pos[0], c.pos[2]);
    E.camera.fov = fitFov(c.halfW, c.halfH, c.dist); E.camera.updateProjectionMatrix();
    ctx.setCam(new THREE.Vector3(...c.pos), new THREE.Vector3(...c.look));
  };
  place();
  E.onResize.add(place); ctx.cleanup(() => E.onResize.delete(place));
  // QA probe: where the wall pieces, the avatar and the „?" badges land on screen (app pixels)
  const box = new THREE.Box3(), v = new THREE.Vector3();
  const rectOf3 = (o) => {
    box.setFromObject(o); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(E.camera);
      const x = (v.x + 1) / 2 * E.w, y = (1 - v.y) / 2 * E.h;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return { x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x1), y1: Math.round(y1) };
  };
  const kidRect = () => { // a kid is about 1.2 wide and 2.4 tall; an AABB of the posed group overshoots a lot
    const p = me.group.position; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [dx, dy] of [[-0.6, 0], [0.6, 0], [-0.6, 2.4], [0.6, 2.4]]) {
      v.set(p.x + dx, p.y + dy, p.z).project(E.camera);
      const x = (v.x + 1) / 2 * E.w, y = (1 - v.y) / 2 * E.h;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return { x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x1), y1: Math.round(y1) };
  };
  window.__game.trophyLayout = () => ({ book: rectOf3(book), blocks: blocksMesh ? rectOf3(blocksMesh) : null, avatar: kidRect(), robot: rectOf3(robot.group), q: locks.map((l) => rectOf3(l.q)), sil: locks.map((l) => rectOf3(l.sil)), w: E.w, h: E.h });

  let waveT = 0, t = 0;
  ctx.onUpdate((dt) => {
    t += dt;
    if (!E.reduced) robot.group.rotation.y += dt * 0.4;
    if (waveT > 0) { waveT -= dt; const ph = Math.floor(waveT / 0.28); robot.grip(ph % 2 ? 1 : 0); if (waveT <= 0) robot.grip(0); }
    robot.update(dt);
    me.update(dt);
    if (t > 3 && me.anim === 'wave') me.set('idle');
    glowRing.scale.setScalar(1 + Math.sin(t * 2.5) * 0.04);
    for (const l of locks) {
      if (l.t > 0) { l.t -= dt; l.lock.rotation.z = Math.sin(l.t * 40) * 0.25 * l.t; } else l.lock.rotation.z = 0;
      l.q.position.y = l.qy + Math.sin(t * 2 + l.base.x) * 0.06;
    }
  });

  ctx.api.tapRobot = () => { waveT = 1.7; robot.wiggle(1.0); Sfx.play('boing'); fx.sparkles.pop(robot.group.position.clone().setY(2.2), 8); window.__game.robotWaved = true; };
  ctx.hot({ obj: robot.group, offset: [0, 1.0, 0], r: 1.4, minPx: 110, label: 'Mano robotas', onTap: () => ctx.api.tapRobot() });
  locks.forEach((l) => ctx.hot({ obj: l.sil, offset: [0, 1.0, 0], r: 1.0, minPx: 80, label: 'Užrakinta', onTap: () => { l.t = 0.6; Sfx.play('clack'); } }));
  // the learned-blocks board opens the programming challenges (replayable); it pulses until the child first opens them
  ctx.api.challenge = () => {
    Sfx.play('click'); G.session.chOpened = true;
    const n = (G.state.challenge || 0) >= 3 ? 1 : (G.state.challenge || 0) + 1;
    G.go('program', { challenge: n });
  };
  if (blocksMesh) {
    const bh = ctx.hot({ obj: blocksMesh, offset: [0, 0, 0.05], r: 0.75, minPx: 64, maxPx: 112, label: 'Programavimo iššūkiai', onTap: () => ctx.api.challenge() });
    if (!G.session.chOpened && !(G.state.challenge > 0)) bh.pulse(true);
    ctx.api.boardHot = bh;
  }

  // menu
  // a calm moment for a due movement break (main.js): nothing spoken, no menu open, hands off for 3 s
  ctx.calm = () => !Voice.playing && !UI.hasOverlay() && E.time - G.lastInput > 3;
  ctx.api.mission = () => { Sfx.play('click'); G.go('mission', { replay: true }); };
  ctx.api.race = () => { Sfx.play('click'); G.go('race'); };
  ctx.api.world = () => { Sfx.play('click'); G.go('world'); };
  ctx.api.start = () => { Sfx.play('click'); G.go('start'); };
  const row = UI.add('', 'menu-row trophy-menu');
  const item = (icon, label, fn, cls = 'main') => {
    const w = document.createElement('div'); w.className = 'menu-item'; row.appendChild(w);
    const b = UI.button({ icon, cls, label, onClick: fn, parent: w });
    const l = document.createElement('span'); l.className = 'lbl'; l.textContent = label; l.setAttribute('aria-hidden', 'true'); w.appendChild(l);
    return b;
  };
  // pictures a 5-year-old can read: circular arrow = again · flag = race · pine tree = my park · house = home
  const playB = item('again', 'Žaisti dar kartą', ctx.api.mission, 'main go');
  item('flag', 'Lenktynės', ctx.api.race);
  item('tree', 'Mano parkas', ctx.api.world);
  item('home', 'Į pradžią', ctx.api.start);
  playB.focus({ preventScroll: true });

  ctx.waiting = 'intro';
  if (opts.first) await ctx.say('r02');
  ctx.waiting = 'menu';
}

export async function auto(ctx) {
  await ctx.until(() => ctx.waiting === 'menu' && !Voice.playing);
  const G = ctx.G;
  ctx.api.tapRobot();
  await ctx.wait(0.8);
  G.session.autoStep = (G.session.autoStep || 0) + 1;
  if (G.session.autoStep === 1) return ctx.api.world();
  if (G.session.autoStep === 2) return ctx.api.race();
  if (G.session.autoStep === 3) { window.__game.boardPulsed = !!(ctx.api.boardHot && ctx.api.boardHot.b.classList.contains('pulse')); return ctx.api.challenge(); }
  // end of the run: check what must be true, then report
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('ra-l07-v1')); } catch (e) { /* storage blocked */ }
  const keys = []; try { for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch (e) {}
  const g = window.__game;
  const summary = {
    scenes: (g.trace || []).filter((s) => s.endsWith(':enter')).map((s) => s.split(':')[0]),
    buildPlacements: g.buildPlacements, programFails: g.programFails, collected: g.collected, wrongBins: g.wrongBins,
    stars: g.lastStars, parentCard: g.parentCardOK, robotWaved: g.robotWaved, park: saved && saved.park && saved.park.length,
    worldWalk: g.worldWalk, worldPark: g.worldPark, quiz: g.quiz, rewardBadges: g.rewardBadges,
    challenges: g.challenges, challengeSaved: saved && saved.challenge, boardPulsed: g.boardPulsed, boardMarkers: Math.max(0, Math.min(3, (saved && saved.challenge) || 0)),
    last: saved && saved.last,
    raceResult: g.raceResult, savedCompleted: saved && saved.completed, storageKeys: keys, errors: g.errors.length,
    breaks: g.breaks, // v8: the lesson's movement break (from mission, then quiz)
  };
  g.autoplay = summary;
  if (g.errors.length === 0 && saved && saved.completed) console.log('AUTOPLAY OK', JSON.stringify(summary));
  else console.warn('AUTOPLAY FAIL', JSON.stringify(summary), g.errors);
}
