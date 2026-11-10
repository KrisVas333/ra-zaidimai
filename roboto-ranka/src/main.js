/*
 * RA lesson 7 „Roboto ranka: sutvarkyk parką" — boot, scene state machine, save, debug hooks.
 *
 * Five assumptions (build contract, see SPEC.md §2):
 *  1 Audience: one child aged 5–6 who cannot read, on a tablet/phone/laptop; a parent may sit beside.
 *  2 Shape: one ~10 min lesson in 9 scenes + a robot room to come back to (+ My park sandbox, race).
 *  3 Numbers: 9 litter, 3 bins, 10 build placements in 3 chapters, 1 four-slot program (+3 five-slot challenges), 4 quiz questions,
 *    1 movement break (3 moves, ~50 s; again after every 10 min of free play), 86 voice lines.
 *  4 Out of scope: accounts, servers, tracking, multiplayer, other lessons, music score, English.
 *  5 Done: SPEC §11 acceptance list on desktop Chrome and a phone-landscape viewport, zero console errors.
 *
 * Debug hooks: ?scene=<id> · ?mute=1 · ?autoplay=1 (&speed=1 for real time with audio) · ?break=<seconds> (free-play
 * break interval, default 600) · window.__game
 * v8 (2026-11-10): ⏸ pause (HUD, key P, auto on the ⭐ panel and a hidden tab) · 🤸 movement break „Judesio pertrauka".
 */
import * as THREE from './three.js';
import { E, initEngine, tween, to, setOwner, killOwner, setBackdrop } from './engine.js';
import { UI } from './ui.js';
import { Voice, Sfx } from './audio.js';
import { initMats, disposeTree } from './util.js';
import { Confetti, Sparkles, Blobs } from './fx.js';
import { Pause } from './pause.js';

import * as sStart from './scenes/start.js';
import * as sAvatar from './scenes/avatar.js';
import * as sStory from './scenes/story.js';
import * as sIdea from './scenes/idea.js';
import * as sBuild from './scenes/build.js';
import * as sProgram from './scenes/program.js';
import * as sMission from './scenes/mission.js';
import * as sQuiz from './scenes/quiz.js';
import * as sTake from './scenes/takeapart.js';
import * as sReward from './scenes/reward.js';
import * as sTrophy from './scenes/trophy.js';
import * as sWorld from './scenes/world.js';
import * as sRace from './scenes/race.js';
import * as sBreak from './scenes/break.js';

const SCENES = {
  start: sStart, avatar: sAvatar, story: sStory, idea: sIdea, build: sBuild, program: sProgram, mission: sMission,
  quiz: sQuiz, takeapart: sTake, reward: sReward, trophy: sTrophy, world: sWorld, race: sRace, break: sBreak,
};
// the lesson's one movement break sits at the seam after the mission and before the quiz (about 8–10 min in)
const NEXT = { start: 'avatar', avatar: 'story', story: 'idea', idea: 'build', build: 'program', program: 'mission', mission: 'break', break: 'quiz', quiz: 'takeapart', takeapart: 'reward', reward: 'trophy' };
const KEY = 'ra-l07-v1';
const Q = new URLSearchParams(location.search);
// A published copy (Artifact) drops ?query parameters, so a plain #name works too:
// #mission (any scene id) jumps to that scene, #debug shows a small readout, #rot turns the game (engine.js).
// Tokens combine with & + or , (e.g. #mission&rot&debug).
const hashTokens = () => (location.hash || '').slice(1).split(/[&+,]/).filter(Boolean);
const hashScene = () => hashTokens().find((t) => t !== 'start' && SCENES[t]) || '';
const JUMP = Q.get('scene') || hashScene();
export const VERSION = 'v8';
// free play after the lesson (robot room, „Mano parkas", race, mission replay, coding challenges): a movement break
// after every BREAK_EVERY seconds of ACTIVE play. Game time only: pause and a hidden tab do not count.
const BREAK_EVERY = Q.get('break') && +Q.get('break') > 0 ? +Q.get('break') : 600;
const isFree = (cur) => !!cur && (cur.id === 'trophy' || cur.id === 'world' || cur.id === 'race' ||
  (cur.id === 'mission' && !!cur.ctx.opts.replay) || (cur.id === 'program' && !!cur.ctx.opts.challenge));

// last = the last run's counts for the parent card (no names, no free text) · challenge = highest solved (0–3)
const defaultState = () => ({ avatar: null, completed: false, bestStars: 0, sticker: false, blocks: [], park: [], last: null, challenge: 0 });
const LAST_KEYS = ['build', 'programFails', 'collected', 'wrongBins', 'quizFirstTry', 'quizTotal', 'stars', 'race'];
function pick(o) {
  const d = defaultState(), out = {};
  for (const k in d) out[k] = o && o[k] !== undefined ? o[k] : d[k];
  if (!Array.isArray(out.blocks)) out.blocks = [];
  if (!Array.isArray(out.park)) out.park = [];
  if (out.last && typeof out.last === 'object') { const l = {}; for (const k of LAST_KEYS) if (out.last[k] != null) l[k] = out.last[k]; out.last = l; } else out.last = null;
  out.challenge = Math.max(0, Math.min(3, +out.challenge || 0));
  return out;
}
function load() {
  try { const s = localStorage.getItem(KEY); return s ? pick(JSON.parse(s)) : defaultState(); } catch (e) { return defaultState(); }
}

export const G = {
  state: defaultState(),
  session: { trophyVisits: 0, worldVisited: false, raceRuns: 0 },
  playSec: 0, // active free-play seconds since the last movement break
  breakEvery: BREAK_EVERY,
  breakDue() { return G.playSec >= G.breakEvery; },
  autoplay: Q.get('autoplay') === '1',
  realtime: Q.get('speed') === '1',
  debugJump: !!JUMP,
  lastInput: 0,
  cur: null,
  save() { try { localStorage.setItem(KEY, JSON.stringify(pick(G.state))); } catch (e) { /* storage blocked: play on */ } },
  go,
  next() { go(NEXT[G.cur.id] || 'trophy'); },
  unlocked() { return G.state.completed || G.debugJump; },
  avatar() { return G.state.avatar == null ? 0 : G.state.avatar; },
  /** record one last-run count for the parent card, the moment it becomes known */
  rec(k, v) { G.state.last = Object.assign({}, G.state.last, { [k]: v }); G.save(); },
  log,
};

function log(e) {
  const g = window.__game;
  if (g.errors.length < 40) g.errors.push(String((e && (e.stack || e.message)) || e));
  console.warn('[ra-l07]', e);
}

/* ---------------- per-scene context ---------------- */
function makeCtx(id, opts) {
  const token = { id };
  const cleanups = [], updates = [];
  const ctx = {
    id, opts, token, alive: true, waiting: null, api: {}, G, E, UI,
    root: new THREE.Group(),
    guard(p) { return new Promise((res) => p.then((v) => { if (ctx.alive) res(v); })); },
    say(lineId, o) { return ctx.guard(Voice.say(lineId, o)); },
    wait(s) { return tween(s, null, { owner: token }); },
    tween(d, fn, o = {}) { return tween(d, fn, { ...o, owner: token }); },
    to(t, p, d, o = {}) { return to(t, p, d, { ...o, owner: token }); },
    until(cond) {
      return new Promise((res) => {
        const f = () => { if (!ctx.alive) { E.onFrame.delete(f); return; } if (cond()) { E.onFrame.delete(f); res(); } };
        E.onFrame.add(f);
      });
    },
    signal() { let fire; const p = new Promise((r) => (fire = r)); return { promise: ctx.guard(p), fire: (v) => fire(v) }; },
    cleanup(fn) { cleanups.push(fn); },
    onUpdate(fn) { updates.push(fn); },
    onKey(fn) { const h = (e) => { if (!UI.hasOverlay() || e.key === 'Escape') fn(e); }; window.addEventListener('keydown', h); cleanups.push(() => window.removeEventListener('keydown', h)); },
    hot(o) { return UI.hot(o); },
    /** idle help: after 12 s with no input (and no voice), play `idle` once and pulse */
    idle(pulse) {
      let on = true, fired = false;
      const f = () => {
        if (!on || fired || !ctx.alive || UI.hasOverlay()) return;
        const quiet = E.time - Math.max(G.lastInput, Voice.lastEnd);
        if (!Voice.playing && quiet > 12) { fired = true; ctx.say('idle'); try { pulse && pulse(); } catch (e) { log(e); } }
      };
      E.onFrame.add(f);
      const stop = () => { on = false; E.onFrame.delete(f); };
      cleanups.push(stop);
      return stop;
    },
    fx() {
      if (!ctx._fx) {
        ctx._fx = { confetti: new Confetti(ctx.root), sparkles: new Sparkles(ctx.root), blobs: new Blobs(ctx.root) };
        updates.push((dt) => { ctx._fx.confetti.update(dt); ctx._fx.sparkles.update(dt); ctx._fx.blobs.update(dt); });
      }
      return ctx._fx;
    },
    /** camera glide (cut when reduced motion) */
    async camTo(pos, look, dur = 1.6) {
      const c = E.camera, p0 = c.position.clone(), l0 = ctx._look ? ctx._look.clone() : look.clone();
      ctx._look = ctx._look || new THREE.Vector3();
      if (E.reduced || dur <= 0) { c.position.copy(pos); ctx._look.copy(look); c.lookAt(look); return; }
      await ctx.tween(dur, (k) => { c.position.lerpVectors(p0, pos, k); ctx._look.lerpVectors(l0, look, k); c.lookAt(ctx._look); });
    },
    setCam(pos, look) { E.camera.position.copy(pos); ctx._look = look.clone(); E.camera.lookAt(look); },
    trace(s) { (window.__game.trace ||= []).push(`${id}:${s}`); },
  };
  ctx._cleanups = cleanups; ctx._updates = updates;
  return ctx;
}

/* ---------------- state machine ---------------- */
let linesByScene = {};
function go(id, opts = {}) {
  if (!SCENES[id]) id = 'start';
  // a due movement break comes before the next free-play scene (a race or a mission is only ever left when it is over)
  if (id !== 'break' && id !== 'start' && isFree(G.cur) && G.breakDue()) return go('break', { then: id, thenOpts: opts, from: G.cur.id });
  const prev = G.cur;
  if (prev) {
    const c = prev.ctx;
    c.alive = false;
    killOwner(c.token);
    for (const fn of c._cleanups) { try { fn(); } catch (e) { log(e); } }
    try { prev.mod.exit && prev.mod.exit(c); } catch (e) { log(e); }
    Voice.stop();
    UI.clearScene(); UI.clearCaption();
    E.root.remove(c.root);
    try { disposeTree(c.root); } catch (e) { log(e); }
  }
  E.shadowFocus = null; E.sceneUpdate = null;
  Sfx.hum(0);
  E.hemi.intensity = 1.7; E.sun.intensity = 2.3; E.sun.castShadow = true;
  setBackdrop('sky');
  E.camera.fov = 45; E.camera.updateProjectionMatrix();

  const mod = SCENES[id];
  const ctx = makeCtx(id, opts);
  setOwner(ctx.token);
  E.root.add(ctx.root);
  G.cur = { id, mod, ctx };
  window.__game.scene = id;
  UI.setProgress(id);
  UI.hud(id !== 'start');
  // the break has its own skip (it skips the whole break), so the caption's line skip stays away there
  UI.skipAllowed = id !== 'start' && id !== 'mission' && id !== 'race' && id !== 'world' && id !== 'break';
  Voice.preload(linesByScene[id] || []);
  if (NEXT[id]) Voice.preload(linesByScene[NEXT[id]] || []);
  E.sceneUpdate = (dt) => { for (const f of ctx._updates) f(dt); };
  if (G.autoplay) ctx.trace('enter');
  Promise.resolve().then(() => mod.enter(ctx)).catch(log);
  if (G.autoplay && mod.auto) Promise.resolve().then(() => mod.auto(ctx)).catch(log);
}

/* ---------------- boot ---------------- */
export async function start() {
  const g = window.__game;
  g.errors = g.errors || [];
  window.addEventListener('error', (e) => log(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => log(e.reason));

  G.state = load();
  Object.defineProperty(g, 'state', { get: () => G.state, configurable: true });
  Object.defineProperty(g, 'fps', { get: () => E.fps, configurable: true });
  g.G = G; g.E = E; g.Voice = Voice; g.Sfx = Sfx; g.Pause = Pause; g.version = VERSION;
  g.go = (id, o) => go(id, o);
  g.info = () => ({ calls: E.renderer.info.render.calls, triangles: E.renderer.info.render.triangles, geometries: E.renderer.info.memory.geometries, textures: E.renderer.info.memory.textures, fps: E.fps, dpr: E.renderer.getPixelRatio() });

  initEngine(document.getElementById('stage'));
  g.renderer = E.renderer;
  E.onFrame.add(() => Voice.tick());
  // movement-break clock: per-frame hooks run only while the game runs (not paused, tab visible), so this is active play
  E.onFrame.add((dt) => {
    const cur = G.cur;
    if (!isFree(cur)) return;
    G.playSec += dt / (E.timeScale || 1);
    // a scene with an open, calm moment (the park when nothing is held or spoken) takes the break right there
    if (G.breakDue() && cur.ctx.calm) {
      let calm = false;
      try { calm = cur.ctx.calm(); } catch (e) { log(e); }
      if (calm) go('break', { then: cur.id, thenOpts: cur.ctx.opts, from: cur.id });
    }
  });
  initMats();

  const script = await fetch('data/script-lt.json').then((r) => r.json());
  const lines = script.lines;
  for (const [lid, l] of Object.entries(lines)) (linesByScene[l.scene] ||= []).push(lid);
  const muted = Q.get('mute') === '1';
  const fast = G.autoplay && !G.realtime;
  if (fast) E.timeScale = 3;
  // ?mute=1 starts with sound off but keeps the clips reachable, so the big "sound off" button can turn them back on
  await Voice.init(lines, { useAudio: !fast, speed: fast ? 0.05 : 1 });
  Voice.preload(linesByScene.any || []);
  Voice.onShow = (lid, line) => UI.caption(line, Voice.ccOn);
  Voice.onEnd = () => UI.captionEnded();
  if (muted) { Sfx.setMuted(true); }

  UI.init({
    home: () => { Sfx.play('click'); if (G.cur && G.cur.id !== 'start') UI.confirmHome(() => go('start')); },
    repeat: () => { Sfx.unlock(); Voice.repeat(); },
    cc: () => { Voice.ccOn = !Voice.ccOn; UI.setCC(Voice.ccOn); },
    // sound on/off: the parent-card switch or the big "sound is off" button; turning sound on repeats the instruction
    mute: (m) => { Sfx.unlock(); Sfx.setMuted(m); Voice.setMuted(m); UI.setMute(m); if (!m && !Voice.cur) Voice.repeat(); },
    skip: () => Voice.skip(),
    pause: () => { Sfx.play('click'); Pause.toggle(); },
    resume: () => { Pause.resume(); Sfx.play('click'); },
    report: () => ({ completed: G.state.completed, last: G.state.last }),
    // parent card „Pradėti iš naujo": the one storage key goes, the game starts fresh
    reset: () => {
      try { localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ }
      G.state = defaultState();
      G.session = { trophyVisits: 0, worldVisited: false, raceRuns: 0 };
      G.debugJump = false;
      UI.setPocket([]);
      UI.closeOverlays();
      go('start');
    },
  });
  UI.setMute(muted);
  UI.setPocket(G.state.blocks);

  Pause.init({ autoplay: G.autoplay, inGame: () => !!G.cur && G.cur.id !== 'start' });
  const mark = () => { G.lastInput = E.time; Sfx.unlock(); };
  window.addEventListener('pointerdown', mark, true);
  const typing = (t) => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  window.addEventListener('keydown', (e) => {
    mark();
    // the ⭐ Scorecard panel is open on top: it owns the keyboard. Escape is its own (never close the game overlay
    // under it); other keys outside the panel must not drive the paused game.
    if (window.Scorecard && window.Scorecard.isOpen && window.Scorecard.isOpen()) {
      const inPanel = e.target && e.target.closest && e.target.closest('[data-scorecard]');
      if (e.key !== 'Escape' && !inPanel) e.stopPropagation();
      return;
    }
    // P = pause / continue (only in a game scene, never while typing)
    if ((e.key === 'p' || e.key === 'P') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target) && !document.getElementById('hud').hidden) {
      e.preventDefault(); e.stopPropagation(); Pause.toggle(); return;
    }
    if (Pause.on) {
      // paused: Escape, Enter or Space continue (Enter/Space on the focused ▶ click it natively); every other key waits
      if (e.key === 'Escape') { e.preventDefault(); Pause.resume(); }
      else if ((e.key === 'Enter' || e.key === ' ') && UI.pauseShown() && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); Pause.resume(); }
      e.stopPropagation();
      return;
    }
    if (e.key === 'Escape' && UI.hasOverlay()) { const ov = document.querySelector('#overlay-root .overlay:last-child'); ov && ov._close && ov._close(); }
  }, true);

  const showDebug = () => {
    if (document.getElementById('dbg')) return;
    const d = document.createElement('div');
    d.id = 'dbg';
    d.style.cssText = 'position:absolute;left:6px;bottom:4px;z-index:99;font:12px/1.3 monospace;color:#fff;background:rgba(0,0,0,.65);padding:2px 8px;border-radius:6px;pointer-events:none;white-space:nowrap';
    document.getElementById('app').appendChild(d);
    setInterval(() => {
      const c = Voice.cur;
      const v = c ? `${c.id}:${c.mode}${c.el ? ` ${c.el.currentTime.toFixed(1)}/${(c.el.duration || 0).toFixed(1)}` : ''}` : '-';
      d.textContent = `${g.scene} · voice ${v} · clips ${Voice.avail === 'unknown' ? '?' : Voice.avail.size} · failed ${Voice.failed ? Voice.failed.size : 0} · ${E.fps} fps · ${E.w}x${E.h}${E.rot ? ' rot' : ''} · err ${g.errors.length}`;
    }, 250);
  };
  // a published copy may hand the #name over only after the page has loaded, so listen as well
  const onHash = () => {
    if (hashTokens().includes('debug')) showDebug();
    const h = hashScene();
    if (h && G.cur && G.cur.id !== h) {
      G.debugJump = true;
      if (G.state.avatar == null) G.state.avatar = 0;
      go(h);
    }
  };
  if (hashTokens().includes('debug') || Q.get('debug') === '1') showDebug();
  window.addEventListener('hashchange', onHash);

  const startId = JUMP && SCENES[JUMP] ? JUMP : 'start';
  if (G.debugJump && G.state.avatar == null) G.state.avatar = 0;
  go(startId);
  setTimeout(() => document.getElementById('loading').classList.add('gone'), 120);
}
