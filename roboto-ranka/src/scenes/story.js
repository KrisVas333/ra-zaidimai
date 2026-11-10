// story (the hook): Leo walks into the littered park; the child taps 3 litter pieces; Leo says "yuck";
// Neo and Maja run in with the idea of a robot. st01–st06 → idea.
import * as THREE from '../three.js';
import { buildPark, addBins, makeLitter, KINDS } from '../world.js';
import { makeKid } from '../chars.js';
import { Robot } from '../robot.js';
import { fitFov } from '../engine.js';
import { Sfx, Voice } from '../audio.js';
import { Ease } from '../util.js';

const SPOTS = [[-4.6, 4.0], [-2.4, 0.0], [0.6, 4.6], [2.9, -1.3], [4.8, 3.6], [-5.9, -1.8], [6.4, 0.6], [-0.9, -3.0], [2.6, 6.2]];

export async function enter(ctx) {
  const { E, UI, G } = ctx;
  const park = buildPark(ctx.root);
  addBins(ctx.root);
  const fx = ctx.fx();

  const litter = SPOTS.map(([x, z], i) => {
    const l = makeLitter(KINDS[i % 3], i);
    l.position.set(x, 0, z); l.rotation.y = i * 1.7;
    ctx.root.add(l);
    return l;
  });
  const leo = makeKid('leo'), neo = makeKid('neo'), maja = makeKid('maja');
  const kids = [leo, neo, maja];
  leo.group.position.set(-13, 0, 3); leo.group.rotation.y = Math.PI / 2;
  neo.group.position.set(14, 0, 2.6); maja.group.position.set(15, 0, 1.4);
  for (const k of kids) { ctx.root.add(k.group); fx.blobs.track(k.group, 0.8); }

  // floating picture of the robot (a tiny robot in a glowing ring)
  // y 3.35 (was 5.0): the "let's build THIS" picture sits under the caption (also the phone's HUD-band caption),
  // above the gap between Leo and Neo (at x 2.2 Maja's beanie poked into it)
  const BUBBLE_X = -0.15, BUBBLE_Y = 3.35, BUBBLE_S = 0.78;
  const bubble = new THREE.Group(); bubble.position.set(BUBBLE_X, BUBBLE_Y, 1.6); bubble.scale.setScalar(0.001); bubble.visible = false; ctx.root.add(bubble);
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.09, 12, 56), new THREE.MeshBasicMaterial({ color: 0x39e6e0 }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.22, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  bubble.add(disc, ringMesh);
  const mini = new Robot({ shadows: false }); mini.group.scale.setScalar(0.42); mini.group.position.set(0, -0.45, 0.2); mini.group.rotation.set(0.25, -0.6, 0); bubble.add(mini.group);

  const fov = () => { E.camera.fov = fitFov(7.5, 3.6, 12); E.camera.updateProjectionMatrix(); };
  fov(); E.onResize.add(fov); ctx.cleanup(() => E.onResize.delete(fov));
  ctx.setCam(new THREE.Vector3(0, 17, 25), new THREE.Vector3(0, 0, -1));

  let glintT = 0, time = 0;
  ctx.onUpdate((dt) => {
    time += dt;
    for (const k of kids) k.update(dt);
    mini.update(dt);
    if (bubble.visible) { bubble.lookAt(E.camera.position); bubble.position.y = BUBBLE_Y + Math.sin(time * 2) * 0.12; }
    if (ctx.glint) {
      glintT -= dt;
      if (glintT < 0) {
        glintT = 0.45;
        const l = litter[Math.floor(Math.random() * litter.length)];
        if (!l.userData.tapped) fx.sparkles.add(l.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { size: 1.1, life: 0.6, vy: 0.2 });
      }
    }
    for (const l of litter) if (l.userData.hopT > 0) { l.userData.hopT -= dt; const k = 1 - l.userData.hopT / 0.45; l.position.y = Math.sin(Math.min(1, k) * Math.PI) * 0.6; }
  });

  const walk = async (kid, to, dur, anim = 'walk') => {
    const from = kid.group.position.clone();
    kid.face(to.x, to.z); kid.set(anim);
    await ctx.tween(dur, (k) => kid.group.position.lerpVectors(from, to, k), { ease: Ease.linear });
    kid.set('idle');
  };

  // 1 · Leo walks in
  ctx.camTo(new THREE.Vector3(0, 6.4, 13.5), new THREE.Vector3(0, 1.3, 0.6), 3.2);
  const w1 = walk(leo, new THREE.Vector3(-1.6, 0, 2.4), 3.0);
  await ctx.say('st01');
  await w1;
  leo.group.rotation.y = 0.2; leo.set('look');

  // 2 · tap any 3 litter pieces
  ctx.glint = true;
  let count = 0;
  const done = ctx.signal();
  ctx.api.tapLitter = (i) => {
    const l = litter[i];
    if (!l || l.userData.tapped || count >= 3) return;
    l.userData.tapped = true; l.userData.hopT = 0.45;
    count++;
    Sfx.play('pop');
    fx.sparkles.pop(l.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 10);
    const s = UI.screenOf(l, [0, 0.9, 0]);
    UI.floatNum(String(count), s.x, s.y);
    hots[i].remove();
    if (count === 3) done.fire();
  };
  const hots = litter.map((l, i) => ctx.hot({ obj: l, offset: [0, 0.25, 0], r: 0.7, minPx: 76, label: 'Šiukšlė', onTap: () => ctx.api.tapLitter(i) }));
  ctx.waiting = 'litter';
  ctx.say('st02');
  const stopIdle = ctx.idle(() => hots.forEach((h) => h.pulse()));
  await done.promise;
  stopIdle(); ctx.waiting = null; ctx.glint = false;
  hots.forEach((h) => h.remove());
  await ctx.wait(0.5);

  // 3 · yuck
  await ctx.say('st03');
  leo.face(E.camera.position.x, E.camera.position.z); // talking kids face the child, not the park
  leo.set('yuck');
  await ctx.say('st04');

  // 4 · friends run in with the robot idea
  ctx.camTo(new THREE.Vector3(1.0, 5.8, 13.2), new THREE.Vector3(1.0, 2.0, 0.8), 1.4);
  const r1 = walk(neo, new THREE.Vector3(1.2, 0, 2.9), 1.4, 'run');
  const r2 = walk(maja, new THREE.Vector3(3.2, 0, 1.6), 1.6, 'run');
  // the speaking kids turn toward the camera (a little toward each other), never their backs
  const faceCam = (kid, dx = 0) => kid.face(E.camera.position.x + dx, E.camera.position.z);
  const showBubble = () => {
    if (bubble.visible) return;
    bubble.visible = true; Sfx.play('pop');
    ctx.tween(0.5, (k) => bubble.scale.setScalar(Math.max(0.001, k * BUBBLE_S)), { ease: Ease.back });
    faceCam(neo, -2); neo.set('point'); // a little toward the picture on his left
  };
  const line = ctx.say('st05', { cues: [{ at: 0.3, fn: () => { faceCam(maja, -3); maja.set('wave'); } }, { at: 0.55, fn: () => showBubble() }] });
  await r1; await r2;
  faceCam(neo, -2); faceCam(maja, -3);
  leo.set('idle'); faceCam(leo, 3);
  await line;
  showBubble();
  leo.set('cheer'); maja.set('cheer');
  await ctx.say('st06');
  G.go('idea');
}

export async function auto(ctx) {
  await ctx.until(() => ctx.waiting === 'litter');
  for (const i of [0, 2, 3]) { await ctx.wait(0.25); ctx.api.tapLitter(i); }
}
