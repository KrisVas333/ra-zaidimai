// takeapart: back at the build table, an open parts box beside the robot. d01. The child taps parts in any order
// that is physically possible (outer parts first: band, claws, pin, wheels; then beams; the hub last); each flies into
// its own compartment. Table empty → d02 → reward.
import * as THREE from '../three.js';
import { buildTable, buildPartsBox } from '../world.js';
import { Robot } from '../robot.js';
import { fitFov, setBackdrop } from '../engine.js';
import { Sfx, Voice } from '../audio.js';

const LABEL = { band: 'Gumytė', claws: 'Nagai', pin: 'Kaištis', wheels: 'Ratai', beams: 'Sijos', hub: 'Valdiklis' };

export async function enter(ctx) {
  const { E, UI, G } = ctx;
  setBackdrop('studio');
  E.hemi.intensity = 1.5;
  buildTable(ctx.root);
  const fx = ctx.fx();

  const robot = new Robot();
  robot.group.position.set(-1.5, 0.05, 0.3);
  robot.group.rotation.y = 0.55;
  ctx.root.add(robot.group);
  E.shadowFocus = robot.group;
  ctx.onUpdate((dt) => robot.update(dt));

  const box = buildPartsBox(ctx.root);
  box.position.set(2.3, 0.0, 0.2); box.rotation.y = -0.25;
  const slots = box.userData.slots;

  const look = new THREE.Vector3(0.4, 0.5, 0.2);
  const place = () => {
    E.camera.fov = fitFov(4.2, 2.6, 7.6); E.camera.updateProjectionMatrix();
    ctx.setCam(new THREE.Vector3(0.4, 4.3, 6.7), look);
  };
  place();
  E.onResize.add(place); ctx.cleanup(() => E.onResize.delete(place));

  // groups: what flies, which compartment, what must be off first, where the hotspot sits
  const G6 = [
    { id: 'band', objs: [robot.band], slot: 0, needs: [], hot: robot.band, off: [0, 0, 0], r: 0.6, s: 0.8 },
    { id: 'claws', objs: [robot.clawA, robot.clawB], slot: 1, needs: [], hot: robot.arm, off: [0, 0.1, 1.25], r: 0.65, s: 0.8 },
    { id: 'pin', objs: [robot.pin], slot: 2, needs: [], hot: robot.pin, off: [0, 0.35, 0], r: 0.5, s: 1.1 },
    { id: 'wheels', objs: [robot.wheels[0], robot.wheels[1], robot.skid], slot: 3, needs: [], hot: robot.wheels[0], off: [0, 0, 0], r: 0.55, s: 0.75 },
    { id: 'beams', objs: [robot.beamA, robot.beamB], slot: 4, needs: ['claws', 'pin', 'band'], hot: robot.arm, off: [0, 0.15, 0.2], r: 0.8, s: 0.5 },
    { id: 'hub', objs: [robot.hub], slot: 5, needs: ['wheels', 'beams'], hot: robot.hub, off: [0, 0.7, 0], r: 0.8, s: 0.6 },
  ];
  const gone = new Set();
  let busy = 0;

  const free = (g) => !gone.has(g.id) && g.needs.every((n) => gone.has(n));
  ctx.api.free = () => G6.filter(free).map((g) => g.id);
  ctx.api.take = (id) => {
    const g = G6.find((x) => x.id === id);
    if (!g || !free(g)) return;
    gone.add(g.id);
    g.h.remove();
    busy++;
    Sfx.play('whoosh');
    box.updateMatrixWorld(true);
    const slotW = box.localToWorld(slots[g.slot].clone());
    g.objs.forEach((o, j) => {
      ctx.root.attach(o);
      const p0 = o.position.clone(), q0 = o.quaternion.clone(), s0 = o.scale.x;
      const off = (j - (g.objs.length - 1) / 2) * 0.28;
      const tgt = slotW.clone().add(new THREE.Vector3(off, 0.08 + j * 0.02, 0));
      const tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, box.rotation.y + (g.id === 'beams' ? Math.PI / 2 : 0.3), 0));
      const mid = p0.clone().lerp(tgt, 0.5); mid.y += 1.4;
      ctx.tween(0.7, (k) => {
        const a = p0.clone().lerp(mid, k), b = mid.clone().lerp(tgt, k);
        o.position.copy(a.lerp(b, k));
        o.quaternion.slerpQuaternions(q0, tq, k);
        o.scale.setScalar(s0 + (g.s - s0) * k);
      }, { delay: j * 0.08 }).then(() => {
        box.attach(o);
        if (j === g.objs.length - 1) {
          Sfx.play('clack');
          fx.sparkles.pop(slotW.clone().setY(0.8), 6);
          busy--;
          refresh();
          if (gone.size === G6.length) done.fire();
        }
      });
    });
  };

  const refresh = () => {
    // one part at a time: only the glowing part is live (a tap elsewhere on the small robot never takes a hidden part)
    let lit = false;
    for (const g of G6) if (!gone.has(g.id)) { const on = free(g) && !lit; g.h.set(on); g.h.pulse(on); if (on) lit = true; }
  };
  for (const g of G6) {
    g.h = ctx.hot({ obj: g.hot, offset: g.off, r: g.r, minPx: 72, label: LABEL[g.id], onTap: () => ctx.api.take(g.id) });
  }
  refresh();
  // keyboard: Enter / Space / 1–6 take the next free part
  ctx.onKey((e) => {
    if (ctx.waiting !== 'take') return;
    if (e.key === 'Enter' || e.key === ' ' || /^[1-6]$/.test(e.key)) {
      if (document.activeElement && document.activeElement.classList.contains('hot')) return; // native click
      const f = ctx.api.free(); if (f.length) { e.preventDefault(); ctx.api.take(f[0]); }
    }
  });

  const done = ctx.signal();
  ctx.waiting = 'take';
  ctx.say('d01');
  const stopIdle = ctx.idle(() => refresh());
  await done.promise;
  stopIdle();
  ctx.waiting = 'done';
  // the lid closes over a tidy box
  await ctx.wait(0.3);
  Sfx.play('chime');
  fx.confetti.burst(box.localToWorld(new THREE.Vector3(0, 1, 0)), 40, 1.4, 4);
  await ctx.until(() => !Voice.playing);
  await ctx.say('d02');
  G.go('reward');
}

export async function auto(ctx) {
  await ctx.until(() => ctx.waiting === 'take' && ctx.api.free);
  while (ctx.waiting === 'take') {
    const f = ctx.api.free();
    if (f.length) ctx.api.take(f[0]);
    await ctx.wait(0.35);
  }
}
