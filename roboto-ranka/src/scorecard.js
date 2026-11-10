/*! scorecard.js v1.1 · ⭐ one feedback button for every build · Kris Vas · 2026-11-10
 *
 * Copy this file into your build, then add ONE line before </body>:
 *   <script src="src/scorecard.js"
 *           data-project="ra-lesson-07" data-version="v8" data-mode="kids" defer></script>
 *
 * data-project  short name of the build (a-z 0-9 . _ -). Required in practice.
 * data-version  "v6", "2026-11-10" … so feedback is tied to the exact build.
 * data-mode     kids  → child role first, faces only, no free text from children,
 *                       no localStorage, no page text captured.
 *               full  → adults (team, parents, teachers). Default.
 * data-lang     lt | en (default: the page's <html lang>)
 * data-pos      bl | br | tl | tr | ml | mr  corner or middle edge of the floating button (default bl)
 * data-roles    "vaikas,tevai,mentorius,testuotojas,kurejas,vartotojas" (subset, in order)
 * data-hidden   1 → no floating button; open it from your own UI with Scorecard.open()
 *               (a link with ?scorecard or #scorecard shows the button anyway, for test sessions)
 * data-label    custom button text
 * data-mount    CSS selector to mount inside (e.g. "#app" when the game turns its own box on phones held
 *               upright: the panel then turns with the game and 📍 spots are saved in the game's own box)
 *
 * JS:  Scorecard.open({ role: 'vaikas' })   Scorecard.close()   Scorecard.isOpen()
 *      Scorecard.context = () => ({ scene: 'mission', round: 2 })   (what the person was looking at)
 *      window events: scorecard:open · scorecard:close · scorecard:sent  (pause your game on open)
 *
 * Saves to Supabase public.scorecard (kris-life-os): insert-only for the public key, no names,
 * no device id, no cookies. The table has no IP column (Supabase's own request logs keep IPs for a
 * short time). Public read = averages only (rpc scorecard_summary).
 * If sending fails (offline, sandbox), the panel says so honestly and offers "copy as text".
 * Full mode also retries quietly on the next visit; kids mode keeps nothing.
 */
(function () {
  'use strict';
  if (window.Scorecard && window.Scorecard.v) return;

  var SB_URL = 'https://iiekmeylpppczicrsxho.supabase.co';
  var SB_KEY = 'sb_publishable_iJC59f30YJm7hU4OwZsLDQ_9FN-ygzF';
  var QKEY = 'scorecard-queue-v1';

  var me = document.currentScript;
  function attr(n, d) { var v = me && me.getAttribute('data-' + n); return v == null || v === '' ? d : v; }
  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z0-9]+/, '').slice(0, 60) || 'unknown';
  }

  /* ---------- roles and questions ---------- */
  var ROLES = {
    vaikas:      { icon: '🧒', lt: 'Vaikas',      en: 'Child' },
    tevai:       { icon: '👪', lt: 'Tėvai',       en: 'Parent' },
    mentorius:   { icon: '🧑‍🏫', lt: 'Mentorius',   en: 'Mentor' },
    testuotojas: { icon: '🧪', lt: 'Testuotojas', en: 'Tester' },
    kurejas:     { icon: '🛠️', lt: 'Kūrėjas',     en: 'Creator' },
    vartotojas:  { icon: '🙋', lt: 'Naudotojas',  en: 'User' }
  };
  var CRIT = {
    tevai: [
      ['vaikui_patiko', 'Vaikui patiko', 'My child liked it'],
      ['supratau', 'Supratau, ko tai moko', 'I understand what it teaches'],
      ['rekomenduociau', 'Rekomenduočiau kitiems tėvams', 'I would recommend it to other parents']
    ],
    mentorius: [
      ['mokymosi_verte', 'Mokymosi vertė', 'Learning value'],
      ['isitraukimas', 'Vaikai įsitraukė', 'Kids were engaged'],
      ['aiskumas', 'Aišku be mano paaiškinimų', 'Clear without me explaining'],
      ['tinka_pamokai', 'Tinka pamokai (laikas, amžius)', 'Fits the lesson (time, age)']
    ],
    testuotojas: [
      ['veikia', 'Veikia be klaidų', 'Works without bugs'],
      ['aiskumas', 'Aišku, ką daryti', 'Clear what to do'],
      ['greitis', 'Greitas, nestringa', 'Fast, no lag'],
      ['smagu', 'Smagu', 'Fun']
    ],
    kurejas: [
      ['atitinka_tiksla', 'Atitinka tikslą', 'Meets the goal'],
      ['kokybe', 'Kokybė', 'Quality'],
      ['paruosta', 'Paruošta rodyti žmonėms', 'Ready to show people']
    ],
    vartotojas: [
      ['naudinga', 'Naudinga', 'Useful'],
      ['aisku', 'Aišku', 'Clear'],
      ['grazu', 'Gražu', 'Looks good']
    ]
  };
  var AGAIN_Q = {
    tevai:       ['Ar vaikas norės dar?', 'Will your child want it again?'],
    mentorius:   ['Naudotum pamokoje?', 'Would you use it in class?'],
    testuotojas: ['Rodytum žmonėms jau dabar?', 'Show it to people now?'],
    kurejas:     ['Paruošta rodyti?', 'Ready to show?'],
    vartotojas:  ['Naudotum dar?', 'Would you use it again?']
  };
  var T = {
    lt: {
      btn: '⭐ Įvertink', title: 'Įvertink', who: 'Kas vertina?', overall: 'Bendras įvertinimas',
      like: 'Ar patiko?', againChild: 'Žaistum dar?', hard: 'Ar buvo sunku?',
      easy: 'Lengva', ok: 'Gerai', hardv: 'Sunku', yes: 'Taip', maybe: 'Gal', no: 'Ne',
      comment: 'Ką pagerinti? Kas patiko labiausiai?', nonames: 'Nerašyk vardų ar kitų asmens duomenų.',
      spot: '📍 Parodyk vietą ekrane', spotChild: '👉 Parodyk, kas patiko', spotSet: '📍 Vieta pažymėta ✓ (keisti)',
      spotHint: 'Paliesk vietą ekrane', cancel: 'Atšaukti', send: 'Siųsti', back: '← Atgal', close: 'Uždaryti',
      thanks: 'Ačiū! 💛', sent: 'Įvertinimas išsiųstas.', sending: 'Siunčiama…',
      notsent: 'Neišsiųsta: šis puslapis dabar negali pasiekti interneto. Nukopijuok tekstą ir atsiųsk jį kūrėjui.',
      notsentKids: 'Neišsiųsta. Suaugęs gali paspausti „Kopijuoti“ ir atsiųsti tekstą kūrėjui.',
      rejected: 'Serveris šio atsakymo nepriėmė. Nukopijuok tekstą ir atsiųsk jį kūrėjui.',
      copy: '📋 Kopijuoti tekstą', copied: 'Nukopijuota ✓', others: 'Visų įvertinimas', first: 'Tu vertini pirmas!',
      privacy: 'Anonimiška: be vardų, be slapukų.', need: 'Pasirink bent vieną atsakymą.', of5: 'iš 5', votes: 'įvert.'
    },
    en: {
      btn: '⭐ Scorecard', title: 'Scorecard', who: 'Who is rating?', overall: 'Overall',
      like: 'Did you like it?', againChild: 'Play again?', hard: 'Was it hard?',
      easy: 'Easy', ok: 'OK', hardv: 'Hard', yes: 'Yes', maybe: 'Maybe', no: 'No',
      comment: 'What should we improve? What did you like most?', nonames: 'No names or other personal details, please.',
      spot: '📍 Point at the spot on screen', spotChild: '👉 Show what you liked', spotSet: '📍 Spot marked ✓ (change)',
      spotHint: 'Tap the spot on the screen', cancel: 'Cancel', send: 'Send', back: '← Back', close: 'Close',
      thanks: 'Thank you! 💛', sent: 'Your rating was sent.', sending: 'Sending…',
      notsent: 'Not sent: this page cannot reach the internet right now. Copy the text and send it to the creator.',
      notsentKids: 'Not sent. A grown-up can press "Copy" and send the text to the creator.',
      rejected: 'The server did not accept this answer. Copy the text and send it to the creator.',
      copy: '📋 Copy as text', copied: 'Copied ✓', others: 'Everyone\'s rating', first: 'You are the first to rate!',
      privacy: 'Anonymous: no names, no cookies.', need: 'Pick at least one answer.', of5: 'of 5', votes: 'ratings'
    }
  };

  /* ---------- config ---------- */
  var seg = location.pathname.split('/').filter(Boolean);
  var onPages = /\.github\.io$/.test(location.hostname);
  var CFG = {
    project: slug(attr('project', onPages ? (seg[0] || location.hostname) : location.hostname)),
    version: String(attr('version', '')).slice(0, 30),
    mode: attr('mode', 'full') === 'kids' ? 'kids' : 'full',
    lang: String(attr('lang', document.documentElement.lang || 'lt')).slice(0, 2).toLowerCase() === 'en' ? 'en' : 'lt',
    pos: /^(bl|br|tl|tr|ml|mr)$/.test(attr('pos', 'bl')) ? attr('pos', 'bl') : 'bl',
    hidden: attr('hidden', '0') === '1' && !/[?&#]scorecard\b/.test(location.search + location.hash),
    label: attr('label', ''),
    mount: attr('mount', '')
  };
  var KIDS = CFG.mode === 'kids';
  var L = T[CFG.lang];
  var LI = CFG.lang === 'en' ? 2 : 1;
  var ORDER = KIDS ? ['vaikas', 'tevai', 'mentorius', 'testuotojas', 'kurejas']
                   : ['vartotojas', 'testuotojas', 'kurejas', 'mentorius', 'tevai'];
  var rolesAttr = attr('roles', '');
  if (rolesAttr) {
    var custom = rolesAttr.split(',').map(function (x) { return x.trim(); }).filter(function (x) { return ROLES[x]; });
    if (custom.length) ORDER = custom;
  }
  var SRC = 'direct';
  try { var qp = new URLSearchParams(location.search); SRC = (qp.get('src') || qp.get('utm_source') || 'direct').slice(0, 40); } catch (e) {}
  var IS_TEST = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
                /[?&#](test|qa|debug)\b/.test(location.search + location.hash);

  function device() {
    var w = Math.min(window.innerWidth, window.innerHeight);
    var touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (touch && w < 600) return 'phone';
    if (touch && w < 1100) return 'tablet';
    return 'desktop';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- queue (full mode keeps it across reloads; kids mode memory only) ---------- */
  var Q = [];
  function loadQ() { if (KIDS) return; try { Q = JSON.parse(localStorage.getItem(QKEY) || '[]') || []; } catch (e) { Q = []; } }
  function saveQ() { if (KIDS) return; try { localStorage.setItem(QKEY, JSON.stringify(Q.slice(-20))); } catch (e) {} }
  function post(row) {
    if (!window.fetch) return Promise.reject(new Error('no fetch'));
    return fetch(SB_URL + '/rest/v1/scorecard', {
      method: 'POST', keepalive: true,
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row)
    }).then(function (r) { if (!r.ok) { var er = new Error('http ' + r.status); er.status = r.status; throw er; } });
  }
  // 4xx (except timeout / rate limit) = the server refused this row: retrying would never work
  function refused(er) { var c = (er && er.status) || 0; return c >= 400 && c < 500 && c !== 408 && c !== 429; }
  function flushQ() {
    if (!Q.length) return;
    var batch = Q.splice(0); saveQ();
    batch.forEach(function (row) { post(row).catch(function (er) { if (refused(er)) return; Q.push(row); saveQ(); }); });
  }
  function summary() {
    if (!window.fetch) return Promise.resolve(null);
    return fetch(SB_URL + '/rest/v1/rpc/scorecard_summary', {
      method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_project: CFG.project })
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  /* ---------- state ---------- */
  var S = null;
  function fresh(role) {
    return { step: role ? 'form' : 'role', role: role || null, overall: null, again: null, scores: {}, comment: '',
             spot: null, result: null, sum: null, copied: false, warn: false, sending: false };
  }

  /* ---------- mounted inside a turned game box? (phones held upright) ---------- */
  function mountEl() {
    var p = host && host.parentNode;
    return p && p !== document.body && p !== document.documentElement && p.getBoundingClientRect ? p : null;
  }
  function turn(el) { // 0 · 90 · 180 · 270: how far the mount box is rotated on screen
    try {
      var m = getComputedStyle(el).transform; if (!m || m === 'none') return 0;
      var v = m.match(/matrix\(([^)]+)\)/); if (!v) return 0;
      var p = v[1].split(',').map(parseFloat);
      return (Math.round(Math.atan2(p[1], p[0]) * 180 / Math.PI / 90) * 90 + 360) % 360;
    } catch (e) { return 0; }
  }
  function local(x, y) { // screen point → the mount box's own px (what the person saw), plus its size
    var el = mountEl();
    if (!el) return { x: x, y: y, w: window.innerWidth, h: window.innerHeight, rot: 0 };
    var r = el.getBoundingClientRect(), t = turn(el), w = el.clientWidth || r.width, h = el.clientHeight || r.height;
    if (t === 90) return { x: y - r.top, y: r.right - x, w: w, h: h, rot: 90 };
    if (t === 270) return { x: r.bottom - y, y: x - r.left, w: w, h: h, rot: 270 };
    if (t === 180) return { x: r.right - x, y: r.bottom - y, w: w, h: h, rot: 180 };
    return { x: x - r.left, y: y - r.top, w: w, h: h, rot: 0 };
  }

  function context() {
    var c = {};
    try {
      var x = typeof API.context === 'function' ? API.context() : null;
      if (!x && window.__game && window.__game.scene) x = { scene: window.__game.scene };
      if (x && typeof x === 'object') for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) c[k] = x[k];
    } catch (e) {}
    if (location.hash) c.hash = location.hash.slice(0, 60);
    c.w = window.innerWidth; c.h = window.innerHeight;
    var me2 = mountEl(), t = me2 ? turn(me2) : 0;
    if (t) c.rot = t;
    var s = JSON.stringify(c);
    if (s.length > 1500) c = { note: 'context too big', scene: c.scene || null, w: c.w, h: c.h };
    return c;
  }
  function describe(el) {
    if (!el || !el.tagName) return '';
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    var cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    if (!KIDS) {
      var lab = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || '';
      var txt = lab || (el.children.length < 4 ? (el.textContent || '').trim().replace(/\s+/g, ' ') : '');
      if (txt && el.tagName !== 'CANVAS') s += ' "' + txt.slice(0, 40) + '"';
    }
    return s.slice(0, 120);
  }

  function row() {
    var r = {
      project: CFG.project, version: CFG.version || null, page: location.pathname.slice(0, 200), role: S.role,
      overall: S.overall, again: S.again, scores: S.scores,
      comment: S.role === 'vaikas' ? null : (S.comment.trim().slice(0, 1000) || null),
      spot: S.spot, context: context(), lang: CFG.lang, device: device(), src: SRC, is_test: IS_TEST || !!window.SCORECARD_TEST
    };
    return r;
  }
  function asText(r) {
    var lines = ['⭐ Scorecard · ' + r.project + (r.version ? ' ' + r.version : '') + ' · ' + (ROLES[r.role] ? ROLES[r.role][CFG.lang] : r.role)];
    if (r.overall) lines.push(L.overall + ': ' + r.overall + '/5');
    if (r.again) lines.push((r.role === 'vaikas' ? L.againChild : (AGAIN_Q[r.role] || ['', ''])[LI - 1]) + ' ' + r.again);
    Object.keys(r.scores || {}).forEach(function (k) { lines.push(k + ': ' + r.scores[k]); });
    if (r.comment) lines.push('💬 ' + r.comment);
    if (r.spot) lines.push('📍 ' + Math.round(r.spot.x) + '% × ' + Math.round(r.spot.y) + '% ' + (r.spot.el || ''));
    if (r.context && r.context.scene) lines.push('🎬 ' + r.context.scene);
    lines.push(location.href.split('?')[0]);
    return lines.join('\n');
  }

  /* ---------- DOM (shadow root, so the page's CSS never leaks in or out) ---------- */
  var host, root, fab, layer, lastRow = null, lastFocus = null;

  var CSS = '' +
    ':host{all:initial}' +
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}' +
    '.fab{position:fixed;z-index:2147483000;display:flex;align-items:center;gap:6px;min-height:44px;padding:8px 14px;border-radius:999px;' +
      'border:2px solid #0A0A0A;background:#FFD43B;color:#0A0A0A;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.25);opacity:.92}' +
    '.fab:hover,.fab:focus-visible{opacity:1;outline:3px solid #2F6FEB;outline-offset:2px}' +
    '.bl{left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom))}' +
    '.br{right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom))}' +
    '.tl{left:max(12px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top))}' +
    '.tr{right:max(12px,env(safe-area-inset-right));top:max(12px,env(safe-area-inset-top))}' +
    '.ml{left:max(8px,env(safe-area-inset-left));top:50%;transform:translateY(-50%)}' +
    '.mr{right:max(8px,env(safe-area-inset-right));top:50%;transform:translateY(-50%)}' +
    '.back{position:fixed;inset:0;z-index:2147483001;background:rgba(10,10,10,.45);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.card{--bg:#FFFFFF;--ink:#0A0A0A;--mut:#5A5A5A;--line:#E3E3E0;--soft:#F7F7F5;--acc:#D90429;--star:#F5B301;--off:#B5B5AE;--sel:#FFF3C4;' +
      'background:var(--bg);color:var(--ink);width:min(440px,100%);max-height:100%;overflow:auto;outline:none;border-radius:16px;padding:18px 18px 16px;box-shadow:0 10px 40px rgba(0,0,0,.35);font-size:16px;line-height:1.35}' +
    '@media (prefers-color-scheme:dark){.card{--bg:#17171A;--ink:#F4F4F2;--mut:#A9A9A6;--line:#33333A;--soft:#222228;--off:#6A6A72;--sel:#4A3F12}}' +
    '.top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}' +
    'h2{font-size:20px;margin:0}' +
    '.x{border:0;background:var(--soft);color:var(--ink);width:44px;height:44px;border-radius:12px;font-size:20px;cursor:pointer}' +
    '.q{font-weight:700;margin:14px 0 8px}' +
    '.roles{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}' +
    '.role{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px;border:2px solid var(--line);border-radius:14px;background:var(--soft);color:var(--ink);font-size:15px;font-weight:600;cursor:pointer;min-height:84px}' +
    '.role span{font-size:34px;line-height:1}' +
    '.row{display:flex;gap:8px;flex-wrap:wrap}' +
    '.face{flex:1;min-width:72px;min-height:84px;font-size:46px;border:3px solid var(--line);border-radius:18px;background:var(--soft);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--ink)}' +
    '.face small{font-size:14px;font-weight:600;margin-top:2px}' +
    '.chip{flex:1;min-height:48px;padding:8px 10px;border:2px solid var(--line);border-radius:12px;background:var(--soft);color:var(--ink);font-size:15px;font-weight:600;cursor:pointer}' +
    '.on{border-color:var(--ink)!important;background:var(--sel)!important}' +
    '.stars{display:flex;gap:2px}' +
    '.star{width:44px;height:44px;border:0;background:transparent;font-size:30px;line-height:1;cursor:pointer;color:var(--off);padding:0}' +
    '.star.lit{color:var(--star)}' +
    '.crit{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:4px 0;border-top:1px solid var(--line)}' +
    '.crit .lab{flex:1 1 150px;font-size:15px}' +
    '.crit .star{width:36px;height:40px;font-size:24px}' +
    'textarea{width:100%;min-height:84px;padding:10px;border:2px solid var(--line);border-radius:12px;background:var(--soft);color:var(--ink);font-size:16px;resize:vertical}' +
    '.note{font-size:13px;color:var(--mut);margin:4px 0 0}' +
    '.btn{min-height:48px;padding:10px 16px;border-radius:12px;border:2px solid var(--ink);background:var(--soft);color:var(--ink);font-size:16px;font-weight:700;cursor:pointer}' +
    '.go{background:#0A0A0A;color:#fff;border-color:#0A0A0A;flex:1}' +
    '@media (prefers-color-scheme:dark){.go{background:#F4F4F2;color:#0A0A0A;border-color:#F4F4F2}}' +
    '.go[disabled]{opacity:.45;cursor:not-allowed}' +
    '.spot{width:100%;margin-top:12px}' +
    '.foot{display:flex;gap:8px;margin-top:16px}' +
    '.warn{color:var(--acc);font-weight:600;font-size:14px;margin-top:8px}' +
    '.big{font-size:44px;text-align:center;margin:8px 0}' +
    '.center{text-align:center}' +
    '.sum{margin:12px 0;padding:10px;border-radius:12px;background:var(--soft);text-align:center;font-weight:600}' +
    '.pinlayer{position:fixed;inset:0;z-index:2147483002;cursor:crosshair;background:rgba(47,111,235,.08)}' +
    '.pinbar{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483003;display:flex;gap:10px;align-items:center;' +
      'background:#0A0A0A;color:#fff;padding:8px 8px 8px 16px;border-radius:999px;font-size:16px;font-weight:700;box-shadow:0 4px 18px rgba(0,0,0,.35)}' +
    '.pinbar button{min-height:40px;border-radius:999px;border:0;padding:6px 14px;font-weight:700;cursor:pointer}' +
    '.pin{position:fixed;z-index:2147483002;width:34px;height:34px;margin:-34px 0 0 -17px;font-size:30px;line-height:1;pointer-events:none}' +
    '@media (max-width:480px){.back{align-items:flex-end;padding:0}.card{border-radius:18px 18px 0 0;max-height:92%}}' +
    '@media (prefers-reduced-motion:no-preference){.card.anim{animation:up .18s ease-out}@keyframes up{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}}';

  function mount() {
    if (host) return;
    host = document.createElement('div');
    host.setAttribute('data-scorecard', CFG.project);
    root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    layer = document.createElement('div'); root.appendChild(layer);
    if (!CFG.hidden) {
      fab = document.createElement('button');
      fab.className = 'fab ' + CFG.pos; fab.type = 'button';
      fab.textContent = CFG.label || L.btn;
      fab.setAttribute('aria-haspopup', 'dialog');
      fab.addEventListener('click', function () { API.open(); });
      root.appendChild(fab);
    }
    // keep the game from reacting to typing and taps inside the scorecard
    ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'wheel', 'contextmenu']
      .forEach(function (t) { host.addEventListener(t, function (e) { e.stopPropagation(); }); });
    root.addEventListener('click', onClick);
    root.addEventListener('input', function (e) {
      if (e.target && e.target.tagName === 'TEXTAREA' && S) { S.comment = e.target.value; refreshSend(); }
    });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S) { e.preventDefault(); escape(); } });
    // focus outside the panel (e.g. on the page body): Escape still closes the panel, not the page under it
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S) { e.preventDefault(); escape(); } });
    var target = null;
    if (CFG.mount) { try { target = document.querySelector(CFG.mount); } catch (e) {} }
    (target || document.body || document.documentElement).appendChild(host);
  }
  function escape() { if (S.step === 'pin') { S.step = 'form'; render(); } else API.close(); }

  function stars(name, val, small) {
    var h = '<div class="stars" role="radiogroup">';
    for (var i = 1; i <= 5; i++) {
      h += '<button type="button" class="star' + (val && i <= val ? ' lit' : '') + '" data-act="' + name + '" data-v="' + i + '" role="radio" aria-checked="' + (val === i) + '" aria-label="' + i + ' ' + L.of5 + '">★</button>';
    }
    return h + '</div>';
  }
  function choice(act, opts, val, cls) {
    return '<div class="row">' + opts.map(function (o) {
      return '<button type="button" class="' + cls + (val === o[0] ? ' on' : '') + '" data-act="' + act + '" data-v="' + o[0] + '" aria-pressed="' + (val === o[0]) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function canSend() { return !S.sending && !!(S.overall || S.again || Object.keys(S.scores).length || (S.role !== 'vaikas' && S.comment.trim())); }
  function refreshSend() { var b = root.querySelector('[data-act="send"]'); if (b) b.disabled = !canSend(); }

  function render() {
    if (!S) { layer.innerHTML = ''; return; }
    if (S.step === 'pin') {
      layer.innerHTML = '<div class="pinlayer" data-act="pinat" aria-label="' + esc(L.spotHint) + '"></div>' +
        '<div class="pinbar" role="status"><span>👉 ' + esc(L.spotHint) + '</span><button type="button" data-act="pincancel">' + esc(L.cancel) + '</button></div>';
      return;
    }
    // fade in only when the step changes, never on a tap inside the same step
    var h = '<div class="back" data-act="backdrop"><div class="card' + (S.step !== lastStep ? ' anim' : '') + '" role="dialog" aria-modal="true" aria-labelledby="sc-t" tabindex="-1">';
    h += '<div class="top"><h2 id="sc-t">⭐ ' + esc(L.title) + '</h2><button type="button" class="x" data-act="close" aria-label="' + esc(L.close) + '">✕</button></div>';

    if (S.step === 'role') {
      h += '<div class="q">' + esc(L.who) + '</div><div class="roles">';
      ORDER.forEach(function (k) {
        h += '<button type="button" class="role" data-act="role" data-v="' + k + '"><span>' + ROLES[k].icon + '</span>' + esc(ROLES[k][CFG.lang]) + '</button>';
      });
      h += '</div><p class="note">' + esc(L.privacy) + '</p>';
    } else if (S.step === 'form' && S.role === 'vaikas') {
      h += '<div class="q">' + ROLES.vaikas.icon + ' ' + esc(L.like) + '</div>';
      h += choice('overall', [[1, '😞'], [3, '😐'], [5, '😀']].map(function (o) { return [String(o[0]), o[1]]; }), S.overall ? String(S.overall) : null, 'face');
      h += '<div class="q">' + esc(L.againChild) + '</div>';
      h += choice('again', [['taip', '👍<small>' + esc(L.yes) + '</small>'], ['gal', '🤔<small>' + esc(L.maybe) + '</small>'], ['ne', '👎<small>' + esc(L.no) + '</small>']], S.again, 'face');
      h += '<div class="q">' + esc(L.hard) + '</div>';
      h += choice('hard', [['1', '🙂<small>' + esc(L.easy) + '</small>'], ['2', '👌<small>' + esc(L.ok) + '</small>'], ['3', '😣<small>' + esc(L.hardv) + '</small>']], S.scores.sunkumas ? String(S.scores.sunkumas) : null, 'face');
      h += '<button type="button" class="btn spot" data-act="pin">' + esc(S.spot ? L.spotSet : L.spotChild) + '</button>';
    } else if (S.step === 'form') {
      h += '<div class="q">' + ROLES[S.role].icon + ' ' + esc(L.overall) + '</div>' + stars('overall', S.overall);
      (CRIT[S.role] || []).forEach(function (c) {
        h += '<div class="crit"><span class="lab">' + esc(c[LI]) + '</span>' + stars('crit:' + c[0], S.scores[c[0]], true) + '</div>';
      });
      var aq = AGAIN_Q[S.role];
      if (aq) h += '<div class="q">' + esc(aq[LI - 1]) + '</div>' + choice('again', [['taip', L.yes], ['gal', L.maybe], ['ne', L.no]], S.again, 'chip');
      h += '<div class="q">' + esc(L.comment) + '</div><textarea maxlength="1000" aria-label="' + esc(L.comment) + '">' + esc(S.comment) + '</textarea>';
      h += '<p class="note">' + esc(L.nonames) + '</p>';
      h += '<button type="button" class="btn spot" data-act="pin">' + esc(S.spot ? L.spotSet : L.spot) + '</button>';
    } else if (S.step === 'done') {
      var msg = S.result === 'sent' ? L.sent : S.result === 'rejected' ? L.rejected : (KIDS ? L.notsentKids : L.notsent);
      h += '<div class="big">' + (S.result === 'sent' ? '💛' : '📋') + '</div><p class="center"><b>' + esc(L.thanks) + '</b><br>' + esc(msg) + '</p>';
      if (S.sum && typeof S.sum.n === 'number') {
        h += '<div class="sum">' + (S.sum.n > 0 && S.sum.overall ? esc(L.others) + ': ★ ' + String(S.sum.overall).replace('.', CFG.lang === 'lt' ? ',' : '.') + ' · ' + S.sum.n + ' ' + esc(L.votes) : esc(L.first)) + '</div>';
      }
      if (S.result !== 'sent') h += '<button type="button" class="btn spot" data-act="copy">' + esc(S.copied ? L.copied : L.copy) + '</button>';
      h += '<div class="foot"><button type="button" class="btn go" data-act="close">' + esc(L.close) + '</button></div>';
    }

    if (S.step === 'form') {
      if (S.warn) h += '<p class="warn">' + esc(L.need) + '</p>';
      h += '<div class="foot">' + (S.fixedRole ? '' : '<button type="button" class="btn" data-act="back">' + esc(L.back) + '</button>') +
           '<button type="button" class="btn go" data-act="send"' + (canSend() ? '' : ' disabled') + '>' + esc(S.sending ? L.sending : L.send + ' ✔') + '</button></div>';
    }
    h += '</div></div>';
    var old = root.querySelector('.card'), top = old ? old.scrollTop : 0;
    // remember which button had focus: a re-render must not drop focus (Escape would stop working)
    var fa = root.activeElement || null, fk = fa && fa.getAttribute ? [fa.getAttribute('data-act'), fa.getAttribute('data-v')] : null;
    layer.innerHTML = h;
    var card = root.querySelector('.card');
    if (S.step === lastStep) {
      if (card) card.scrollTop = top;
      var back = null;
      if (fk && fk[0]) { try { back = root.querySelector('[data-act="' + fk[0] + '"]' + (fk[1] ? '[data-v="' + fk[1] + '"]' : '')); } catch (e) {} }
      if (back && back.disabled) back = null;
      try { (back || card).focus({ preventScroll: true }); } catch (e) {}
      return;
    }
    lastStep = S.step;
    var f = root.querySelector(S.step === 'role' ? '.role' : S.step === 'done' ? '.go' : '.x');
    if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  }
  var lastStep = null;

  function onClick(e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t || !S) return;
    var act = t.getAttribute('data-act'), v = t.getAttribute('data-v');
    if (act === 'backdrop') { if (e.target === t) API.close(); return; }
    if (act === 'close') return API.close();
    if (act === 'role') { S.role = v; S.step = 'form'; return render(); }
    if (act === 'back') { var keep = S.fixedRole; S = fresh(); S.fixedRole = keep; return render(); }
    if (act === 'overall') { S.overall = +v; S.warn = false; return render(); }
    if (act === 'again') { S.again = v; S.warn = false; return render(); }
    if (act === 'hard') { S.scores.sunkumas = +v; S.warn = false; return render(); }
    if (act.indexOf('crit:') === 0) { S.scores[act.slice(5)] = +v; S.warn = false; return render(); }
    if (act === 'pin') { S.step = 'pin'; return render(); }
    if (act === 'pincancel') { S.step = 'form'; return render(); }
    if (act === 'pinat') {
      var x = e.clientX, y = e.clientY, under = null;
      try {
        var all = document.elementsFromPoint(x, y) || [];
        for (var i = 0; i < all.length; i++) { if (all[i] !== host && !host.contains(all[i])) { under = all[i]; break; } }
      } catch (er) {}
      var c = context(), lp = local(x, y);
      // x/y = % of the box the person actually saw (the game's own box when it is turned on a phone)
      S.spot = { x: Math.round(lp.x / lp.w * 1000) / 10, y: Math.round(lp.y / lp.h * 1000) / 10, el: describe(under), scene: c.scene || null };
      if (lp.rot) S.spot.rot = lp.rot;
      S.step = 'form'; render();
      var p = document.createElement('div'); p.className = 'pin'; p.textContent = '📍'; p.style.left = lp.x + 'px'; p.style.top = lp.y + 'px';
      root.appendChild(p); setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 1600);
      return;
    }
    if (act === 'copy') {
      var txt = lastRow ? asText(lastRow) : '';
      var done = function () { S.copied = true; render(); };
      try { navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); }); } catch (er) { fallbackCopy(txt); done(); }
      return;
    }
    if (act === 'send') {
      if (S.sending) return;
      if (!canSend()) { S.warn = true; return render(); }
      var r = row(), st = S; lastRow = r;
      st.sending = true; render(); // the button stays off until this send finishes: no double rows
      post(r).then(function () {
        st.result = 'sent';
        try { if (window.bt) window.bt('scorecard_sent', { project: CFG.project, role: r.role }); } catch (er) {}
        return summary().then(function (s) { st.sum = s; });
      }).catch(function (er) {
        if (st.result === 'sent') return;
        if (refused(er)) { st.result = 'rejected'; return; }
        st.result = 'notsent'; Q.push(r); saveQ(); // full mode retries on the next visit; kids mode keeps nothing
      }).then(function () {
        st.sending = false; st.step = 'done';
        if (S === st) render();
        try { window.dispatchEvent(new CustomEvent('scorecard:sent', { detail: { project: CFG.project, role: r.role, ok: st.result === 'sent' } })); } catch (er) {}
      });
    }
  }
  function fallbackCopy(txt) {
    try {
      var ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    } catch (e) {}
  }

  /* ---------- public API ---------- */
  var API = {
    v: '1.1',
    config: CFG,
    context: null,
    open: function (opts) {
      mount(); flushQ();
      lastFocus = document.activeElement;
      var role = opts && opts.role && ROLES[opts.role] ? opts.role : (ORDER.length === 1 ? ORDER[0] : null);
      S = fresh(role); S.fixedRole = !!(opts && opts.role && ROLES[opts.role]) || ORDER.length === 1;
      if (fab) fab.style.display = 'none';
      render();
      try { window.dispatchEvent(new CustomEvent('scorecard:open', { detail: { project: CFG.project } })); } catch (e) {}
    },
    close: function () {
      if (!S) return;
      S = null; lastStep = null; render();
      if (fab) fab.style.display = '';
      try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('scorecard:close', { detail: { project: CFG.project } })); } catch (e) {}
    },
    isOpen: function () { return !!S; },
    pending: function () { return Q.length; }
  };
  window.Scorecard = API;

  loadQ();
  window.addEventListener('online', flushQ);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); flushQ(); });
  else { mount(); flushQ(); }
})();
