// Voice player (one line at a time, ended-driven, caption + timed fallback) and WebAudio sound effects.
import { E } from './engine.js';

/* ================= sound effects ================= */
let actx = null, master = null, humOsc = null, humGain = null, noiseBuf = null;
let muted = false;
let held = false; // game paused: the sound context is suspended (hum and tails freeze) and no new sounds start

function ensureCtx() {
  if (actx) return actx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(actx.destination);
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.6, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { actx = null; }
  return actx;
}

function tone({ type = 'sine', f0 = 440, f1 = f0, dur = 0.15, vol = 0.2, attack = 0.008, delay = 0, vib = 0 }) {
  const t = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  if (vib) {
    const l = actx.createOscillator(), lg = actx.createGain();
    l.frequency.value = 14; lg.gain.value = vib;
    l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise({ dur = 0.2, vol = 0.15, f0 = 800, f1 = f0, q = 1, delay = 0, type = 'bandpass' }) {
  const t = actx.currentTime + delay;
  const s = actx.createBufferSource(); s.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.05);
}

const SFX = {
  click: () => tone({ f0: 900, f1: 700, dur: 0.07, vol: 0.12 }),
  pop: () => { tone({ f0: 300, f1: 950, dur: 0.1, vol: 0.22 }); noise({ dur: 0.05, vol: 0.05, f0: 3000 }); },
  snap: () => { noise({ dur: 0.06, vol: 0.18, f0: 2500, type: 'highpass' }); tone({ type: 'triangle', f0: 240, f1: 180, dur: 0.09, vol: 0.2 }); },
  chime: () => { [1046.5, 1318.5, 1568].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.55, vol: 0.13, delay: i * 0.085 })); },
  oops: () => { tone({ f0: 520, f1: 400, dur: 0.18, vol: 0.13 }); tone({ f0: 420, f1: 310, dur: 0.24, vol: 0.12, delay: 0.17 }); },
  whoosh: () => noise({ dur: 0.38, vol: 0.14, f0: 350, f1: 2600, q: 0.8 }),
  boing: () => tone({ f0: 180, f1: 520, dur: 0.5, vol: 0.2, vib: 40 }),
  star: () => { tone({ type: 'triangle', f0: 1318, f1: 1760, dur: 0.3, vol: 0.12 }); tone({ type: 'sine', f0: 2637, dur: 0.25, vol: 0.05, delay: 0.05 }); },
  tick: () => tone({ type: 'triangle', f0: 660, dur: 0.16, vol: 0.16 }),
  go: () => { tone({ type: 'triangle', f0: 880, dur: 0.18, vol: 0.15 }); tone({ type: 'triangle', f0: 1320, dur: 0.35, vol: 0.15, delay: 0.12 }); },
  fanfare: () => { [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.5, vol: 0.12, delay: i * 0.11 })); },
  shake: () => { tone({ f0: 300, f1: 260, dur: 0.12, vol: 0.12 }); tone({ f0: 300, f1: 260, dur: 0.12, vol: 0.12, delay: 0.15 }); },
  lid: () => { noise({ dur: 0.08, vol: 0.12, f0: 900 }); tone({ type: 'triangle', f0: 200, f1: 150, dur: 0.1, vol: 0.14 }); },
  clack: () => { noise({ dur: 0.05, vol: 0.12, f0: 1800 }); tone({ type: 'square', f0: 330, f1: 300, dur: 0.05, vol: 0.05 }); },
};

export const Sfx = {
  unlock() {
    const c = ensureCtx();
    if (c && c.state === 'suspended' && !held) c.resume().catch(() => {});
  },
  /** pause / resume every sound (the hum included) with the game */
  hold(on) {
    held = !!on;
    if (!actx) return;
    try { (on ? actx.suspend() : actx.resume()).catch(() => {}); } catch (e) { /* audio is optional */ }
  },
  play(name) {
    if (muted || held || !actx || actx.state !== 'running') return;
    try { SFX[name] && SFX[name](); } catch (e) { /* audio is optional */ }
  },
  hum(level) {
    if (!actx || (actx.state !== 'running' && !held)) return; // while paused the level is still set (a scene change sets 0)
    if (!humOsc) {
      humOsc = actx.createOscillator(); humOsc.type = 'sawtooth'; humOsc.frequency.value = 62;
      const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      humGain = actx.createGain(); humGain.gain.value = 0;
      humOsc.connect(lp).connect(humGain).connect(master); humOsc.start();
    }
    const v = muted ? 0 : Math.max(0, Math.min(1, level)) * 0.06;
    humGain.gain.setTargetAtTime(v, actx.currentTime, 0.08);
    humOsc.frequency.setTargetAtTime(58 + level * 30, actx.currentTime, 0.1);
  },
  setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.55, actx.currentTime, 0.02);
  },
  get muted() { return muted; },
  get state() { return actx ? actx.state : 'none'; }, // QA: 'suspended' while paused
};

/* ================= voice ================= */
// lines that are feedback, not instructions: the repeat button never replays them (it replays the last instruction)
const NOT_INSTR = new Set([
  'ok1', 'ok2', 'ok3', 'ok4', 'idle',
  'b_wrong1', 'b_wrong2', 'm_wrong', 'ed02_no', 'p_fail',
  'q1_no', 'q2_no', 'q3_no', 'q4_no',
  'm_3', 'm_6', 'w_lock2', 'w_lock3',
]);

export const Voice = {
  lines: {},
  avail: 'unknown', // Set of ids | 'unknown' (try each file, fall back on error)
  cache: new Map(),
  cur: null,
  speed: 1, // <1 = faster fallback timing (autoplay)
  useAudio: true,
  ccOn: true,
  lastInstr: null,
  lastEnd: 0,
  onShow: null, // (line) => void
  onEnd: null, // () => void

  async init(lines, { useAudio = true, speed = 1 } = {}) {
    this.lines = lines;
    this.useAudio = useAudio;
    this.speed = speed;
    if (!useAudio) return;
    try {
      const r = await fetch('audio/lt/manifest.json', { cache: 'no-cache' });
      if (r.ok) {
        const m = await r.json();
        const ids = Object.keys((m && m.clips) || {});
        if (ids.length) this.avail = new Set(ids);
      }
    } catch (e) { this.avail = 'unknown'; }
  },

  has(id) {
    if (!this.useAudio || muted) return false;
    if (this.avail === 'unknown') return !this.failed?.has(id);
    return this.avail.has(id) && !this.failed?.has(id);
  },

  el(id) {
    let a = this.cache.get(id);
    if (!a) {
      a = new Audio();
      a.preload = 'auto';
      a.src = `audio/lt/${id}.mp3`;
      this.cache.set(id, a);
    }
    return a;
  },

  preload(ids) {
    if (!this.useAudio) return;
    for (const id of ids) if (this.lines[id] && this.has(id)) this.el(id);
  },

  get playing() { return !!this.cur; },

  /** say(id, {cues:[{at:0..1, fn}]}) → Promise<boolean>; resolves when the line ends, is skipped (true) or replaced (false). */
  say(id, opt = {}) {
    const line = this.lines[id];
    this.stop();
    if (!line) {
      window.__game.errors.length < 40 && window.__game.errors.push('missing line ' + id);
      return Promise.resolve(true);
    }
    if (!NOT_INSTR.has(id)) this.lastInstr = id;
    this.onShow && this.onShow(id, line);
    const text = line.text;
    const fallbackMs = Math.max(90, (1200 + 55 * text.length) * this.speed);
    return new Promise((resolve) => {
      const cur = { id, resolve, cues: (opt.cues || []).slice().sort((a, b) => a.at - b.at), fired: 0, el: null, t0: performance.now(), dur: fallbackMs, mode: 'fallback', timers: [], heldAt: 0 };
      this.cur = cur;
      const fallback = () => {
        if (this.cur !== cur) return;
        if (cur.el) { try { cur.el.pause(); } catch (e) {} }
        // keep progress fraction if we switch mid-line
        const done = cur.mode === 'audio' && cur.el && cur.el.duration ? cur.el.currentTime / cur.el.duration : 0;
        for (const t of cur.timers) clearTimeout(t); // the audio safety timers must not restart the fallback
        cur.timers = [];
        cur.mode = 'fallback';
        cur.t0 = performance.now() - done * fallbackMs;
        cur.dur = fallbackMs;
        if (this.held) { cur.heldAt = performance.now(); return; } // paused: the timer starts on release()
        cur.timers.push(setTimeout(() => this._finish(cur, true), fallbackMs * (1 - done)));
      };
      cur.fallback = fallback;
      if (this.has(id)) {
        const a = this.el(id);
        cur.el = a; cur.mode = 'audio';
        a.onended = () => this._finish(cur, true);
        a.onerror = () => { (this.failed ||= new Set()).add(id); fallback(); };
        try { a.currentTime = 0; } catch (e) {}
        a.muted = muted;
        a.onloadedmetadata = () => { if (this.cur === cur && !this.held) this._armEnd(cur); };
        if (this.held) cur.heldAt = performance.now(); // a line asked for while paused waits for release()
        else this._play(cur);
      } else {
        fallback();
      }
    });
  },

  /** start (or continue) the clip; a failed start falls back to caption timing, except when it was cut by a pause */
  _play(cur) {
    const a = cur.el;
    const p = a.play();
    if (p && p.catch) p.catch(() => { if (this.cur === cur && !this.held) cur.fallback(); });
    // safety: if it never starts, or never ends, do not block the lesson
    cur.timers.push(setTimeout(() => { if (this.cur === cur && !this.held && a.readyState < 2) cur.fallback(); }, 3500));
    if (a.readyState >= 1 && isFinite(a.duration)) this._armEnd(cur);
  },
  _armEnd(cur) {
    const a = cur.el;
    if (!a || !isFinite(a.duration)) return;
    cur.timers.push(setTimeout(() => { if (this.cur === cur && cur.mode === 'audio' && !this.held) this._finish(cur, true); }, Math.max(0, a.duration - (a.currentTime || 0)) * 1000 + 2000));
  },

  /* ---------- pause: the line stops where it is and continues from the same spot ---------- */
  held: false,
  hold() {
    if (this.held) return;
    this.held = true;
    const cur = this.cur;
    if (!cur) return;
    for (const t of cur.timers) clearTimeout(t);
    cur.timers = [];
    cur.heldAt = performance.now();
    if (cur.mode === 'audio' && cur.el) { try { cur.el.pause(); } catch (e) {} }
  },
  release() {
    if (!this.held) return;
    this.held = false;
    const cur = this.cur;
    if (!cur) return;
    const now = performance.now();
    if (cur.mode === 'audio' && cur.el) this._play(cur);
    else {
      cur.t0 += now - (cur.heldAt || now); // paused time does not count toward the caption timing or its cues
      cur.timers.push(setTimeout(() => this._finish(cur, true), Math.max(0, cur.dur - (now - cur.t0))));
    }
    cur.heldAt = 0;
  },

  _finish(cur, ok) {
    if (this.cur !== cur) return;
    for (const t of cur.timers) clearTimeout(t);
    if (cur.el) { cur.el.onended = cur.el.onerror = cur.el.onloadedmetadata = null; if (!ok || !cur.el.ended) { try { cur.el.pause(); } catch (e) {} } }
    // fire remaining cues so animations end in their final state
    while (cur.fired < cur.cues.length) { const c = cur.cues[cur.fired++]; try { c.fn(); } catch (e) { window.__game.errors.push(String(e)); } }
    this.cur = null;
    this.lastEnd = E.time;
    this.onEnd && this.onEnd(cur.id);
    cur.resolve(ok);
  },

  /** per-frame: fire cues by progress fraction */
  tick() {
    const cur = this.cur;
    if (!cur || this.held || cur.fired >= cur.cues.length) return;
    let frac;
    if (cur.mode === 'audio' && cur.el && cur.el.duration && isFinite(cur.el.duration)) frac = cur.el.currentTime / cur.el.duration;
    else if (cur.mode === 'audio') return;
    else frac = (performance.now() - cur.t0) / cur.dur;
    while (cur.fired < cur.cues.length && cur.cues[cur.fired].at <= frac) {
      const c = cur.cues[cur.fired++];
      try { c.fn(); } catch (e) { window.__game.errors.push(String(e)); }
    }
  },

  stop() { if (this.cur) this._finish(this.cur, false); },
  skip() { if (this.cur && !this.held) this._finish(this.cur, true); },

  /** repeat button: restart the current line, or replay the last instruction */
  repeat() {
    if (this.held) return; // paused: the ▶ comes first
    // a feedback line is playing ("ne ši dalis"): go straight back to the instruction instead of repeating the error
    if (this.cur && NOT_INSTR.has(this.cur.id) && this.lastInstr) { this.say(this.lastInstr); return; }
    if (this.cur) {
      const cur = this.cur;
      if (cur.mode === 'audio' && cur.el) { try { cur.el.currentTime = 0; cur.el.play().catch(() => {}); } catch (e) {} }
      else { for (const t of cur.timers) clearTimeout(t); cur.timers = [setTimeout(() => this._finish(cur, true), cur.dur)]; cur.t0 = performance.now(); }
      this.onShow && this.onShow(cur.id, this.lines[cur.id]);
      return;
    }
    if (this.lastInstr) this.say(this.lastInstr);
  },

  setMuted(m) {
    if (this.cur && this.cur.el) this.cur.el.muted = m;
  },
};
