// break („Judesio pertrauka", v8): about 50 s of moving in the room. Leo, Neo, Maja, the child's own avatar and the
// robot show 3 moves the child copies: ① stretch up tall like the robot arm ② squat and pick up litter, 3 times
// ③ march in place / robot dance. Nothing to read, nothing to fail, no score. A friendly ring fills up to show how
// much is left (never a countdown, never red). An adult can skip the whole break with the » button (bottom right).
// ⏸ / P pauses it like everything else; the ring and every move stand still while paused (game time).
// When: once in the lesson, after the mission and before the quiz (main.js NEXT); in free play after every 10 min of
// active play, at the next calm moment, never mid-race (main.js). QA: ?scene=break · ?break=<seconds>.
// Reduced motion: the camera never moves (the moves themselves are the content, so the figures still show them).
import * as THREE from '../three.js';
import { buildPark, makeLitter, KINDS } from '../world.js';
import { makeKid } from '../chars.js';
import { Robot } from '../robot.js';
import { fitFov } from '../engine.js';
import { SVG } from '../icons.js';
import { Sfx } from '../audio.js';

// the planned end of each part in game seconds: a part plays its line, then holds the move until its planned end
// (at least a few seconds), so the whole break lands near TOTAL and the ring moves evenly
const PLAN = { intro: 6, up: 17, squat: 31, march: 44, done: 49 };
const TOTAL = PLAN.done;
const MOVES = ['mvUp', 'mvSquat', 'mvMarch'];
const C = 2 * Math.PI * 44; // ring circumference (r = 44 in a 100 box)

export async function enter(ctx) {
  const { E, UI, G, opts } = ctx;
  G.playSec = 0; // the free-play clock starts again after every break
  const rec = { from: opts.from || 'mission', then: opts.then || 'quiz', parts: [], skipped: false, sec: null };
  (window.__game.breaks ||= []).push(rec);

  buildPark(ctx.root);
  const fx = ctx.fx();

  // the line-up faces the child: Leo, the child's avatar, Maja, Neo; the robot stands on the right
  const cast = [['leo', -3.45], [G.avatar(), -1.15], ['maja', 1.15], ['neo', 3.45]].map(([k, x]) => {
    const kid = makeKid(k);
    kid.group.position.set(x, 0, 2.2); kid.group.rotation.y = 0;
    ctx.root.add(kid.group); fx.blobs.track(kid.group, 0.8);
    return kid;
  });
  // one piece of litter in front of each figure: the "pick it up" move reaches for it
  const litter = cast.map((kid, i) => {
    const l = makeLitter(KINDS[i % 3], i, 0.95);
    l.position.set(kid.group.position.x + 0.15, 0, 3.15); l.rotation.y = i * 1.3;
    ctx.root.add(l);
    return l;
  });
  const robot = new Robot();
  robot.group.scale.setScalar(0.85);
  robot.group.position.set(5.5, 0, 2.9); robot.group.rotation.y = -0.3;
  robot.grip(1);
  ctx.root.add(robot.group);
  fx.blobs.track(robot.group, 1.0);
  E.shadowFocus = robot.group;

  const look = new THREE.Vector3(0, 1.75, 2.2);
  const place = () => { E.camera.fov = fitFov(7.0, 2.7, 10.8); E.camera.updateProjectionMatrix(); };
  place(); E.onResize.add(place); ctx.cleanup(() => E.onResize.delete(place));
  ctx.setCam(new THREE.Vector3(0, 3.3, 13.0), look);
  // a gentle drift between the moves; with reduced motion the camera stays where it is
  const drift = (x, z) => { if (!E.reduced) ctx.camTo(new THREE.Vector3(x, 3.3, z), look, 2.4); };

  /* ---------- UI: the ring (how much is left), the 3 moves as pictures, the adult's skip ---------- */
  const panel = UI.add(
    `<div class="brk-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="trk" cx="50" cy="50" r="44"/><circle class="arc" cx="50" cy="50" r="44"/></svg><div class="brk-ico">${SVG.kid}</div></div>` +
    `<div class="brk-steps">${MOVES.map((m) => `<span>${SVG[m]}</span>`).join('')}</div>`, 'brk-panel panel');
  panel.setAttribute('role', 'progressbar');
  panel.setAttribute('aria-label', 'Judesio pertrauka');
  panel.setAttribute('aria-valuemin', '0'); panel.setAttribute('aria-valuemax', '100'); panel.setAttribute('aria-valuenow', '0');
  const arc = panel.querySelector('.arc'), ico = panel.querySelector('.brk-ico'), steps = [...panel.querySelectorAll('.brk-steps span')];
  arc.style.strokeDasharray = `${C} ${C}`; arc.style.strokeDashoffset = String(C);
  const part = (i, icon) => {
    ico.innerHTML = SVG[icon];
    ico.classList.remove('pop-in'); void ico.offsetWidth; ico.classList.add('pop-in');
    steps.forEach((s, k) => { s.className = k < i ? 'done' : k === i ? 'on' : ''; });
    rec.parts.push(`${icon}@${elapsed.toFixed(1)}`);
  };
  const sk = UI.add('', 'corner-br');
  const skipB = document.createElement('button');
  skipB.type = 'button'; skipB.className = 'brk-skip'; skipB.setAttribute('aria-label', 'Praleisti pertrauką'); skipB.innerHTML = SVG.skip;
  skipB.addEventListener('click', (e) => { e.stopPropagation(); ctx.api.skip(); });
  sk.appendChild(skipB);

  /* ---------- time (game time: stands still while paused) ---------- */
  let elapsed = 0, marching = false, wigT = 0, beatT = 0, beatOn = false, ended = false;
  ctx.onUpdate((dt) => {
    elapsed += dt;
    const f = Math.min(1, elapsed / TOTAL);
    arc.style.strokeDashoffset = String(C * (1 - f));
    const pct = Math.round(f * 100);
    if (String(pct) !== panel.getAttribute('aria-valuenow')) panel.setAttribute('aria-valuenow', String(pct));
    for (const k of cast) k.update(dt);
    robot.update(dt, 0);
    for (const l of litter) if (l.userData.hopT > 0) { l.userData.hopT -= dt; const k = 1 - l.userData.hopT / 0.5; l.position.y = Math.sin(Math.min(1, k) * Math.PI) * 0.55; }
    if (marching) {
      wigT -= dt; if (wigT < 0) { wigT = 1.1; robot.wiggle(0.7); }
      if (beatOn) { beatT -= dt; if (beatT < 0) { beatT = Math.PI / 5.6; Sfx.play('clack'); } } // one soft beat per step
    }
  });
  const at = (t) => ctx.until(() => elapsed >= t);
  const hold = (planEnd, minHold) => at(Math.max(planEnd, elapsed + minHold));
  const all = (anim) => { for (const k of cast) k.set(anim); };

  const end = () => {
    if (ended) return;
    ended = true;
    rec.sec = +elapsed.toFixed(1);
    G.playSec = 0;
    if (opts.then) G.go(opts.then, opts.thenOpts || {}); else G.next();
  };
  ctx.api.skip = () => { if (ended) return; rec.skipped = true; Sfx.play('click'); end(); };
  ctx.api.elapsed = () => elapsed;
  ctx.waiting = 'break';

  // 0 · hello: everyone waves, then stands ready
  all('wave');
  await ctx.say('br01');
  all('idle');
  await hold(PLAN.intro, 0.4);

  // 1 · stretch up tall like the robot arm (the robot opens its pincers wide), twice
  part(0, 'mvUp'); drift(-1.2, 12.4);
  all('stretch'); robot.grip(1); robot.blink();
  await ctx.say('br_up');
  await hold(Math.max(PLAN.up - 5, elapsed + 1.5), 1.5);
  all('idle'); await ctx.wait(1.0);
  all('stretch'); Sfx.play('whoosh');
  await hold(PLAN.up, 2.5);
  all('idle');

  // 2 · squat and pick up the litter, 3 times (counted 1-2-3 on screen; the robot's pincers grab with them)
  part(1, 'mvSquat'); drift(1.0, 12.2);
  for (const k of cast) { k.amt = 0; k.set('squat'); }
  await ctx.say('br_squat');
  for (let r = 1; r <= 3; r++) {
    await ctx.tween(0.9, (k) => { for (const c of cast) c.amt = k; });
    robot.grip(0); Sfx.play('pop');
    for (const l of litter) { l.userData.hopT = 0.5; fx.sparkles.pop(l.position.clone().setY(0.6), 4); }
    const s = UI.screenOf(cast[1].group, [1.15, 3.4, 0]);
    UI.floatNum(String(r), s.x, s.y);
    await ctx.wait(0.35);
    await ctx.tween(0.9, (k) => { for (const c of cast) c.amt = 1 - k; });
    robot.grip(1);
    await ctx.wait(0.25);
  }
  all('idle');
  await hold(PLAN.squat, 0.6);

  // 3 · march in place / robot dance (a soft beat once the line is said)
  part(2, 'mvMarch'); drift(0, 12.8);
  all('march'); marching = true;
  await ctx.say('br_march');
  beatOn = true;
  await hold(PLAN.march, 5);
  marching = false; beatOn = false;
  all('idle');

  // 4 · well done: cheer, the ring closes with a star, back to the game
  part(3, 'starOn');
  all('cheer'); robot.wiggle(1.6); Sfx.play('fanfare');
  if (E.reduced) fx.sparkles.pop(new THREE.Vector3(0, 3.2, 2.2), 14);
  else fx.confetti.burst(new THREE.Vector3(0, 3.2, 2.2), 90, 3.2, 6);
  await ctx.say('br_done');
  await hold(PLAN.done, 0.6);
  end();
}

// autoplay: the break plays itself through (game time runs 3× in the fast test run)
export async function auto(ctx) {
  await ctx.until(() => ctx.waiting === 'break');
}
