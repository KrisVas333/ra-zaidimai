// Pause (v8). One switch for the whole game: game time (E.time), tweens, scene logic, per-frame hooks, the voice line
// (it continues from the same spot) and every sound. Paused time counts toward nothing: race times, idle help and the
// movement-break timer all read game time, which stands still.
//
// Reasons (any one keeps the game paused):
//   manual    ⏸ in the HUD or key P; also a return from a hidden tab. Shows the dim layer with one big ▶.
//   scorecard the ⭐ panel is open (window events scorecard:open / scorecard:close). No dim layer, so the „tap the
//             spot" step still sees the game. Closing the panel resumes only if nothing else holds the pause.
//   hidden    the tab or app is in the background (the render loop stops in engine.js; this also stops the voice).
import { E } from './engine.js';
import { Voice, Sfx } from './audio.js';
import { UI } from './ui.js';

export const Pause = {
  why: new Set(),
  get on() { return this.why.size > 0; },
  is(reason) { return this.why.has(reason); },

  set(reason, on) {
    const was = this.on;
    if (on) this.why.add(reason); else this.why.delete(reason);
    const now = this.on;
    if (now !== was) {
      E.hold = now; E.holdDirty = true;
      if (now) { Voice.hold(); Sfx.hold(true); } else { Voice.release(); Sfx.hold(false); }
      const app = document.getElementById('app');
      if (app) app.classList.toggle('paused', now);
    }
    UI.showPause(this.why.has('manual') && !this.why.has('scorecard'));
    const g = window.__game;
    if (g) { g.paused = now; g.pauseWhy = [...this.why]; (g.pauseLog ||= []).push(`${on ? '+' : '-'}${reason}@${E.time.toFixed(2)}`); if (g.pauseLog.length > 60) g.pauseLog.shift(); }
  },
  /** ⏸ / P: pause, or (when paused) resume everything a person can resume */
  toggle() { if (this.on && !this.why.has('scorecard')) this.resume(); else if (!this.on) this.set('manual', true); },
  /** ▶: the pause a person asked for ends (an open ⭐ panel keeps the game held until it closes) */
  resume() { this.set('hidden', false); this.set('manual', false); },

  init({ autoplay = false, inGame = () => true } = {}) {
    window.addEventListener('scorecard:open', () => this.set('scorecard', true));
    window.addEventListener('scorecard:close', () => this.set('scorecard', false));
    // a hidden tab: the loop already stops (engine.js); the voice and sounds stop here too.
    // Back on the tab: a game that was running stays paused behind the big ▶ until the child taps it
    // (autoplay test runs just carry on).
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.set('hidden', true); return; }
      const onlyHidden = this.why.size === 1 && this.why.has('hidden');
      if (onlyHidden && !autoplay && inGame()) this.set('manual', true);
      this.set('hidden', false);
    });
    if (document.hidden) this.set('hidden', true);
  },
};
