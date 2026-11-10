// avatar: 4 avatars on pedestals. a01 → tap one → it jumps → a02 → story.
import * as THREE from '../three.js';
import { buildPark } from '../world.js';
import { makeKid, AVATARS } from '../chars.js';
import { Kit, M } from '../util.js';
import { fitFov } from '../engine.js';
import { Sfx, Voice } from '../audio.js';

const cyl = (a, b, h, s = 36) => new THREE.CylinderGeometry(a, b, h, s);

export async function enter(ctx) {
  const { E, UI, G } = ctx;
  buildPark(ctx.root);
  const fx = ctx.fx();
  const X = [-4.5, -1.5, 1.5, 4.5];
  const pk = new Kit();
  X.forEach((x) => { pk.add(cyl(1.1, 1.2, 0.5), 0xffffff, [x, 0.25, 0]); pk.add(cyl(1.14, 1.14, 0.07), 0x39e6e0, [x, 0.52, 0]); });
  const peds = new THREE.Mesh(pk.geo(), M.toy); peds.receiveShadow = true; ctx.root.add(peds);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.07, 10, 48), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  ring.rotation.x = Math.PI / 2; ring.visible = false; ctx.root.add(ring);

  const kids = AVATARS.map((_, i) => {
    const k = makeKid(i);
    k.group.position.set(X[i], 0.55, 0);
    ctx.root.add(k.group);
    return k;
  });
  const prev = G.state.avatar;
  if (prev != null && kids[prev]) { ring.visible = true; ring.position.set(X[prev], 0.6, 0); }

  const place = () => {
    E.camera.fov = fitFov(6.6, 2.4, 10.5);
    E.camera.updateProjectionMatrix();
    // phone landscape: aim a little higher so the four kids sit lower, under the HUD-band caption (a01 wraps to 4 lines)
    ctx.setCam(new THREE.Vector3(0, 3.4, 10.5), new THREE.Vector3(0, E.h <= 520 ? 2.35 : 1.75, 0));
  };
  place();
  E.onResize.add(place); ctx.cleanup(() => E.onResize.delete(place));
  ctx.onUpdate((dt) => { for (const k of kids) k.update(dt); ring.rotation.z += dt; });

  const sig = ctx.signal();
  let picked = false;
  ctx.api.pick = (i) => {
    if (picked) return;
    picked = true;
    Sfx.play('pop');
    sig.fire(i);
  };
  const hots = kids.map((k, i) => ctx.hot({ obj: k.group, offset: [0, 1.6, 0], r: 1.3, minPx: 96, label: `Veikėjas ${i + 1}`, onTap: () => ctx.api.pick(i) }));
  ctx.onKey((e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 4) ctx.api.pick(n - 1); });
  ctx.waiting = 'pick';
  const intro = ctx.say('a01');
  const stopIdle = ctx.idle(() => hots.forEach((h) => h.pulse()));
  const i = await sig.promise;
  stopIdle();
  ctx.waiting = null;
  hots.forEach((h) => h.remove());
  G.state.avatar = i;
  G.state.last = null; // a new lesson run starts here: the parent card never mixes two runs
  G.save();
  ring.visible = true; ring.position.set(X[i], 0.6, 0);
  kids[i].set('jump');
  fx.sparkles.pop(new THREE.Vector3(X[i], 2.4, 0), 12);
  kids.forEach((k, j) => { if (j !== i) k.set('wave'); });
  await ctx.wait(0.7);
  kids[i].set('cheer');
  await ctx.say('a02');
  void intro;
  G.go('story');
}

export async function auto(ctx) {
  await ctx.until(() => ctx.waiting === 'pick' && !Voice.playing);
  ctx.api.pick(1);
}
