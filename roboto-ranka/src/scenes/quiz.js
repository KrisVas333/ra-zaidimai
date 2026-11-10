// quiz: q00, then 3 questions with 3 big picture answers each (pictures only). Wrong → that card greys out and the
// question stays open; right → the card glows, qN_ok, next. Keys 1–3 answer.
import * as THREE from '../three.js';
import { buildPark, addBins } from '../world.js';
import { makeKid } from '../chars.js';
import { iconURL } from '../icons.js';
import { shuffle, rng } from '../util.js';
import { fitFov } from '../engine.js';
import { Sfx, Voice } from '../audio.js';

const QUESTIONS = [
  // q1: plain coloured bins (no pictogram on them), so the child must know the colour, not match the bottle picture
  { id: 'q1', pic: 'plastic', answers: [['binBlue', 'Mėlynas konteineris'], ['binYellow', 'Geltonas konteineris'], ['binGreen', 'Žalias konteineris']], right: 'binYellow' },
  { id: 'q2', answers: [['paperBall', 'Popierius'], ['can', 'Skardinė'], ['glass', 'Stiklinis butelis']], right: 'glass' },
  { id: 'q3', answers: [['wheel', 'Ratas'], ['band', 'Gumytė'], ['eyes', 'Roboto akys']], right: 'band' },
  // q4 (command order): two big cards, the grab block (closed hand) and the release block (open hand)
  { id: 'q4', answers: [['cardGrab', 'Suimti'], ['cardRelease', 'Paleisti']], right: 'cardGrab', two: true },
];

export async function enter(ctx) {
  const { E, UI, G } = ctx;
  buildPark(ctx.root);
  addBins(ctx.root);
  const fx = ctx.fx();
  const kids = [['leo', -2.6, 0.6], ['neo', 0, 0], ['maja', 2.6, 0.6]].map(([k, x, z]) => {
    const kid = makeKid(k); kid.group.position.set(x, 0, z); ctx.root.add(kid.group); fx.blobs.track(kid.group, 0.8);
    return kid;
  });
  const place = () => {
    // faces sit between the caption and the answer cards, also on a phone held sideways
    E.camera.fov = fitFov(4.6, 3.2, 9); E.camera.updateProjectionMatrix();
    ctx.setCam(new THREE.Vector3(0, 2.6, 9), new THREE.Vector3(0, 1.3, -0.5));
    kids.forEach((k) => k.face(E.camera.position.x, E.camera.position.z));
  };
  place();
  E.onResize.add(place); ctx.cleanup(() => E.onResize.delete(place));
  ctx.onUpdate((dt) => { for (const k of kids) k.update(dt); });

  const r = rng((Date.now() & 0xffff) + 3);
  let cur = null;
  ctx.onKey((e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 3) ctx.api.answer(n - 1); });

  ctx.api.answer = (i) => {
    if (!cur || ctx.waiting !== 'answer') return;
    const c = cur.cards[i];
    if (!c || c.dataset.grey) return;
    if (c.dataset.kind === cur.q.right) {
      ctx.waiting = 'ok';
      c.classList.add('right');
      Sfx.play('chime');
      const rc = E.rectOf(c); // app-local: floatNum places inside #scene-ui
      UI.floatNum('★', rc.left + rc.width / 2, rc.top);
      kids[1].set('jump'); kids[0].set('cheer'); kids[2].set('cheer');
      cur.resolve();
    } else {
      c.dataset.grey = '1'; c.classList.add('grey'); c.disabled = true;
      Sfx.play('oops');
      cur.wrong++;
      ctx.say(cur.q.id + '_no');
    }
  };
  ctx.api.rightIndex = () => cur ? cur.cards.findIndex((c) => c.dataset.kind === cur.q.right) : -1;
  ctx.api.wrongIndex = () => cur ? cur.cards.findIndex((c) => c.dataset.kind !== cur.q.right && !c.dataset.grey) : -1;

  await ctx.say('q00');
  let qn = 0, firstTry = 0;
  for (const q of QUESTIONS) {
    qn++;
    window.__game.quizQ = qn;
    kids.forEach((k) => k.set('idle'));
    let picEl = null;
    if (q.pic) {
      picEl = UI.add(`<img src="${iconURL(q.pic, 200)}" alt="">`, 'q-pic pop-in');
    }
    const row = UI.add('', 'quiz-row' + (q.two ? ' two' : ''));
    const cards = shuffle(q.answers.slice(), r).map(([kind, label], i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'qcard pop-in';
      b.style.animationDelay = `${i * 0.08}s`;
      b.dataset.kind = kind;
      b.setAttribute('aria-label', `${i + 1}: ${label}`);
      b.innerHTML = `<span class="qk" aria-hidden="true">${i + 1}</span><img src="${iconURL(kind, 200)}" alt="">`;
      b.addEventListener('click', (e) => { e.stopPropagation(); ctx.api.answer(i); });
      row.appendChild(b);
      return b;
    });
    const done = new Promise((res) => (cur = { q, cards, resolve: res, wrong: 0 }));
    ctx.waiting = 'answer';
    ctx.say(q.id);
    cards[0].focus({ preventScroll: true });
    const stopIdle = ctx.idle(() => { const i = ctx.api.rightIndex(); if (i >= 0) cards[i].classList.add('wiggle'); });
    await ctx.guard(done);
    stopIdle();
    if (cur.wrong === 0) firstTry++;
    await ctx.say(q.id + '_ok');
    row.remove(); if (picEl) picEl.remove();
    await ctx.wait(0.2);
  }
  ctx.waiting = 'done';
  window.__game.quiz = { firstTry, total: QUESTIONS.length };
  G.rec('quizFirstTry', firstTry); G.rec('quizTotal', QUESTIONS.length);
  fx.confetti.burst(new THREE.Vector3(0, 2.5, 0), 70, 2.2, 6);
  Sfx.play('fanfare');
  kids.forEach((k) => k.set('cheer'));
  await ctx.wait(1.2);
  G.go('takeapart');
}

export async function auto(ctx) {
  for (let q = 1; q <= 4; q++) {
    await ctx.until(() => ctx.waiting === 'answer' && !Voice.playing && window.__game.quizQ === q);
    // q1 and q4: a wrong answer first (the card greys out, qN_no, the question stays open)
    if (q === 1 || q === 4) { ctx.api.answer(ctx.api.wrongIndex()); await ctx.wait(0.3); await ctx.until(() => !Voice.playing); }
    ctx.api.answer(ctx.api.rightIndex());
    await ctx.until(() => ctx.waiting !== 'answer');
  }
}
