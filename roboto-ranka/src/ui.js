// DOM layer: HUD (home · progress · learned blocks · repeat · CC), captions with portraits,
// hotspot buttons that sit over 3D objects (touch + keyboard), overlays, the parent card (with the sound switch),
// and the big "sound is off" button that shows in every scene while sound is off.
import * as THREE from './three.js';
import { E } from './engine.js';
import { SVG } from './icons.js';
import { isShown } from './util.js';

const $ = (id) => document.getElementById(id);
export const PROGRESS = ['story', 'idea', 'build', 'program', 'mission', 'quiz', 'takeapart', 'reward', 'trophy'];

export const UI = {
  hots: new Set(),
  init(handlers) {
    this.h = handlers;
    $('btn-home').innerHTML = SVG.home;
    $('btn-repeat').innerHTML = SVG.replayVoice; // its own picture: never the same as the sound on/off button
    $('btn-cc').innerHTML = SVG.cc;
    $('btn-skip').innerHTML = SVG.skip;
    $('btn-home').addEventListener('click', () => handlers.home());
    $('btn-repeat').addEventListener('click', () => handlers.repeat());
    $('btn-cc').addEventListener('click', () => handlers.cc());
    $('btn-skip').addEventListener('click', () => handlers.skip());
    // sound off = a non-reader loses every instruction, so there is no mute in the child's HUD (it lives in the
    // parent card) and, while sound is off, one big pulsing crossed speaker sits top centre: one tap = sound on
    const so = document.createElement('button');
    so.type = 'button'; so.id = 'sound-off'; so.className = 'btn'; so.hidden = true;
    so.setAttribute('aria-label', 'Įjungti garsą');
    so.innerHTML = SVG.mute;
    so.addEventListener('click', (e) => { e.stopPropagation(); handlers.mute(false); });
    $('app').appendChild(so);
    // ⏸ pause (icon only, beside repeat + CC, same look). Key P does the same. Paused: a dim layer with one big ▶.
    const pb = document.createElement('button');
    pb.type = 'button'; pb.id = 'btn-pause'; pb.className = 'btn';
    pb.setAttribute('aria-label', 'Pauzė'); pb.setAttribute('aria-pressed', 'false');
    pb.innerHTML = SVG.pause;
    pb.addEventListener('click', (e) => { e.stopPropagation(); handlers.pause(); });
    $('hud').insertBefore(pb, $('btn-repeat'));
    const po = document.createElement('div');
    po.id = 'pause-ov'; po.hidden = true;
    po.setAttribute('role', 'dialog'); po.setAttribute('aria-modal', 'true'); po.setAttribute('aria-label', 'Pauzė');
    const pp = document.createElement('button');
    pp.type = 'button'; pp.className = 'btn go huge pulse'; pp.setAttribute('aria-label', 'Tęsti'); pp.innerHTML = SVG.play;
    pp.addEventListener('click', (e) => { e.stopPropagation(); handlers.resume(); });
    po.appendChild(pp);
    // a tap beside the ▶ does nothing (no accidental resume), it only nudges the ▶
    po.addEventListener('click', (e) => { if (e.target === po) { pp.classList.remove('wiggle'); void pp.offsetWidth; pp.classList.add('wiggle'); } });
    $('app').appendChild(po);
    const pr = $('progress');
    pr.innerHTML = PROGRESS.map(() => '<span class="dot"></span>').join('');
    // no "turn your phone" hint any more: a phone held upright gets the whole game turned (engine.js applyRot)
    E.onFrame.add(() => this.updateHots());
  },

  hud(show) { $('hud').hidden = !show; },
  /** the paused layer: shown for a pause someone asked for (⏸ / P / back from a hidden tab), not under the ⭐ panel */
  showPause(on) {
    const po = $('pause-ov'), pb = $('btn-pause');
    if (!po) return;
    pb.setAttribute('aria-pressed', String(!!on));
    if (on === !po.hidden) return;
    if (on) {
      this._pauseFocus = document.activeElement;
      po.hidden = false;
      po.firstChild.focus({ preventScroll: true });
    } else {
      const back = this._pauseFocus;
      po.hidden = true;
      this._pauseFocus = null;
      // focus goes back where it was (never to ⏸ itself: Space must drive the game again, not pause it)
      if (back && back !== pb && back.isConnected && back.focus) back.focus({ preventScroll: true });
      else { const a = document.activeElement; if (a && (a === pb || po.contains(a))) a.blur(); }
    }
  },
  pauseShown() { const po = $('pause-ov'); return !!po && !po.hidden; },
  setProgress(sceneId) {
    const i = PROGRESS.indexOf(sceneId);
    const pr = $('progress');
    pr.style.visibility = i < 0 ? 'hidden' : 'visible';
    [...pr.children].forEach((d, k) => { d.className = 'dot' + (k < i ? ' done' : k === i ? ' now' : ''); });
  },
  setCC(on) { $('btn-cc').setAttribute('aria-pressed', String(on)); $('btn-cc').style.opacity = on ? 1 : 0.5; if (!on) $('caption').hidden = true; },
  setMute(m) {
    this._muted = m;
    $('sound-off').hidden = !m;
    $('app').classList.toggle('muted', m);
    if (this._soundSwitch) this._soundSwitch();
  },
  setPocket(blocks) {
    const p = $('pocket');
    p.innerHTML = '';
    if (!blocks || !blocks.length) { p.hidden = true; return; }
    for (const b of blocks) p.appendChild(block(b, true));
    p.hidden = false;
  },
  pocketRect() { const p = $('pocket'); return p.hidden ? null : E.rectOf(p); }, // app-local

  /* ---------- captions ---------- */
  caption(line, ccOn) {
    clearTimeout(this._capT);
    const cap = $('caption');
    if (!ccOn) { cap.hidden = true; return; }
    const face = $('cap-face');
    if (line.speaker === 'narrator') face.innerHTML = SVG.narrator.replace('<svg', '<svg style="color:#2b1a5a"');
    else face.innerHTML = `<img src="img/${line.speaker}.jpg" alt="">`;
    $('cap-text').textContent = line.text;
    cap.hidden = false;
    cap.classList.remove('fade');
    $('btn-skip').hidden = !this.skipAllowed;
  },
  captionEnded() {
    $('btn-skip').hidden = true;
    clearTimeout(this._capT);
    this._capT = setTimeout(() => $('caption').classList.add('fade'), 2600);
  },
  clearCaption() { clearTimeout(this._capT); $('caption').hidden = true; },

  /* ---------- hotspots ---------- */
  hot({ obj, offset = [0, 0, 0], r = 0.6, minPx = 72, maxPx = 220, label = '', onTap }) {
    const b = document.createElement('button');
    b.className = 'hot';
    b.type = 'button';
    b.setAttribute('aria-label', label);
    const h = {
      b, obj, offset: new THREE.Vector3(...offset), r, minPx, maxPx, enabled: true,
      pulse(on = true) { b.classList.toggle('pulse', on); },
      remove() { b.remove(); UI.hots.delete(h); },
      set(on) { h.enabled = on; },
    };
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (h.enabled) onTap(h); });
    $('hot-layer').appendChild(b);
    this.hots.add(h);
    this.updateHot(h);
    return h;
  },
  updateHots() { for (const h of this.hots) this.updateHot(h); },
  updateHot(h) {
    const cam = E.camera;
    const shown = h.enabled && h.obj && h.obj.parent && isShown(h.obj);
    if (!shown) { if (!h.b.hidden) h.b.hidden = true; return; }
    const p = _p.copy(h.offset);
    h.obj.localToWorld(p);
    _q.copy(p);
    p.project(cam);
    if (p.z > 1 || p.z < -1) { h.b.hidden = true; return; }
    const x = (p.x * 0.5 + 0.5) * E.w, y = (-p.y * 0.5 + 0.5) * E.h;
    // projected radius
    _r.setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(h.r).add(_q).project(cam);
    const rx = Math.abs((_r.x - p.x) * 0.5 * E.w);
    const size = Math.max(h.minPx, Math.min(h.maxPx, rx * 2));
    h.b.hidden = false;
    h.b.style.left = x + 'px';
    h.b.style.top = y + 'px';
    h.b.style.width = h.b.style.height = size + 'px';
  },
  clearHots() { for (const h of [...this.hots]) h.remove(); },

  /* ---------- scene ui ---------- */
  sceneEl() { return $('scene-ui'); },
  clearScene() { $('scene-ui').innerHTML = ''; this.clearHots(); this.closeOverlays(); },
  add(html, cls = '') {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.innerHTML = html;
    $('scene-ui').appendChild(d);
    return d;
  },
  button({ icon, cls = '', label, onClick, parent, emoji, text }) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + cls;
    b.setAttribute('aria-label', label || '');
    b.innerHTML = emoji ? `<span class="emoji" aria-hidden="true">${emoji}</span>` : SVG[icon] || '';
    if (text) b.title = text;
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick && onClick(e); });
    (parent || $('scene-ui')).appendChild(b);
    return b;
  },
  pill({ icon, emoji, text, onClick, parent, label }) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill';
    b.setAttribute('aria-label', label || text);
    b.innerHTML = `<span class="ico">${emoji ? `<span class="emoji" aria-hidden="true">${emoji}</span>` : SVG[icon]}</span><span>${text}</span>`;
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick && onClick(e); });
    (parent || $('scene-ui')).appendChild(b);
    return b;
  },
  /** big "→ continue" button bottom-right */
  next(onClick, label = 'Toliau') {
    const w = this.add('', 'corner-br');
    const b = this.button({ icon: 'next', cls: 'main go pop-in', label, onClick, parent: w });
    b.focus({ preventScroll: true });
    return { el: w, btn: b, remove: () => w.remove() };
  },
  floatNum(text, x, y) {
    const d = document.createElement('div');
    d.className = 'big-num float-up';
    d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    $('scene-ui').appendChild(d);
    setTimeout(() => d.remove(), 1200);
  },
  screenOf(obj, offset = [0, 0, 0]) {
    const p = new THREE.Vector3(...offset);
    obj.localToWorld(p);
    p.project(E.camera);
    return { x: (p.x * 0.5 + 0.5) * E.w, y: (-p.y * 0.5 + 0.5) * E.h };
  },

  /* ---------- overlays ---------- */
  overlay(inner, { onClose } = {}) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    const card = document.createElement('div');
    card.className = 'ov-card';
    if (typeof inner === 'string') card.innerHTML = inner; else card.appendChild(inner);
    ov.appendChild(card);
    $('overlay-root').appendChild(ov);
    const close = () => { ov.remove(); onClose && onClose(); };
    ov._close = close;
    return { ov, card, close };
  },
  closeOverlays() { for (const o of [...$('overlay-root').children]) o.remove(); },
  hasOverlay() { return $('overlay-root').children.length > 0; },

  confirmHome(onYes) {
    const { card, close } = this.overlay('<div class="ov-row" style="margin:6px 0"></div>');
    const row = card.querySelector('.ov-row');
    const yes = this.button({ icon: 'home', cls: 'main', label: 'Taip, į pradžią', onClick: () => { close(); onYes(); }, parent: row });
    this.button({ icon: 'close', cls: 'main go', label: 'Ne, žaidžiu toliau', onClick: () => close(), parent: row });
    yes.style.borderColor = '#fff';
    row.lastChild.focus();
  },

  parentCard() {
    // the child's own last run (counts only, saved on this device) once a run is finished; before that, what the lesson does
    const rep = (this.h.report && this.h.report()) || {};
    const L = rep.completed && rep.last ? rep.last : null;
    let done = '';
    if (L) {
      const li = [];
      const kartai = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'kartą' : n % 10 >= 2 && !(n % 100 >= 11 && n % 100 <= 19) ? 'kartus' : 'kartų'}`;
      if (L.build != null) li.push('Surinko robotą su ranka: 10 žingsnių');
      if (L.programFails != null) li.push('Programą sudėjo ' + (['iš pirmo karto', 'iš antro karto', 'iš trečio karto'][L.programFails] || 'po kelių bandymų'));
      if (L.wrongBins != null) li.push(`Surūšiavo ${L.collected != null ? L.collected : 9} iš 9 šiukšlių` + (L.wrongBins === 0 ? ', be klaidų' : `, konteinerį supainiojo ${kartai(L.wrongBins)}`));
      if (L.quizFirstTry != null) li.push(`Į ${L.quizFirstTry} iš ${L.quizTotal || 4} klausimų atsakė iš pirmo karto`);
      const st = Math.max(0, Math.min(3, L.stars || 0));
      done = `<h3>Ką jūsų vaikas nuveikė šioje pamokoje</h3>
        <ul class="pc-done">${li.map((t) => `<li>${t}</li>`).join('')}</ul>
        ${L.stars != null ? `<div class="pc-stars" aria-label="${st} iš 3 žvaigždučių">${[0, 1, 2].map((i) => (i < st ? SVG.starOn : SVG.starOff)).join('')}</div>` : ''}`;
    } else {
      done = `<h3>Ką vaikas veikia</h3>
        <ul>
          <li>Stato robotą su griebiančia ranka: dvi sijos, kaištis ir gumytė.</li>
          <li>Sužino, kiek ilgai šiukšlės guli gamtoje, ir mokosi rūšiuoti: popierius keliauja į mėlyną, plastikas į geltoną, stiklas į žalią konteinerį.</li>
          <li>Sudeda pirmąją programą: robotas komandas vykdo iš eilės.</li>
        </ul>`;
    }
    const html = `
      <div class="parent-card">
        <div class="pc-body">
        <h2>Tėvams</h2>
        <p><b>7 pamoka „Roboto ranka: sutvarkyk parką“</b> · 5–6 metų vaikams · apie 10–15 min</p>
        ${done}
        <h3>Ką tai lavina</h3>
        <ul>
          <li>Rūšiavimas ir rūpinimasis gamta</li>
          <li>Skaičiavimas iki 7 ir formų atpažinimas</li>
          <li>Komandų seka: programavimo pagrindas</li>
          <li>Atkaklumas: nepavyko, bandau dar kartą</li>
        </ul>
        <p>Robotikos akademijos pamokoje vaikai tokį robotą stato iš tikrų detalių, kartu su mentoriumi.</p>
        <h3>Paklauskite namuose</h3>
        <p>„Į kurį konteinerį mesime šį butelį?“</p>
        <h3>Garsas</h3>
        <p>Užduotys skamba balsu. Išjungus garsą vaikas jų neišgirs, todėl viršuje atsiras didelis mygtukas garsui įjungti.</p>
        <div class="sound-row"></div>
        <p class="note"><b>Svarbu žinoti:</b> Bandomoji versija, nemokama. Sukurta su dirbtiniu intelektu, gali pasitaikyti klaidų. Skaičiai apytiksliai. Pažanga saugoma tik šiame įrenginyje. Žaidimas siunčia tik tai, ką pasirenkate paspaudę „Įvertinkite“: anonimiškai, be vardų ir be slapukų.</p>
        <p>Pastebėjote klaidą ar turite idėją? Įvertinkite žaidimą (apie 20 sekundžių). Atsakymus skaito žaidimo kūrėjai.</p>
        <div class="rate-row"></div>
        <div class="reset-row"></div>
        </div>
        <div class="close-row"></div>
      </div>`;
    const { card, close } = this.overlay(html, { onClose: () => { this._soundSwitch = null; } });
    card.classList.add('pc-card');
    // reset with an in-page second step (never the browser's confirm dialog)
    const rr = card.querySelector('.reset-row');
    const tb = (text, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'link-btn ' + cls; b.textContent = text; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); rr.appendChild(b); return b; };
    const resetStep1 = () => { rr.innerHTML = ''; tb('Pradėti iš naujo (ištrinti pažangą)', 'reset', resetStep2); };
    const resetStep2 = () => {
      rr.innerHTML = '<p class="reset-q">Tikrai ištrinti? Robotas, parkas ir žvaigždutės dings.</p>';
      // a double tap on the first button must never wipe the progress: „Ne“ comes first, and „Taip“ wakes up after a moment
      const no = tb('Ne', 'no', resetStep1);
      const t0 = performance.now();
      const yes = tb('Taip, ištrinti', 'yes danger', () => { if (performance.now() - t0 < 1200) return; close(); this.h.reset && this.h.reset(); });
      yes.disabled = true; yes.style.opacity = '.45';
      setTimeout(() => { yes.disabled = false; yes.style.opacity = ''; }, 1200);
      no.focus();
    };
    resetStep1();
    // sound on/off switch: shows the current state in picture + words; one tap flips it
    const row = card.querySelector('.sound-row');
    this._soundSwitch = () => {
      row.innerHTML = '';
      const m = !!this._muted;
      const p = this.pill({ icon: m ? 'mute' : 'speaker', text: m ? 'Garsas išjungtas' : 'Garsas įjungtas', label: m ? 'Garsas išjungtas. Įjungti garsą' : 'Garsas įjungtas. Išjungti garsą', onClick: () => this.h.mute(!this._muted), parent: row });
      p.classList.add('sound-switch'); p.classList.toggle('off', m); p.setAttribute('aria-pressed', String(!m));
    };
    this._soundSwitch();
    // ⭐ Scorecard for grown-ups: parent, mentor, tester or creator picks their role inside
    if (window.Scorecard) this.pill({ emoji: '⭐', text: 'Įvertinkite', label: 'Įvertinkite žaidimą', onClick: () => window.Scorecard.open(), parent: card.querySelector('.rate-row') });
    const b = this.button({ icon: 'close', cls: '', label: 'Uždaryti', onClick: () => close(), parent: card.querySelector('.close-row') });
    b.focus();
    return close;
  },
};

const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _r = new THREE.Vector3();

/** program block element: drive / grab / release */
export function block(kind, mini = false) {
  const d = document.createElement('div');
  d.className = `blk ${kind}${mini ? ' mini' : ''}`;
  d.dataset.kind = kind;
  d.innerHTML = kind === 'drive' ? SVG.up : kind === 'grab' ? SVG.fist : SVG.hand; // own glyphs, the same on every device
  return d;
}
export const BLOCK_LABEL = { drive: 'Važiuok', grab: 'Suimk', release: 'Paleisk' };
