// Icons: stroke SVGs for UI buttons, and canvas-drawn pictures (litter, bins, parts, sticker)
// used both as DOM images (data URLs) and as 3D canvas textures. All original, no third-party art.
import { roundRect } from './util.js';

const S = (inner, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${inner}</svg>`;

/* ---------- glyphs: white shapes with a dark outline (grab = fist, release = open hand) ----------
 * One shape list feeds both the DOM (SVG) and canvas textures (trophy wall), so they look the same everywhere
 * (the ✊ / ✋ emoji looked different on every device and had low contrast on orange).
 * ops: ['line', d, w] white capsule stroke of width w with a dark rim (consecutive lines share one rim pass)
 *      ['shape', d]   white fill, dark edge   ·   ['ink', d, w] dark line */
const INK = '#2b1a5a', RIM = 2.2, EDGE = 1.2;
const n2 = (v) => +v.toFixed(2);
const rr = (x, y, w, h, r) => `M${n2(x + r)} ${y}H${n2(x + w - r)}A${r} ${r} 0 0 1 ${n2(x + w)} ${n2(y + r)}V${n2(y + h - r)}A${r} ${r} 0 0 1 ${n2(x + w - r)} ${n2(y + h)}H${n2(x + r)}A${r} ${r} 0 0 1 ${x} ${n2(y + h - r)}V${n2(y + r)}A${r} ${r} 0 0 1 ${n2(x + r)} ${y}Z`;
const GLYPH = {
  hand: [['line', 'M9.7 12V5.4', 2.5], ['line', 'M12.6 12V4.2', 2.5], ['line', 'M15.5 12V5', 2.5], ['line', 'M18.3 12.5V7.2', 2.3], ['line', 'M8 16 5 11.4', 2.5], ['shape', rr(8, 10.6, 11.6, 10.4, 3.6)]],
  fist: [['shape', rr(8.6, 14, 6.8, 6.4, 1.6)], ['shape', rr(5.6, 4.4, 12.8, 11.6, 3.4)], ['ink', 'M8.8 4.8v4.4M12 4.8v4.4M15.2 4.8v4.4', 1.2], ['line', 'M6.6 11.4h7', 2.6]],
};
function glyphRuns(name) { // consecutive 'line' ops share one rim pass, so neighbouring fingers keep a thin dark gap
  const runs = [];
  for (const op of GLYPH[name]) {
    const last = runs[runs.length - 1];
    if (op[0] === 'line' && last && last.type === 'line') last.ops.push(op); else runs.push({ type: op[0], ops: [op] });
  }
  return runs;
}
function glyphSVG(name) {
  let s = '';
  for (const run of glyphRuns(name)) {
    if (run.type === 'line') {
      for (const [, d, w] of run.ops) s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${n2(w + RIM * 2)}" stroke-linecap="round"/>`;
      for (const [, d, w] of run.ops) s += `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round"/>`;
    } else if (run.type === 'shape') s += `<path d="${run.ops[0][1]}" fill="#fff" stroke="${INK}" stroke-width="${EDGE}" stroke-linejoin="round"/>`;
    else s += `<path d="${run.ops[0][1]}" fill="none" stroke="${INK}" stroke-width="${run.ops[0][2]}" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="glyph">${s}</svg>`;
}
/** draw a glyph on a 2D canvas, top-left at (x, y), size px square */
export function drawGlyph(name, g, x, y, size) {
  g.save(); g.translate(x, y); g.scale(size / 24, size / 24); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const run of glyphRuns(name)) {
    if (run.type === 'line') {
      g.strokeStyle = INK; for (const [, d, w] of run.ops) { g.lineWidth = w + RIM * 2; g.stroke(new Path2D(d)); }
      g.strokeStyle = '#fff'; for (const [, d, w] of run.ops) { g.lineWidth = w; g.stroke(new Path2D(d)); }
    } else if (run.type === 'shape') { const p = new Path2D(run.ops[0][1]); g.fillStyle = '#fff'; g.fill(p); g.strokeStyle = INK; g.lineWidth = EDGE; g.stroke(p); }
    else { g.strokeStyle = INK; g.lineWidth = run.ops[0][2]; g.stroke(new Path2D(run.ops[0][1])); }
  }
  g.restore();
}

export const SVG = {
  fist: glyphSVG('fist'),
  hand: glyphSVG('hand'),
  play: S('<path d="M8.5 5.2v13.6L19.5 12z" fill="currentColor" stroke="currentColor" stroke-width="2"/>'),
  pause: S('<rect x="6.6" y="5.2" width="3.8" height="13.6" rx="1.3" fill="currentColor" stroke="none"/><rect x="13.6" y="5.2" width="3.8" height="13.6" rx="1.3" fill="currentColor" stroke="none"/>'),
  // movement break (pictograms, no words): ① stretch up tall · ② squat and pick up litter · ③ march / robot dance
  mvUp: S('<circle cx="12" cy="7.6" r="2.3"/><path d="M12 10.2v5.6M12 15.8l-2.2 5.4M12 15.8l2.2 5.4M12 11.2 8.8 2.6M12 11.2l3.2-8.6"/>'),
  mvSquat: S('<circle cx="8.4" cy="7.4" r="2.3"/><path d="M10 9.6l4 4.6M14 14.2l-4 2.2 2.6 4.4M14 14.2l1.6 2.6-1 4.4M10.8 10.8l-3.6 6.4"/><circle cx="6.2" cy="19.6" r="1.6" fill="currentColor" stroke="none"/>'),
  mvMarch: S('<circle cx="11" cy="4.6" r="2.3"/><path d="M11 7.2v6.6M11 13.8l-.6 7.4M11 13.8l4.6 1.2v4.6M11 8.8 7.4 12.6M11 8.8l4.2-2.8"/>'),
  home: S('<path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M6 9.6V20h12V9.6"/><path d="M10 20v-5.2h4V20"/>'),
  check: S('<path d="M5 12.8l4.4 4.4L19 7.4"/>'),
  close: S('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  next: S('<path d="M4.5 12h14"/><path d="M13 6.2 18.8 12 13 17.8"/>'),
  left: S('<path d="M14.8 5.5 8.2 12l6.6 6.5"/>'),
  right: S('<path d="M9.2 5.5 15.8 12l-6.6 6.5"/>'),
  // sound ON: speaker + two waves · sound OFF: speaker + coral cross (the button also turns coral, see style.css)
  speaker: S('<path d="M4 9.6h3.4L12 6v12l-4.6-3.6H4z" fill="currentColor"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18 6.8a7.4 7.4 0 0 1 0 10.4"/>'),
  mute: S('<path d="M4 9.6h3.4L12 6v12l-4.6-3.6H4z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="#ff8a8a" stroke-width="3"/>'),
  // repeat the last line: small speaker inside a counter-clockwise circular arrow
  replayVoice: S('<path d="M5.76 14.44A7.5 7.5 0 1 0 7.7 7.2" fill="none"/><path d="M7.28 3.22V7.62h4.4" fill="none"/><path d="M9 11h2.1l3-2.4v7.8l-3-2.4H9z" fill="currentColor" stroke-width="1.6"/><path d="M16 10.6a2.7 2.7 0 0 1 0 3.8" fill="none" stroke-width="2"/>'),
  // play again: the same circular arrow around a play triangle
  again: S('<path d="M5.76 14.44A7.5 7.5 0 1 0 7.7 7.2" fill="none"/><path d="M7.28 3.22V7.62h4.4" fill="none"/><path d="M11 9.3v6.4l5.2-3.2z" fill="currentColor" stroke-width="1.6"/>'),
  cc: S('<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M10.6 10.3a2.3 2.3 0 1 0 0 3.4M16.8 10.3a2.3 2.3 0 1 0 0 3.4"/>'),
  skip: S('<path d="M5 6.5 10.5 12 5 17.5M12 6.5l5.5 5.5-5.5 5.5"/>'),
  up: S('<path d="M12 20V5.5"/><path d="M5.8 11.5 12 5.3l6.2 6.2"/>'),
  trophy: S('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.2v1.4A3.6 3.6 0 0 0 7.6 11M17 6h2.8v1.4A3.6 3.6 0 0 1 16.4 11"/><path d="M12 14v3.5M8 20h8M9.5 17.5h5"/>'),
  gamepad: S('<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.4v4.2M5.4 12.5h4.2"/><circle cx="15.6" cy="11.3" r="1" fill="currentColor"/><circle cx="17.8" cy="13.7" r="1" fill="currentColor"/>'),
  flag: S('<path d="M5.5 21V3.8"/><path d="M5.5 4.4h11.5l-2.2 3.6 2.2 3.6H5.5"/>'),
  // park: a green pine tree on the ground (the old round tree read as a ♀ sign)
  tree: S('<path d="M12 2.8 6.6 9.8h3L5.4 15.8h13.2l-4.2-6h3z" fill="#4cc764"/><path d="M12 15.8V20.6M6.5 20.8h11" fill="none"/>'),
  back: S('<path d="M9 13.8 4.2 9 9 4.2" fill="none"/><path d="M4.4 9H14a6 6 0 0 1 0 12h-3" fill="none"/>'),
  undo: S('<path d="M9 13.8 4.2 9 9 4.2" fill="none"/><path d="M4.4 9H14a6 6 0 0 1 0 12h-3" fill="none"/>'),
  count: S('<text x="12" y="15.6" font-size="10.5" text-anchor="middle" fill="currentColor" stroke="none" font-weight="700" font-family="Fredoka, sans-serif">123</text><path d="M4 19.5h16" stroke-dasharray="1.2 3.4"/>'),
  lock: S('<rect x="5" y="11" width="14" height="10" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  // walk / drive switch in the park: a robot (tap = drive the robot) · a child (tap = walk yourself)
  robot: S('<rect x="5" y="8.4" width="14" height="9.6" rx="3"/><path d="M12 8.4V5.2"/><circle cx="12" cy="4.2" r="1.4" fill="currentColor"/><circle cx="9.2" cy="13" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.8" cy="13" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="20.2" r="1.6"/><circle cx="16" cy="20.2" r="1.6"/>'),
  kid: S('<circle cx="12" cy="5.4" r="2.9"/><path d="M12 8.8v6.4M7 12.2l5-2.2 5 2.2M12 15.2l-3.4 5.6M12 15.2l3.4 5.6"/>'),
  parents: S('<circle cx="8" cy="6" r="2.6"/><path d="M4 21v-6.6a4 4 0 0 1 8 0V21"/><circle cx="17" cy="10.2" r="2.1"/><path d="M14 21v-4.4a3 3 0 0 1 6 0V21"/>'),
  narrator: S('<path d="M3.5 9.4h3.6L12 5.4v13.2l-4.9-4H3.5z" fill="currentColor" stroke="none"/><path d="M15.4 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  starOn: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5-4.8-4.5 6.5-.8z" fill="#ffd23f" stroke="#2b1a5a" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  starOff: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5-4.8-4.5 6.5-.8z" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.7)" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
};

/* ---------- canvas pictures (drawn in a 100x100 space) ---------- */
function ink(g, w = 4) { g.lineWidth = w; g.strokeStyle = '#2b1a5a'; g.lineJoin = 'round'; g.lineCap = 'round'; }

const DRAW = {
  paper(g) { // flat paper sheet with folded corner and lines
    ink(g);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(24, 10); g.lineTo(64, 10); g.lineTo(78, 24); g.lineTo(78, 90); g.lineTo(24, 90); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#dfe7f2'; g.beginPath(); g.moveTo(64, 10); g.lineTo(64, 24); g.lineTo(78, 24); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#7da6d9'; g.lineWidth = 4;
    for (let y = 38; y <= 76; y += 12) { g.beginPath(); g.moveTo(33, y); g.lineTo(69, y); g.stroke(); }
  },
  plastic(g) { // clear plastic bottle with ridges and a cap
    ink(g);
    g.fillStyle = '#bfe8ff';
    g.beginPath();
    g.moveTo(42, 22); g.lineTo(58, 22); g.lineTo(58, 30); g.quadraticCurveTo(70, 36, 70, 48); g.lineTo(70, 86); g.quadraticCurveTo(70, 92, 64, 92);
    g.lineTo(36, 92); g.quadraticCurveTo(30, 92, 30, 86); g.lineTo(30, 48); g.quadraticCurveTo(30, 36, 42, 30); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#2f80ed'; roundRect(g, 39, 9, 22, 14, 4); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(43,26,90,.45)'; g.lineWidth = 3;
    for (const y of [58, 70]) { g.beginPath(); g.moveTo(32, y); g.lineTo(68, y); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.8)'; roundRect(g, 36, 44, 6, 36, 3); g.fill();
  },
  glass(g, color = '#1f9a4c') { // slim glass bottle with long neck
    ink(g);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(45, 8); g.lineTo(55, 8); g.lineTo(55, 34); g.quadraticCurveTo(68, 40, 68, 54); g.lineTo(68, 88); g.quadraticCurveTo(68, 93, 62, 93);
    g.lineTo(38, 93); g.quadraticCurveTo(32, 93, 32, 88); g.lineTo(32, 54); g.quadraticCurveTo(32, 40, 45, 34); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)'; roundRect(g, 38, 50, 6, 34, 3); g.fill();
    g.fillStyle = '#f4e8c8'; roundRect(g, 40, 60, 20, 16, 3); g.fill(); g.lineWidth = 3; g.stroke();
  },
  paperBall(g) { // crumpled paper ball
    ink(g);
    g.fillStyle = '#f2f2ee';
    const pts = [[50, 14], [68, 20], [82, 36], [86, 54], [78, 74], [62, 86], [42, 86], [24, 76], [14, 56], [18, 36], [32, 20]];
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(43,26,90,.45)'; g.lineWidth = 3;
    const cr = [[[30, 34], [48, 46], [44, 64]], [[60, 28], [56, 46], [72, 58]], [[48, 46], [62, 62], [58, 78]], [[24, 58], [40, 60]]];
    for (const l of cr) { g.beginPath(); l.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
    g.fillStyle = 'rgba(200,205,214,.6)'; g.beginPath(); g.moveTo(56, 46); g.lineTo(72, 58); g.lineTo(62, 62); g.closePath(); g.fill();
  },
  can(g) { // aluminium can
    ink(g);
    g.fillStyle = '#cfd6de'; roundRect(g, 30, 16, 40, 72, 8); g.fill(); g.stroke();
    g.fillStyle = '#e94b3c'; g.fillRect(32, 38, 36, 28); g.strokeRect(30, 38, 40, 28);
    g.fillStyle = '#eef2f6'; g.beginPath(); g.ellipse(50, 18, 20, 6, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.7)'; roundRect(g, 35, 22, 5, 60, 2.5); g.fill();
  },
  wheel(g) {
    ink(g, 4);
    g.fillStyle = '#2d2d38'; g.beginPath(); g.arc(50, 50, 40, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#39e6e0'; g.beginPath(); g.arc(50, 50, 24, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(50, 50, 8, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = '#4a4a5c'; g.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(50 + Math.cos(a) * 30, 50 + Math.sin(a) * 30); g.lineTo(50 + Math.cos(a) * 38, 50 + Math.sin(a) * 38); g.stroke(); }
  },
  band(g) { // red rubber band loop
    g.lineCap = 'round';
    g.strokeStyle = '#2b1a5a'; g.lineWidth = 16;
    g.beginPath(); g.ellipse(50, 50, 34, 22, -0.3, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#ef2b3a'; g.lineWidth = 10;
    g.beginPath(); g.ellipse(50, 50, 34, 22, -0.3, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(50, 50, 34, 22, -0.3, Math.PI * 1.1, Math.PI * 1.5); g.stroke();
  },
  eyes(g) { // robot hub front with two light eyes
    ink(g);
    g.fillStyle = '#ffffff'; roundRect(g, 10, 24, 80, 52, 14); g.fill(); g.stroke();
    g.fillStyle = '#39e6e0'; roundRect(g, 18, 14, 64, 12, 6); g.fill(); g.stroke();
    for (const x of [34, 66]) {
      g.fillStyle = '#2b1a5a'; g.beginPath(); g.arc(x, 50, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c9fffd'; g.beginPath(); g.arc(x, 50, 8.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 3, 47, 3, 0, Math.PI * 2); g.fill();
    }
  },
  flower(g) {
    ink(g, 3.5);
    g.strokeStyle = '#2f8f3c'; g.lineWidth = 6; g.beginPath(); g.moveTo(50, 92); g.lineTo(50, 52); g.stroke();
    g.fillStyle = '#4caf50'; g.beginPath(); g.ellipse(62, 74, 12, 6, -0.5, 0, Math.PI * 2); g.fill();
    ink(g, 3.5);
    g.fillStyle = '#ff6fae';
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.arc(50 + Math.cos(a) * 16, 40 + Math.sin(a) * 16, 12, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(50, 40, 10, 0, Math.PI * 2); g.fill(); g.stroke();
  },
  tree(g) {
    ink(g, 3.5);
    g.fillStyle = '#8a5a35'; roundRect(g, 43, 56, 14, 36, 4); g.fill(); g.stroke();
    g.fillStyle = '#4cb85a'; g.beginPath(); g.arc(50, 40, 30, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(40, 30, 9, 0, Math.PI * 2); g.fill();
  },
  bush(g) {
    ink(g, 3.5);
    g.fillStyle = '#3f9f4e';
    for (const [x, y, r] of [[30, 64, 20], [70, 64, 20], [50, 52, 24]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.fillStyle = '#3f9f4e'; g.fillRect(14, 64, 72, 18);
    g.beginPath(); g.moveTo(10, 84); g.lineTo(90, 84); g.stroke();
    g.fillStyle = '#ff6fae'; for (const [x, y] of [[36, 56], [60, 48], [70, 66]]) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
  },
  bench(g) {
    ink(g, 3.5);
    g.fillStyle = '#e07a3c';
    roundRect(g, 12, 30, 76, 14, 4); g.fill(); g.stroke();
    roundRect(g, 12, 52, 76, 12, 4); g.fill(); g.stroke();
    g.fillStyle = '#5a5a6a';
    for (const x of [20, 74]) { roundRect(g, x, 64, 7, 24, 2); g.fill(); g.stroke(); }
  },
};
DRAW.glassBrown = (g) => DRAW.glass(g, '#9a5a22');

/* park items unlocked by sorting stars + the eraser */
DRAW.fence = (g) => {
  ink(g, 3.5); g.fillStyle = '#f4ead3';
  for (const x of [18, 40, 62, 84]) { g.beginPath(); g.moveTo(x - 7, 88); g.lineTo(x - 7, 34); g.lineTo(x, 24); g.lineTo(x + 7, 34); g.lineTo(x + 7, 88); g.closePath(); g.fill(); g.stroke(); }
  g.fillStyle = '#e6a15a'; for (const y of [44, 68]) { roundRect(g, 6, y, 88, 10, 3); g.fill(); g.stroke(); }
};
DRAW.lamp = (g) => {
  const gr = g.createRadialGradient(50, 26, 2, 50, 26, 30); gr.addColorStop(0, 'rgba(255,236,140,.95)'); gr.addColorStop(1, 'rgba(255,236,140,0)');
  g.fillStyle = gr; g.fillRect(18, 0, 64, 60);
  ink(g, 3.5); g.fillStyle = '#3a3f5c';
  roundRect(g, 46, 36, 8, 52, 3); g.fill(); g.stroke(); roundRect(g, 34, 84, 32, 9, 3); g.fill(); g.stroke();
  g.fillStyle = '#fff1a8'; roundRect(g, 37, 17, 26, 22, 4); g.fill(); g.stroke();
  g.fillStyle = '#3a3f5c'; g.beginPath(); g.moveTo(31, 19); g.lineTo(50, 6); g.lineTo(69, 19); g.closePath(); g.fill(); g.stroke();
};
DRAW.birdhouse = (g) => {
  ink(g, 3.5); g.fillStyle = '#8a5a35'; roundRect(g, 45, 60, 10, 32, 3); g.fill(); g.stroke();
  g.fillStyle = '#ff8c2a'; roundRect(g, 26, 36, 48, 30, 4); g.fill(); g.stroke();
  g.fillStyle = '#d94a3c'; g.beginPath(); g.moveTo(17, 40); g.lineTo(50, 12); g.lineTo(83, 40); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#2b1a5a'; g.beginPath(); g.arc(50, 50, 7, 0, Math.PI * 2); g.fill();
};
DRAW.pond = (g) => {
  ink(g, 3.5); g.fillStyle = '#5ec8f0'; g.beginPath(); g.ellipse(50, 58, 41, 26, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3.5; g.beginPath(); g.ellipse(38, 52, 15, 6, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  g.fillStyle = '#4caf50'; g.beginPath(); g.moveTo(64, 64); g.arc(64, 64, 9, 0.5, Math.PI * 2 - 0.1); g.closePath(); g.fill();
  g.fillStyle = '#9aa3ad'; ink(g, 2.5); for (const [x, y] of [[11, 56], [89, 56], [28, 80], [72, 80]]) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); g.stroke(); }
};
DRAW.eraser = (g) => {
  ink(g, 4);
  g.save(); g.translate(52, 50); g.rotate(-0.6);
  g.fillStyle = '#ff8fb1'; roundRect(g, -32, -17, 42, 34, 7); g.fill(); g.stroke();
  g.fillStyle = '#ffffff'; roundRect(g, 10, -17, 24, 34, 7); g.fill(); g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(43,26,90,.55)'; g.lineWidth = 4; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(10, 90); g.lineTo(58, 90); g.stroke(); g.setLineDash([]);
};
/* quiz q4 answer cards: the grab block (closed hand) and the release block (open hand), the program colours */
const blockCard = (g, color, glyph) => { g.fillStyle = color; roundRect(g, 8, 8, 84, 84, 18); g.fill(); ink(g, 4); g.stroke(); drawGlyph(glyph, g, 18, 18, 64); };
DRAW.cardGrab = (g) => blockCard(g, '#ff8c1a', 'fist');
DRAW.cardRelease = (g) => blockCard(g, '#22b573', 'hand');
/* reward badges (what was learned today), pictures only */
DRAW.badgeBins = (g) => {
  [['#2f6fed', 2], ['#ffcc1f', 34], ['#22a447', 66]].forEach(([c, x]) => { g.save(); g.translate(x, 22); g.scale(0.32, 0.6); drawBin(g, c, null); g.restore(); });
};
DRAW.badgeRobot = (g) => {
  ink(g, 3.5);
  g.fillStyle = '#2d2d38'; for (const x of [26, 58]) { g.beginPath(); g.arc(x, 80, 10, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.fillStyle = '#ffffff'; roundRect(g, 12, 46, 62, 32, 8); g.fill(); g.stroke();
  g.fillStyle = '#39e6e0'; roundRect(g, 18, 38, 50, 10, 5); g.fill(); g.stroke();
  for (const x of [32, 52]) { g.fillStyle = '#2b1a5a'; g.beginPath(); g.arc(x, 62, 6, 0, Math.PI * 2); g.fill(); }
  // the arm: two crossing beams and a pincer reaching up-right
  g.save(); g.translate(70, 50);
  g.fillStyle = '#ff8c2a'; g.rotate(-0.8); roundRect(g, -5, -38, 10, 40, 4); g.fill(); g.stroke(); g.rotate(0.8);
  g.fillStyle = '#3ec46d'; g.rotate(-0.45); roundRect(g, -5, -38, 10, 40, 4); g.fill(); g.stroke();
  g.restore();
  g.fillStyle = '#ef2b3a'; g.beginPath(); g.arc(70, 50, 5, 0, Math.PI * 2); g.fill(); g.stroke();
};
DRAW.badgeBlocks = (g) => {
  const B = [['#3a86ff', 'up', 2], ['#ff8c1a', 'fist', 35], ['#22b573', 'hand', 68]];
  for (const [c, k, x] of B) {
    g.fillStyle = c; roundRect(g, x, 34, 30, 30, 7); g.fill(); ink(g, 2.5); g.stroke();
    if (k === 'up') { g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 15, 57); g.lineTo(x + 15, 41); g.moveTo(x + 8, 48); g.lineTo(x + 15, 41); g.lineTo(x + 22, 48); g.stroke(); }
    else drawGlyph(k, g, x + 3, 37, 24);
  }
  g.fillStyle = '#2b1a5a'; for (const x of [33.5, 66.5]) { g.beginPath(); g.moveTo(x - 2, 45); g.lineTo(x + 2, 49); g.lineTo(x - 2, 53); g.fill(); }
};

/** bin picture: colour + icon on a white label */
function drawBin(g, color, iconName) {
  ink(g);
  g.fillStyle = color;
  g.beginPath(); g.moveTo(20, 26); g.lineTo(80, 26); g.lineTo(74, 92); g.lineTo(26, 92); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = shade(color); roundRect(g, 14, 14, 72, 14, 6); g.fill(); g.stroke();
  if (!iconName) return; // plain bin: the colour is the only clue (quiz q1 tests the colour, not picture matching)
  g.fillStyle = '#ffffff'; roundRect(g, 32, 38, 36, 40, 8); g.fill(); g.lineWidth = 3; g.stroke();
  g.save(); g.translate(32, 38); g.scale(0.36, 0.4); DRAW[iconName](g); g.restore();
}
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.78), gg = Math.round(((n >> 8) & 255) * 0.78), b = Math.round((n & 255) * 0.78);
  return `rgb(${r},${gg},${b})`;
}
export const BIN_COLORS = { paper: '#2f6fed', plastic: '#ffcc1f', glass: '#22a447' };
export const BIN_ICON = { paper: 'paper', plastic: 'plastic', glass: 'glass' };
DRAW.binPaper = (g) => drawBin(g, BIN_COLORS.paper, 'paper');
DRAW.binPlastic = (g) => drawBin(g, BIN_COLORS.plastic, 'plastic');
DRAW.binGlass = (g) => drawBin(g, BIN_COLORS.glass, 'glass');
DRAW.binBlue = (g) => drawBin(g, BIN_COLORS.paper, null);
DRAW.binYellow = (g) => drawBin(g, BIN_COLORS.plastic, null);
DRAW.binGreen = (g) => drawBin(g, BIN_COLORS.glass, null);

/** The sticker „Parko tvarkytojas": round badge with pincers and a leaf */
DRAW.sticker = (g) => {
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(50, 50, 49, 0, Math.PI * 2); g.fill();
  const gr = g.createRadialGradient(42, 36, 6, 50, 50, 46);
  gr.addColorStop(0, '#6ff3ee'); gr.addColorStop(1, '#1fb5b0');
  g.fillStyle = gr; g.beginPath(); g.arc(50, 50, 44, 0, Math.PI * 2); g.fill();
  ink(g, 3.5); g.stroke();
  // leaf
  g.fillStyle = '#3fbf55';
  g.beginPath(); g.moveTo(50, 80); g.quadraticCurveTo(18, 70, 30, 40); g.quadraticCurveTo(54, 44, 50, 80); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(48, 76); g.quadraticCurveTo(38, 60, 32, 44); g.lineWidth = 2.5; g.stroke();
  // pincers: two crossing beams with claws
  g.lineWidth = 3.5;
  g.save(); g.translate(58, 46);
  for (const [rot, col] of [[-0.42, '#3ec46d'], [0.42, '#ff8c2a']]) {
    g.save(); g.rotate(rot);
    g.fillStyle = col; roundRect(g, -7, -26, 14, 44, 6); g.fill(); g.stroke();
    g.fillStyle = '#2b1a5a'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(0, -20 + i * 9, 2.4, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  g.fillStyle = '#9aa3ad'; g.beginPath(); g.arc(0, -3, 5, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#ef2b3a'; roundRect(g, -14, 12, 28, 7, 3.5); g.fill(); g.stroke();
  g.restore();
  // stars
  g.fillStyle = '#ffd23f';
  for (const [x, y, r] of [[24, 28, 5], [78, 74, 4]]) { star(g, x, y, r); }
};
function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}

export function drawIcon(name, g, size) {
  g.save(); g.scale(size / 100, size / 100); DRAW[name](g); g.restore();
}

const urlCache = new Map();
export function iconURL(name, size = 160) {
  const k = name + size;
  if (urlCache.has(k)) return urlCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = size;
  drawIcon(name, c.getContext('2d'), size);
  const u = c.toDataURL('image/png');
  urlCache.set(k, u);
  return u;
}
export function iconImg(name, alt = '') {
  const im = new Image(); im.src = iconURL(name); im.alt = alt; im.draggable = false; return im;
}
