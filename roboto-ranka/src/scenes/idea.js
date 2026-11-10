// idea: one idea about litter. ed01 paper vs bottle → ed02_ok/no · ed03 year-block bars 2 / 90 / 500 / 900
// (+ a tiny castle at ~600) grow in step with the voice · ed04 the three bins hop as each colour is named → build.
import * as THREE from '../three.js';
import { buildPark, makeLitter, Bin } from '../world.js';
import { Kit, M, roundedBox as rb, Ease } from '../util.js';
import { fitFov } from '../engine.js';
import { Sfx, Voice } from '../audio.js';

const cyl = (a, b, h, s = 24) => new THREE.CylinderGeometry(a, b, h, s);
const TABLE_Y = 1.12, BAR_BASE = 2.05, BLOCK_H = 0.16, YEARS_PER_BLOCK = 50;

function standUp(l) {
  if (l.userData.kind !== 'paper') { const h = l.userData.inner.children[0]; h.rotation.z = 0; h.position.set(0, 0, 0); }
  else l.userData.inner.children[0].position.y = 0.27;
  return l;
}
function makeCan() {
  const g = new THREE.Group();
  const k = new Kit();
  k.add(cyl(0.2, 0.2, 0.5, 22), 0xcfd6de, [0, 0.25, 0]);
  k.add(cyl(0.205, 0.205, 0.26, 22), 0xe94b3c, [0, 0.25, 0]);
  k.add(cyl(0.17, 0.2, 0.05, 22), 0xeef2f6, [0, 0.52, 0]);
  k.add(new THREE.BoxGeometry(0.1, 0.02, 0.06), 0xb8c0ca, [0.04, 0.55, 0]);
  g.add(new THREE.Mesh(k.geo(), M.plastic));
  g.scale.setScalar(1.25);
  return g;
}
function makeCastle() {
  const k = new Kit(), brick = 0xc8623f, roof = 0x7a2f22;
  k.add(rb(0.9, 0.5, 0.4, 0.04), brick, [0, 0.25, 0]);
  for (const x of [-0.45, 0.45]) { k.add(cyl(0.16, 0.16, 0.8, 12), brick, [x, 0.4, 0]); k.add(new THREE.ConeGeometry(0.2, 0.32, 12), roof, [x, 0.96, 0]); }
  k.add(cyl(0.18, 0.18, 0.95, 12), brick, [0, 0.48, -0.05]); k.add(new THREE.ConeGeometry(0.23, 0.38, 12), roof, [0, 1.13, -0.05]);
  k.add(rb(0.22, 0.28, 0.05, 0.05), 0x3a1f18, [0, 0.14, 0.2]);
  for (const x of [-0.3, -0.1, 0.1, 0.3]) k.add(new THREE.BoxGeometry(0.1, 0.1, 0.42), brick, [x, 0.55, 0]);
  return new THREE.Mesh(k.geo(), M.toy);
}

export async function enter(ctx) {
  const { E, UI, G } = ctx;
  buildPark(ctx.root, { trees: true });
  const fx = ctx.fx();

  // stage + table
  const sk = new Kit();
  sk.add(cyl(4.2, 4.4, 0.3, 48), 0xa897ef, [0, 0.15, 0]);
  sk.add(new THREE.TorusGeometry(4.25, 0.08, 8, 64), 0x39e6e0, [0, 0.3, 0], [Math.PI / 2, 0, 0]);
  sk.add(rb(7.0, 0.24, 1.7, 0.1), 0xfff7ec, [0, TABLE_Y - 0.12, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) sk.add(rb(0.2, 0.8, 0.2, 0.06), 0xd8c8f0, [sx * 3.2, 0.7, sz * 0.6]);
  const stage = new THREE.Mesh(sk.geo(), M.toy); ctx.root.add(stage);

  const paper = standUp(makeLitter('paper', 1, 1.5));
  const plastic = standUp(makeLitter('plastic', 0, 1.35));
  const glass = standUp(makeLitter('glass', 0, 1.35));
  const can = makeCan();
  paper.position.set(-1.2, TABLE_Y, 0); plastic.position.set(1.2, TABLE_Y, 0);
  ctx.root.add(paper, plastic);

  const setFov = (hw, hh, d) => { E.camera.fov = fitFov(hw, hh, d); E.camera.updateProjectionMatrix(); };
  let view = [2.3, 1.15, 5.4];
  const fov = () => setFov(...view);
  fov(); E.onResize.add(fov); ctx.cleanup(() => E.onResize.delete(fov));
  ctx.setCam(new THREE.Vector3(0, 2.05, 5.4), new THREE.Vector3(0, 1.62, 0)); // items sit below the caption, little empty stage

  const hop = (obj, h = 0.5, d = 0.45) => { const y0 = obj.position.y; return ctx.tween(d, (k, r) => { obj.position.y = y0 + Math.sin(r * Math.PI) * h; }, { ease: Ease.linear }); };

  // ---- 1 · which disappears faster?
  const sig = ctx.signal();
  let answered = false;
  ctx.api.choose = (kind) => {
    if (answered) return;
    answered = true;
    const ok = kind === 'paper';
    Sfx.play(ok ? 'chime' : 'oops');
    hop(kind === 'paper' ? paper : plastic, 0.6);
    sig.fire(ok);
  };
  const hots = [
    ctx.hot({ obj: paper, offset: [0, 0.35, 0], r: 0.75, minPx: 110, label: 'Popierius', onTap: () => ctx.api.choose('paper') }),
    ctx.hot({ obj: plastic, offset: [0, 0.45, 0], r: 0.75, minPx: 110, label: 'Plastikinis butelis', onTap: () => ctx.api.choose('plastic') }),
  ];
  ctx.onKey((e) => { if (e.key === '1') ctx.api.choose('paper'); if (e.key === '2') ctx.api.choose('plastic'); });
  ctx.waiting = 'choose';
  // the two answers glow as soon as the question has been asked (a 5-year-old needs to see what is tappable)
  ctx.say('ed01').then(() => { if (!answered) hots.forEach((h) => h.pulse()); });
  const stopIdle = ctx.idle(() => hots.forEach((h) => h.pulse()));
  const ok = await sig.promise;
  stopIdle(); ctx.waiting = null; hots.forEach((h) => h.remove());
  if (!ok) { fx.sparkles.pop(paper.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 8); hop(paper, 0.6); }
  else fx.sparkles.pop(paper.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 10);
  await ctx.say(ok ? 'ed02_ok' : 'ed02_no');

  // ---- 2 · how long litter lies (bars of year blocks)
  const X = [-2.55, -0.85, 0.85, 2.55];
  can.position.set(X[1], TABLE_Y, 0); glass.position.set(X[3], TABLE_Y, 0);
  can.scale.setScalar(0.001); glass.scale.setScalar(0.001);
  ctx.root.add(can, glass);
  ctx.to(paper.position, { x: X[0] }, 0.6); ctx.to(plastic.position, { x: X[2] }, 0.6);
  ctx.tween(0.5, (k) => { can.scale.setScalar(Math.max(0.001, k * 1.25)); glass.scale.setScalar(Math.max(0.001, k * 1.35)); }, { ease: Ease.back });
  // framed so the 900-year bar (top ≈ 4.9) and its label (≈ 5.3) sit in the lower ~70 % of the picture,
  // clear of the HUD + a 3–4 line caption, on desktop, phone landscape and the turned phone
  view = [3.9, 3.15, 10.5]; fov();
  ctx.camTo(new THREE.Vector3(0, 4.7, 10.5), new THREE.Vector3(0, 4.0, 0), 1.0);

  const BAR = [{ years: 2, col: 0x2f6fed }, { years: 90, col: 0xa9b3bf }, { years: 500, col: 0xffcc1f }, { years: 900, col: 0x22a447 }];
  const total = BAR.reduce((s, b) => s + Math.ceil(b.years / YEARS_PER_BLOCK), 0);
  // M.plastic uses vertex colours: the block geometry needs a (white) colour attribute, otherwise every bar renders
  // black; the per-instance colour (setColorAt) then tints each bar blue / grey / yellow / green
  const barGeo = new Kit().add(rb(0.62, BLOCK_H - 0.02, 0.62, 0.05), 0xffffff, [0, 0, 0]).geo();
  const bars = new THREE.InstancedMesh(barGeo, M.plastic, total);
  bars.count = 0; bars.frustumCulled = false; ctx.root.add(bars);
  const inst = []; // {bar, i, h, scale}
  BAR.forEach((b, bi) => {
    const blocks = b.years / YEARS_PER_BLOCK, n = Math.ceil(blocks);
    for (let i = 0; i < n; i++) inst.push({ bar: bi, i, frac: Math.max(0.15, Math.min(1, blocks - i)), t: -1 });
  });
  const col = new THREE.Color();
  inst.forEach((o, k) => bars.setColorAt(k, col.set(BAR[o.bar].col)));
  bars.instanceColor.needsUpdate = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  ctx.onUpdate((dt) => {
    let n = 0;
    inst.forEach((o, k) => {
      if (o.t < 0) return;
      o.t += dt;
      const e = Math.min(1, o.t / 0.22), sc = Math.max(0.0001, Ease.back(e)) * (ctx.barScale ?? 1);
      const h = BLOCK_H * o.frac;
      m4.compose(v.set(X[o.bar], BAR_BASE + o.i * BLOCK_H + h / 2, 0), q, s.set(sc, Math.max(0.0001, (h / BLOCK_H) * sc), sc));
      bars.setMatrixAt(k, m4); n = k + 1;
    });
    bars.count = n;
    bars.instanceMatrix.needsUpdate = true;
    for (const lb of labels) { if (!lb.on) continue; const p = UI.screenOf(ctx.root, [X[lb.bar], lb.y + 0.32, 0]); lb.el.style.left = p.x + 'px'; lb.el.style.top = p.y + 'px'; }
  });
  const labels = [];
  const grow = (bi) => {
    const list = inst.filter((o) => o.bar === bi);
    list.forEach((o, j) => setTimeout(() => { if (ctx.alive) { o.t = 0; if (j % 2 === 0) Sfx.play('clack'); } }, (j * 70) / E.timeScale));
    const el = document.createElement('div');
    el.className = 'big-num'; el.style.fontSize = '34px'; el.style.webkitTextStrokeWidth = '3px';
    el.textContent = String(BAR[bi].years);
    UI.sceneEl().appendChild(el);
    const top = BAR_BASE + (BAR[bi].years / YEARS_PER_BLOCK) * BLOCK_H;
    labels.push({ el, bar: bi, y: Math.max(top, BAR_BASE + 0.05), on: true });
    hop([paper, can, plastic, glass][bi], 0.35);
  };
  // castle at ~600 years, beside the glass bar
  const castleG = new THREE.Group();
  const pole = new THREE.Mesh(new Kit().add(cyl(0.035, 0.035, 1, 8), 0x9aa3ad, [0, 0.5, 0]).geo(), M.toy);
  const h600 = (600 / YEARS_PER_BLOCK) * BLOCK_H;
  pole.scale.y = BAR_BASE + h600 - TABLE_Y; pole.position.y = TABLE_Y;
  const castle = makeCastle(); castle.position.y = BAR_BASE + h600; castle.scale.setScalar(0.7);
  castleG.add(pole, castle); castleG.position.set(X[3] + 0.85, 0, 0.1); castleG.visible = false;
  ctx.root.add(castleG);
  const showCastle = () => { if (castleG.visible) return; castleG.visible = true; Sfx.play('pop'); fx.sparkles.pop(new THREE.Vector3(X[3] + 0.85, BAR_BASE + h600 + 0.4, 0.1), 8); };

  await ctx.wait(0.4);
  grow(0);
  const t3 = Voice.lines.ed03.text;
  const at = (w) => Math.max(0, t3.indexOf(w) / t3.length - 0.02);
  await ctx.say('ed03', { cues: [
    { at: at('skardinė'), fn: () => grow(1) },
    { at: at('Plastikinis'), fn: () => grow(2) },
    { at: at('stiklinis'), fn: () => grow(3) },
    { at: at('Trakų'), fn: showCastle },
  ] });
  showCastle();
  await ctx.wait(0.6);

  // ---- 3 · sorting colours: bins hop in turn
  for (const lb of labels) { lb.on = false; lb.el.remove(); }
  ctx.tween(0.4, (k) => { ctx.barScale = 1 - k; castleG.scale.setScalar(Math.max(0.001, 1 - k)); can.scale.setScalar(Math.max(0.001, 1.25 * (1 - k))); });
  const bins = { paper: new Bin('paper'), plastic: new Bin('plastic'), glass: new Bin('glass') };
  const BX = { paper: -2.4, plastic: 0, glass: 2.4 };
  for (const k in bins) { const b = bins[k]; b.group.position.set(BX[k], 0.3, -1.9); b.group.scale.setScalar(0.001); ctx.root.add(b.group); }
  ctx.onUpdate((dt) => { for (const k in bins) bins[k].update(dt, E.time); });
  ctx.tween(0.55, (k) => { for (const b of Object.values(bins)) b.group.scale.setScalar(Math.max(0.001, k)); }, { ease: Ease.back });
  Sfx.play('whoosh');
  view = [3.8, 1.9, 8.4]; fov();
  await ctx.camTo(new THREE.Vector3(0, 3.7, 8.4), new THREE.Vector3(0, 1.45, -0.6), 0.9);
  const items = { paper, plastic, glass };
  const into = (kind) => {
    const b = bins[kind], it = items[kind];
    b.hop(); b.flap(); Sfx.play('pop');
    const p0 = it.position.clone(), p1 = new THREE.Vector3(BX[kind], 2.1, -1.9);
    ctx.tween(0.7, (k, r) => {
      it.position.lerpVectors(p0, p1, k); it.position.y += Math.sin(r * Math.PI) * 1.4;
      it.scale.setScalar(Math.max(0.001, (kind === 'paper' ? 1.5 : 1.35) * (1 - Math.max(0, r - 0.75) * 4)));
    }, { ease: Ease.inOut }).then(() => { it.visible = false; Sfx.play('chime'); });
  };
  const t4 = Voice.lines.ed04.text;
  const at4 = (w) => Math.max(0, t4.indexOf(w) / t4.length - 0.03);
  await ctx.say('ed04', { cues: [
    { at: at4('mėlyną'), fn: () => into('paper') },
    { at: at4('geltoną'), fn: () => into('plastic') },
    { at: at4('žalią'), fn: () => into('glass') },
  ] });
  await ctx.wait(0.8);
  G.go('build');
}

export async function auto(ctx) {
  await ctx.until(() => ctx.waiting === 'choose' && !Voice.playing);
  ctx.api.choose('plastic'); // exercise the "not quite" path
}
