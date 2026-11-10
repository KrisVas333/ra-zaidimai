// start: title, the finished robot turning on a pedestal in the park, one huge ▶. No voice (no tap yet).
import * as THREE from '../three.js';
import { buildPark, addBins } from '../world.js';
import { Robot } from '../robot.js';
import { makeKid } from '../chars.js';
import { Kit, M } from '../util.js';
import { fitFov } from '../engine.js';
import { Sfx } from '../audio.js';

const cyl = (a, b, h, s = 40) => new THREE.CylinderGeometry(a, b, h, s);

export function enter(ctx) {
  const { E, UI, G } = ctx;
  buildPark(ctx.root);
  addBins(ctx.root);
  const fx = ctx.fx();

  const ped = new THREE.Mesh(new Kit().add(cyl(1.7, 1.85, 0.6), 0xffffff, [0, 0.3, 0]).add(cyl(1.76, 1.76, 0.08), 0x39e6e0, [0, 0.62, 0]).geo(), M.toy);
  ped.position.set(0, 0, 2); ped.receiveShadow = true; ctx.root.add(ped);
  const robot = new Robot();
  robot.group.position.set(0, 0.66, 2);
  ctx.root.add(robot.group);
  E.shadowFocus = robot.group;

  const kids = [['leo', -3.6, 2.6, 0.5], ['neo', 3.5, 2.4, -0.5], ['maja', 5.4, 0.6, -0.7]].map(([k, x, z, ry]) => {
    const kid = makeKid(k); kid.group.position.set(x, 0, z); kid.group.rotation.y = ry; ctx.root.add(kid.group);
    fx.blobs.track(kid.group, 0.8);
    return kid;
  });
  kids[0].set('wave');

  const look = new THREE.Vector3(0, 1.9, 1.6);
  const place = () => {
    E.camera.fov = fitFov(6.2, 3.2, 9.5);
    E.camera.updateProjectionMatrix();
    ctx.setCam(new THREE.Vector3(0, 3.0, 11.2), look);
  };
  place();
  E.onResize.add(place); ctx.cleanup(() => E.onResize.delete(place));

  let t = 0, gripT = 2;
  ctx.onUpdate((dt) => {
    t += dt;
    if (!E.reduced) robot.group.rotation.y += dt * 0.45;
    gripT -= dt;
    if (gripT < 0) { robot.grip(robot.isOpen() ? 0 : 1); gripT = 1.6; }
    robot.update(dt);
    for (const k of kids) k.update(dt);
    if (t > 4 && kids[0].anim === 'wave') kids[0].set('idle');
  });

  // UI
  UI.add('<h1>Roboto ranka</h1><p>Sutvarkyk parką</p>', 'title-wrap');
  const row = UI.add('', 'start-play');
  ctx.api.play = () => { Sfx.unlock(); Sfx.play('pop'); G.go('avatar'); };
  ctx.api.trophy = () => { Sfx.unlock(); Sfx.play('click'); G.go('trophy'); };
  if (G.state.completed) UI.pill({ icon: 'trophy', text: 'Mano robotai', onClick: ctx.api.trophy, parent: row });
  const play = UI.button({ icon: 'play', cls: 'go huge pulse', label: 'Pradėti', onClick: ctx.api.play, parent: row });
  play.focus({ preventScroll: true });
  const pl = UI.add('', 'parents-link');
  const pb = document.createElement('button');
  pb.className = 'link-btn'; pb.type = 'button'; pb.textContent = 'Tėvams';
  pb.addEventListener('click', (e) => { e.stopPropagation(); UI.parentCard(); });
  pl.appendChild(pb);
}

export async function auto(ctx) {
  await ctx.wait(0.4);
  ctx.api.play();
}
