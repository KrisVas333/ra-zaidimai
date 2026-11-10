// reward: the sticker „Parko tvarkytojas" slaps onto a sticker-book page; r01; stars; r04; two big buttons:
// „Mano robotai" (→ trophy) and „Tėvams" (parent card). Saves completion + sticker.
import * as THREE from '../three.js';
import { Robot } from '../robot.js';
import { Kit, M } from '../util.js';
import { fitFov, setBackdrop } from '../engine.js';
import { iconURL, SVG } from '../icons.js';
import { Sfx, Voice } from '../audio.js';

const cyl = (a, b, h, s = 40) => new THREE.CylinderGeometry(a, b, h, s);

export async function enter(ctx) {
  const { E, UI, G } = ctx;
  setBackdrop('studio');
  const fx = ctx.fx();
  const floor = new THREE.Mesh(new Kit().add(new THREE.BoxGeometry(60, 0.1, 40), 0xd9ccff, [0, -0.05, 0]).geo(), M.toy);
  floor.receiveShadow = true; ctx.root.add(floor);
  const ped = new THREE.Mesh(new Kit().add(cyl(1.5, 1.6, 0.6), 0xffffff, [0, 0.3, 0]).add(cyl(1.55, 1.55, 0.08), 0x39e6e0, [0, 0.62, 0]).geo(), M.toy);
  // the robot stands left of the sticker book (the book is DOM and would hide it in the middle)
  ped.receiveShadow = true; ped.position.x = -3.4; ped.scale.setScalar(0.85); ctx.root.add(ped);
  const robot = new Robot();
  robot.group.position.set(-3.4, 0.56, 0); robot.group.scale.multiplyScalar(0.85);
  ctx.root.add(robot.group);
  E.shadowFocus = robot.group;
  const place = () => {
    E.camera.fov = fitFov(5.5, 3.2, 9); E.camera.updateProjectionMatrix();
    ctx.setCam(new THREE.Vector3(0, 3.4, 9), new THREE.Vector3(0, 1.4, 0));
  };
  place();
  E.onResize.add(place); ctx.cleanup(() => E.onResize.delete(place));
  let gt = 1.2;
  ctx.onUpdate((dt) => {
    if (!E.reduced) robot.group.rotation.y += dt * 0.5;
    gt -= dt; if (gt < 0) { robot.grip(robot.isOpen() ? 0 : 1); gt = 1.4; }
    robot.update(dt);
  });

  // save first: the lesson is complete
  const first = !G.state.completed;
  G.state.completed = true;
  G.state.sticker = true;
  if (!G.state.blocks.length) G.state.blocks = ['drive', 'grab', 'release'];
  G.save();
  UI.setPocket(G.state.blocks);
  const stars = G.session.stars || G.state.bestStars || 1;

  // sticker book + stars
  const wrap = UI.add('', 'reward-wrap center');
  const book = document.createElement('div'); book.className = 'book pop-in'; wrap.appendChild(book);
  const bslots = [];
  for (let i = 0; i < 6; i++) { const s = document.createElement('div'); s.className = 'slot-s'; book.appendChild(s); bslots.push(s); }
  const starsEl = document.createElement('div'); starsEl.className = 'stars'; starsEl.style.flexDirection = 'column'; wrap.appendChild(starsEl);
  for (let i = 0; i < 3; i++) { const s = document.createElement('div'); s.className = 'star'; s.innerHTML = SVG.starOff; starsEl.appendChild(s); }

  await ctx.wait(0.6);
  // slap!
  const st = document.createElement('div'); st.className = 'sticker slap';
  st.innerHTML = `<img src="${iconURL('sticker', 216)}" alt="Lipdukas „Parko tvarkytojas“">`;
  bslots[0].style.borderColor = 'transparent';
  bslots[0].appendChild(st);
  setTimeout(() => { Sfx.play('pop'); Sfx.play('snap'); }, 300 / E.timeScale);
  fx.confetti.burst(new THREE.Vector3(-1.2, 3, 1), 90, 2.4, 6);
  Sfx.play('fanfare');
  ctx.waiting = 'r01';
  const said = ctx.say('r01');
  for (let i = 0; i < stars; i++) {
    await ctx.wait(0.5);
    starsEl.children[i].innerHTML = SVG.starOn; starsEl.children[i].classList.add('slap'); Sfx.play('star');
  }
  await said;
  window.__game.rewardStars = stars;

  // what was learned today: r05 while three picture badges pop in, each with its words
  // („rūšiuoti šiukšles" → three bins · „pastatyti robotą su ranka" → the robot with its arm · „sudėti programą" → three blocks)
  ctx.waiting = 'r05';
  const bw = UI.add('', 'badges');
  const badges = ['badgeBins', 'badgeRobot', 'badgeBlocks'].map((k) => {
    const b = document.createElement('div'); b.className = 'badge wait'; b.innerHTML = `<img src="${iconURL(k, 200)}" alt="">`; bw.appendChild(b); return b;
  });
  const shown = [];
  const pop = (i) => () => { const b = badges[i]; if (!b.classList.contains('wait')) return; b.classList.remove('wait'); b.classList.add('pop-in'); Sfx.play('pop'); shown.push(i); };
  const t5 = ((Voice.lines.r05 && Voice.lines.r05.text) || '').toLowerCase();
  const at = (w, d) => (t5 && t5.indexOf(w) >= 0 ? Math.max(0, t5.indexOf(w) / t5.length - 0.03) : d);
  await ctx.say('r05', { cues: [{ at: at('rūšiuoti', 0.35), fn: pop(0) }, { at: at('pastatyti', 0.6), fn: pop(1) }, { at: at('sudėti', 0.85), fn: pop(2) }] });
  [0, 1, 2].forEach((i) => pop(i)()); // a skipped line still shows all three
  window.__game.rewardBadges = { order: shown.slice(), shown: badges.filter((b) => !b.classList.contains('wait')).length };

  ctx.api.trophy = () => { Sfx.play('click'); G.go('trophy', { first }); };
  ctx.api.parents = () => UI.parentCard();
  const row = UI.add('', 'bottom-center');
  const tb = UI.pill({ icon: 'trophy', text: 'Mano robotai', onClick: ctx.api.trophy, parent: row });
  UI.pill({ icon: 'parents', text: 'Tėvams', onClick: () => { Sfx.play('click'); ctx.api.parents(); }, parent: row });
  // ⭐ Scorecard: the child rates with faces (no typing)
  if (window.Scorecard) UI.pill({ emoji: '⭐', text: 'Įvertink', label: 'Įvertink žaidimą', onClick: () => { Sfx.play('click'); window.Scorecard.open({ role: 'vaikas' }); }, parent: row });
  tb.classList.add('pop-in');
  tb.focus({ preventScroll: true });
  ctx.waiting = 'buttons';
  await ctx.say('r04');
  const stopIdle = ctx.idle(() => tb.classList.add('pulse'));
  ctx.cleanup(stopIdle);
}

export async function auto(ctx) {
  await ctx.until(() => ctx.waiting === 'buttons' && !Voice.playing);
  const close = ctx.api.parents(); // the parent card opens and closes
  await ctx.wait(0.5);
  window.__game.parentCardOK = !!document.querySelector('.parent-card');
  close();
  await ctx.wait(0.2);
  ctx.api.trophy();
}
