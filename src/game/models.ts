import * as THREE from 'three';
import type { Weapon } from '../data/weapons';

/* ------------------------------------------------------------------ */
/* Shared materials                                                    */
/* ------------------------------------------------------------------ */

const M = {
  asphalt: new THREE.MeshStandardMaterial({ color: 0x2a281f, roughness: 0.95 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x585444, roughness: 0.9 }),
  concreteDark: new THREE.MeshStandardMaterial({ color: 0x3e3b30, roughness: 0.92 }),
  crate: new THREE.MeshStandardMaterial({ color: 0x6b5c3d, roughness: 0.85 }),
  crateDark: new THREE.MeshStandardMaterial({ color: 0x4d4330, roughness: 0.88 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x3a3d38, roughness: 0.55, metalness: 0.55 }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x24261f, roughness: 0.5, metalness: 0.6 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x6d432b, roughness: 0.85, metalness: 0.2 }),
  glow: new THREE.MeshBasicMaterial({ color: 0xffc06a }),
  glowRed: new THREE.MeshBasicMaterial({ color: 0xff5b3d }),
  glowBlue: new THREE.MeshBasicMaterial({ color: 0x6fd0ff }),
  skin: new THREE.MeshStandardMaterial({ color: 0xa98a68, roughness: 0.8 }),
  skinDark: new THREE.MeshStandardMaterial({ color: 0x8a6f52, roughness: 0.8 }),
  clothOlive: new THREE.MeshStandardMaterial({ color: 0x4c5236, roughness: 0.95 }),
  clothBrown: new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 }),
  clothDark: new THREE.MeshStandardMaterial({ color: 0x2f3227, roughness: 0.95 }),
  metalGun: new THREE.MeshStandardMaterial({ color: 0x2b2d26, roughness: 0.45, metalness: 0.7 }),
  polymer: new THREE.MeshStandardMaterial({ color: 0x1f211a, roughness: 0.8 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x24261f, roughness: 0.9 }),
  sleeve: new THREE.MeshStandardMaterial({ color: 0x3f4530, roughness: 0.95 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08d4a, roughness: 0.4, metalness: 0.8 }),
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function capsule(radius: number, length: number, mat: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), mat);
  mesh.castShadow = true;
  return mesh;
}

function sphere(radius: number, mat: THREE.Material, segments = 12) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, segments, Math.max(8, Math.round(segments * 0.7))),
    mat,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(top: number, bottom: number, height: number, mat: THREE.Material, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* Enemy bodies get private material copies so hit flashes never bleed across
   the other soldiers in the arena. */
function ownMaterials(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const clones = mats.map((mat) => {
      const clone = mat.clone();
      clone.userData.owned = true;
      return clone;
    });
    mesh.material = Array.isArray(mesh.material) ? clones : clones[0];
  });
}

/* ------------------------------------------------------------------ */
/* Arena                                                               */
/* ------------------------------------------------------------------ */

export interface WorldData {
  group: THREE.Group;
  colliders: THREE.Box3[];
  bounds: number;
}

function makeGroundTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#24221b';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 20 + Math.random() * 26;
    ctx.fillStyle = `rgba(${v + 12},${v + 10},${v},${0.25 + Math.random() * 0.4})`;
    const s = 1 + Math.random() * 2.4;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, s, s);
  }
  ctx.strokeStyle = 'rgba(120,112,86,0.16)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(150,136,96,0.10)';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 504, 504);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.anisotropy = 8;
  return tex;
}

function addCollider(colliders: THREE.Box3[], mesh: THREE.Mesh) {
  mesh.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(mesh));
}

export function createWorld(): WorldData {
  const group = new THREE.Group();
  const colliders: THREE.Box3[] = [];
  const bounds = 54;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), color: 0xbfb79c, roughness: 0.96 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Perimeter walls
  const wallH = 4.2;
  const wallT = 1.6;
  const sides: Array<[number, number, number, number]> = [
    [0, -bounds - wallT / 2, bounds * 2 + wallT * 2, wallT],
    [0, bounds + wallT / 2, bounds * 2 + wallT * 2, wallT],
    [-bounds - wallT / 2, 0, wallT, bounds * 2],
    [bounds + wallT / 2, 0, wallT, bounds * 2],
  ];
  sides.forEach(([x, z, w, d]) => {
    const wall = box(w, wallH, d, M.concrete, x, wallH / 2, z);
    group.add(wall);
    addCollider(colliders, wall);
    const trim = box(w * 0.995, 0.18, d * 1.02, M.concreteDark, x, wallH - 0.28, z);
    group.add(trim);
  });

  // Scattered crates
  const rng = mulberry32(20261115);
  for (let i = 0; i < 30; i++) {
    const sx = 1.2 + rng() * 1.9;
    const sy = 0.9 + rng() * 1.4;
    const sz = 1.2 + rng() * 1.9;
    const angle = rng() * Math.PI * 2;
    const dist = 7 + rng() * 40;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const stack = rng() > 0.72 ? 2 : 1;
    for (let s = 0; s < stack; s++) {
      const crate = box(sx, sy, sz, s === 0 ? M.crate : M.crateDark, x, sy / 2 + s * (sy + 0.02), z);
      crate.rotation.y = rng() * 0.6 - 0.3;
      group.add(crate);
      if (s === 0) addCollider(colliders, crate);
    }
  }

  // Jersey barriers
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + 0.3;
    const dist = 24 + (i % 4) * 6;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const barrier = box(3.4, 0.95, 0.7, M.concreteDark, x, 0.48, z);
    barrier.rotation.y = angle + Math.PI / 2;
    group.add(barrier);
    addCollider(colliders, barrier);
  }

  // Light towers
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const dist = 41;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const pole = box(0.42, 9, 0.42, M.steelDark, x, 4.5, z);
    group.add(pole);
    addCollider(colliders, pole);
    const head = box(2.4, 0.4, 0.9, M.steel, x, 9, z);
    group.add(head);
    const panel = box(2.1, 0.16, 0.7, M.glow, x, 8.74, z);
    group.add(panel);
    if (i < 2) {
      const light = new THREE.PointLight(0xffb46b, 55, 34, 2);
      light.position.set(x, 8.4, z);
      group.add(light);
    }
  }

  // Oil drums
  for (let i = 0; i < 14; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 9 + rng() * 38;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 12), rng() > 0.5 ? M.rust : M.steel);
    drum.position.set(Math.cos(angle) * dist, 0.55, Math.sin(angle) * dist);
    drum.castShadow = true;
    drum.receiveShadow = true;
    group.add(drum);
  }

  // Simple houses
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const dist = 28 + (i % 3) * 6;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const w = 6 + (i % 2) * 2;
    const d = 5 + (i % 3);
    const h = 3.2 + (i % 2) * 0.6;
    const house = box(w, h, d, M.concrete, x, h / 2, z);
    house.rotation.y = angle;
    group.add(house);
    addCollider(colliders, house);
    const roof = box(w + 0.4, 0.35, d + 0.4, M.crateDark, x, h + 0.18, z);
    roof.rotation.y = angle;
    group.add(roof);
    const door = box(1.2, 2.2, 0.1, M.crate, x + Math.cos(angle) * (w / 2 + 0.05), 1.1, z + Math.sin(angle) * (w / 2 + 0.05));
    door.rotation.y = angle;
    group.add(door);
  }
  // Bridges
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + 0.5;
    const dist = 18;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const bridge = box(2.4, 0.4, 12, M.concreteDark, x, 1.4, z);
    bridge.rotation.y = angle + Math.PI / 2;
    group.add(bridge);
    addCollider(colliders, bridge);
    // railings
    for (const side of [-1, 1]) {
      const rail = box(0.15, 0.9, 12, M.steel, x + Math.cos(angle + Math.PI / 2) * side * 1.1, 1.9, z + Math.sin(angle + Math.PI / 2) * side * 1.1);
      rail.rotation.y = angle + Math.PI / 2;
      group.add(rail);
    }
  }

  // Central arena platform
  const arena = box(26, 1.2, 26, M.concrete, 0, 0.6, 0);
  group.add(arena);
  addCollider(colliders, arena);
  const arenaTrim = box(26.4, 0.25, 26.4, M.concreteDark, 0, 1.25, 0);
  group.add(arenaTrim);
  // Ramps
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const x = Math.cos(angle) * 15;
    const z = Math.sin(angle) * 15;
    const ramp = box(4, 0.4, 8, M.concreteDark, x, 0.8, z);
    ramp.rotation.y = angle;
    ramp.rotation.x = -0.18;
    group.add(ramp);
    addCollider(colliders, ramp);
  }

  // Tents and sandbag walls
  for (let i = 0; i < 8; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 12 + rng() * 30;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const tent = box(3.2, 2.1, 4.2, M.crateDark, x, 1.05, z);
    tent.rotation.y = rng() * Math.PI;
    group.add(tent);
    addCollider(colliders, tent);
    const ridge = box(0.2, 0.2, 4.4, M.steelDark, x, 2.2, z);
    ridge.rotation.y = tent.rotation.y;
    group.add(ridge);
  }
  for (let i = 0; i < 10; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 8 + rng() * 36;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const wall = box(2.6, 0.9, 0.6, M.concreteDark, x, 0.45, z);
    wall.rotation.y = rng() * Math.PI;
    group.add(wall);
    addCollider(colliders, wall);
  }

  return { group, colliders, bounds };
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Enemy models                                                        */
/* ------------------------------------------------------------------ */

export type EnemyType = 'grunt' | 'rifleman' | 'drone' | 'boss' | 'zombie';

export interface EnemyModel {
  group: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  torso: THREE.Group;
  head: THREE.Object3D;
  ring?: THREE.Object3D;
  type: EnemyType;
  armL?: THREE.Group;
  armR?: THREE.Group;
  weapon?: THREE.Group;
  core?: THREE.Mesh;
  cape?: THREE.Mesh;
}

/** Wave boss: a horned, tower-shielded warden built on the same skeleton. */
function createBossModel(): EnemyModel {
  const group = new THREE.Group();
  const armor = new THREE.MeshStandardMaterial({ color: 0x37302a, roughness: 0.44, metalness: 0.78 });
  const armorDark = new THREE.MeshStandardMaterial({ color: 0x1c1916, roughness: 0.55, metalness: 0.65 });
  const armourTrim = new THREE.MeshStandardMaterial({ color: 0xa88a51, roughness: 0.34, metalness: 0.9 });
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xd8c7a3, roughness: 0.62, metalness: 0.08 });
  const capeMat = new THREE.MeshStandardMaterial({
    color: 0x5a1f22,
    roughness: 0.94,
    side: THREE.DoubleSide,
    emissive: 0x2a0709,
    emissiveIntensity: 0.4,
  });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  const runeMat = new THREE.MeshBasicMaterial({
    color: 0xffcf7a,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const hip = box(0.82, 0.3, 0.52, armorDark, 0, 1.34, 0);
  hip.rotation.x = 0.05;
  group.add(hip);
  const belt = box(0.88, 0.16, 0.56, armourTrim, 0, 1.45, 0);
  group.add(belt);
  const buckle = box(0.2, 0.18, 0.06, coreMat, 0, 1.45, 0.3);
  group.add(buckle);

  const buildLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.28, 1.28, 0);
    const thighPlate = capsule(0.19, 0.5, armor);
    thighPlate.position.y = -0.28;
    leg.add(thighPlate);
    const thighGuard = box(0.28, 0.44, 0.14, armorDark, 0, -0.26, 0.12);
    thighGuard.rotation.x = -0.06;
    leg.add(thighGuard);
    const knee = sphere(0.17, armorDark, 10);
    knee.position.set(0, -0.58, 0.02);
    leg.add(knee);
    const kneeSpike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 6), armourTrim);
    kneeSpike.position.set(0, -0.58, 0.2);
    kneeSpike.rotation.x = Math.PI / 2;
    leg.add(kneeSpike);
    const shin = capsule(0.155, 0.5, armor);
    shin.position.y = -0.82;
    leg.add(shin);
    const shinGuard = box(0.26, 0.5, 0.16, armorDark, 0, -0.82, 0.1);
    leg.add(shinGuard);
    const boot = box(0.34, 0.22, 0.56, armorDark, 0, -1.15, 0.12);
    leg.add(boot);
    const toeCap = box(0.32, 0.14, 0.18, armourTrim, 0, -1.18, 0.38);
    leg.add(toeCap);
    group.add(leg);
    return leg;
  };
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  const torso = new THREE.Group();
  torso.position.y = 0;
  group.add(torso);

  const chest = capsule(0.44, 0.52, armor);
  chest.position.y = 2.02;
  chest.scale.set(1, 1, 0.82);
  torso.add(chest);
  const ribL = box(0.5, 0.2, 0.62, armorDark, -0.12, 1.82, 0);
  ribL.rotation.z = 0.08;
  torso.add(ribL);
  const ribR = box(0.5, 0.2, 0.62, armorDark, 0.12, 1.82, 0);
  ribR.rotation.z = -0.08;
  torso.add(ribR);
  const sternum = box(0.16, 0.66, 0.1, armourTrim, 0, 2.06, 0.36);
  sternum.rotation.x = -0.08;
  torso.add(sternum);

  const core = sphere(0.15, coreMat, 14);
  core.scale.set(1, 1, 0.6);
  core.position.set(0, 2.1, 0.4);
  torso.add(core);
  const coreCage = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.026, 5, 20), armourTrim);
  coreCage.position.set(0, 2.1, 0.4);
  torso.add(coreCage);
  const coreLight = new THREE.PointLight(0xffa53d, 5, 8, 2);
  coreLight.position.set(0, 2.1, 0.55);
  torso.add(coreLight);

  /* Shoulder mantles with outward spikes. */
  for (const side of [-1, 1]) {
    const pauldron = sphere(0.32, armorDark, 14);
    pauldron.scale.set(1.2, 0.66, 1);
    pauldron.position.set(side * 0.56, 2.34, 0);
    torso.add(pauldron);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.026, 5, 20, Math.PI), armourTrim);
    rim.position.set(side * 0.56, 2.34, 0);
    rim.rotation.y = Math.PI / 2;
    rim.rotation.z = side * 0.16;
    torso.add(rim);
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3 + i * 0.08, 6), hornMat);
      spike.position.set(side * (0.66 + i * 0.05), 2.46 - i * 0.05, -0.06 + i * 0.09);
      spike.rotation.z = side * -1.05;
      spike.rotation.x = 0.1 * i;
      torso.add(spike);
    }
  }

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 24, Math.PI * 1.3), capeMat);
  collar.rotation.x = Math.PI / 2;
  collar.rotation.z = Math.PI * 0.85;
  collar.position.y = 2.44;
  torso.add(collar);

  /* Helmeted head with a horned crown. */
  const head = new THREE.Group();
  head.position.y = 2.62;
  torso.add(head);
  const neck = capsule(0.13, 0.14, armorDark);
  neck.position.y = -0.1;
  head.add(neck);
  const skull = sphere(0.23, armorDark, 16);
  skull.scale.set(0.95, 1.05, 0.96);
  head.add(skull);
  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    armor,
  );
  helm.position.y = 0.04;
  head.add(helm);
  const faceMask = box(0.3, 0.16, 0.08, armorDark, 0, -0.04, 0.19);
  head.add(faceMask);
  for (const side of [-1, 1]) {
    const eye = sphere(0.032, coreMat, 8);
    eye.scale.set(1.5, 0.75, 0.5);
    eye.position.set(side * 0.075, 0.01, 0.225);
    head.add(eye);
    const hornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.16, 0.12, 0),
      new THREE.Vector3(side * 0.3, 0.34, 0.02),
      new THREE.Vector3(side * 0.42, 0.58, -0.06),
      new THREE.Vector3(side * 0.4, 0.82, -0.2),
    ]);
    const horn = new THREE.Mesh(new THREE.TubeGeometry(hornCurve, 14, 0.055, 7, false), hornMat);
    head.add(horn);
    const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 7), hornMat);
    hornTip.position.set(side * 0.38, 0.93, -0.25);
    hornTip.rotation.z = side * 0.32;
    hornTip.rotation.x = -0.4;
    head.add(hornTip);
    const earGuard = cylinder(0.09, 0.09, 0.05, armourTrim, 8);
    earGuard.position.set(side * 0.235, 0.0, 0);
    earGuard.rotation.z = Math.PI / 2;
    head.add(earGuard);
  }

  /* Tattered cape, animated as a cloth sheet. */
  const capeGeo = new THREE.PlaneGeometry(1.5, 2.25, 8, 12);
  const capePos = capeGeo.getAttribute('position');
  for (let i = 0; i < capePos.count; i++) {
    const x = capePos.getX(i);
    const y = capePos.getY(i);
    const edge = Math.abs(x) / 0.75;
    capePos.setZ(i, -0.12 - Math.sin((y / 2.25 + 0.5) * Math.PI) * 0.24 - edge * edge * 0.08);
  }
  capeGeo.computeVertexNormals();
  const cape = new THREE.Mesh(capeGeo, capeMat);
  cape.position.set(0, 1.9, -0.28);
  cape.rotation.x = 0.08;
  torso.add(cape);
  for (let i = 0; i < 3; i++) {
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.42), runeMat);
    rune.position.set((i - 1) * 0.32, 2.0, -0.52);
    rune.rotation.y = Math.PI;
    torso.add(rune);
  }

  /* Arms: long, plated, with a cleaver in the leading hand. */
  const buildArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.6, 2.28, 0);
    const upper = capsule(0.15, 0.4, armor);
    upper.position.y = -0.22;
    arm.add(upper);
    const elbow = sphere(0.15, armourTrim, 10);
    elbow.position.y = -0.5;
    arm.add(elbow);
    const fore = capsule(0.13, 0.44, armorDark);
    fore.position.y = -0.72;
    arm.add(fore);
    const bracer = box(0.3, 0.3, 0.32, armor, 0, -0.72, 0);
    arm.add(bracer);
    const fist = sphere(0.17, armorDark, 10);
    fist.position.y = -1.02;
    arm.add(fist);
    arm.rotation.x = -0.08;
    arm.rotation.z = side * 0.12;
    torso.add(arm);
    return arm;
  };
  const armL = buildArm(-1);
  const armR = buildArm(1);

  const weapon = new THREE.Group();
  weapon.position.set(0.98, 1.28, 0.18);
  weapon.rotation.z = -0.24;
  weapon.rotation.x = -0.12;
  const haft = cylinder(0.045, 0.055, 1.5, armorDark, 8);
  haft.rotation.x = Math.PI / 2;
  haft.position.z = 0.35;
  weapon.add(haft);
  const guard = box(0.42, 0.1, 0.16, armourTrim, 0, 0, -0.36);
  weapon.add(guard);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x6e7378,
    roughness: 0.24,
    metalness: 0.95,
    emissive: 0xff7a2a,
    emissiveIntensity: 0.22,
  });
  const cleaver = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 2.1), bladeMat);
  cleaver.position.set(0, 0, -1.4);
  weapon.add(cleaver);
  const cleaverEdge = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.045, 2.05), runeMat);
  cleaverEdge.position.set(0, -0.085, -1.42);
  weapon.add(cleaverEdge);
  const cleaverTip = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.5, 4), bladeMat);
  cleaverTip.position.set(0, 0, -2.66);
  cleaverTip.rotation.x = -Math.PI / 2;
  cleaverTip.rotation.z = Math.PI / 4;
  weapon.add(cleaverTip);
  for (let i = 0; i < 3; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 5), armourTrim);
    tooth.position.set(0.34, 0, -0.6 - i * 0.5);
    tooth.rotation.z = -Math.PI / 2;
    weapon.add(tooth);
  }
  torso.add(weapon);

  const floorRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.92, 40), runeMat);
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = 0.04;
  group.add(floorRing);

  ownMaterials(group);
  return { group, legL, legR, torso, head, type: 'boss', armL, armR, weapon, core, cape };
}

export function createEnemyModel(type: EnemyType): EnemyModel {
  const group = new THREE.Group();

  if (type === 'boss') return createBossModel();

  if (type === 'zombie') {
    const group = new THREE.Group();
    const cloth = new THREE.MeshStandardMaterial({ color: 0x3a4a34, roughness: 0.95 });
    const clothDark = new THREE.MeshStandardMaterial({ color: 0x222a1e, roughness: 0.95 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x6f8a5a, roughness: 0.9, emissive: 0x1a2a12, emissiveIntensity: 0.35 });
    const hip = box(0.4, 0.18, 0.24, clothDark, 0, 0.92, 0);
    group.add(hip);
    const buildLeg = (side: number) => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.12, 0.92, 0);
      const thigh = capsule(0.095, 0.3, clothDark);
      thigh.position.y = -0.22;
      leg.add(thigh);
      const shin = capsule(0.08, 0.3, clothDark);
      shin.position.y = -0.55;
      leg.add(shin);
      const foot = box(0.15, 0.1, 0.26, clothDark, 0, -0.78, 0.04);
      leg.add(foot);
      group.add(leg);
      return leg;
    };
    const legL = buildLeg(-1);
    const legR = buildLeg(1);
    const torso = new THREE.Group();
    torso.position.y = 0;
    group.add(torso);
    const chest = capsule(0.2, 0.36, cloth);
    chest.position.y = 1.32;
    torso.add(chest);
    const neck = capsule(0.06, 0.06, skin);
    neck.position.y = 1.56;
    torso.add(neck);
    const head = new THREE.Group();
    head.position.y = 1.7;
    const skull = sphere(0.13, skin, 10);
    head.add(skull);
    const jaw = sphere(0.1, skin, 8);
    jaw.scale.set(0.85, 0.55, 0.8);
    jaw.position.set(0, -0.06, 0.02);
    head.add(jaw);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9cff6a });
    for (const side of [-1, 1]) {
      const eye = sphere(0.022, eyeMat, 6);
      eye.position.set(side * 0.045, 0.02, 0.105);
      head.add(eye);
    }
    torso.add(head);
    const buildArm = (side: number) => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.26, 1.42, 0);
      const upper = capsule(0.075, 0.22, cloth);
      upper.position.y = -0.13;
      arm.add(upper);
      const fore = capsule(0.06, 0.22, skin);
      fore.position.y = -0.38;
      arm.add(fore);
      const hand = sphere(0.06, skin, 8);
      hand.position.y = -0.52;
      arm.add(hand);
      arm.rotation.x = -0.35;
      arm.rotation.z = side * 0.18;
      torso.add(arm);
      return arm;
    };
    buildArm(-1);
    buildArm(1);
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 5, 24), new THREE.MeshBasicMaterial({ color: 0x6f8a5a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    aura.rotation.x = Math.PI / 2;
    aura.position.y = 0.06;
    group.add(aura);
    ownMaterials(group);
    return { group, legL, legR, torso, head, type: 'zombie' };
  }

  if (type === 'drone') {
    const body = capsule(0.34, 0.5, M.steel);
    body.rotation.x = Math.PI / 2;
    body.position.y = 1.35;
    group.add(body);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), M.glowRed);
    core.position.set(0, 1.35, -0.36);
    group.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 22), M.steelDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.35;
    group.add(ring);
    const fins = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const fin = box(0.06, 0.06, 0.5, M.steelDark, 0, 0, 0);
      fin.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.34, 1.35, Math.sin((i / 3) * Math.PI * 2) * 0.34);
      fin.rotation.y = -(i / 3) * Math.PI * 2;
      fins.add(fin);
    }
    group.add(fins);
    const glow = new THREE.PointLight(0xff4a30, 6, 6, 2);
    glow.position.set(0, 1.35, -0.3);
    group.add(glow);
    const legL = new THREE.Group();
    const legR = new THREE.Group();
    ownMaterials(group);
    return { group, legL, legR, torso: group, head: core, ring, type };
  }

  const cloth = type === 'rifleman' ? M.clothOlive : M.clothBrown;
  const clothDark = type === 'rifleman' ? M.clothDark : M.clothBrown;

  // Hips + legs (legs animated)
  const hip = box(0.46, 0.22, 0.28, clothDark, 0, 0.96, 0);
  group.add(hip);

  const buildLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.14, 0.96, 0);
    const thigh = capsule(0.105, 0.34, clothDark);
    thigh.position.y = -0.24;
    leg.add(thigh);
    const shin = capsule(0.09, 0.34, clothDark);
    shin.position.y = -0.62;
    leg.add(shin);
    const boot = box(0.17, 0.12, 0.3, M.polymer, 0, -0.86, 0.05);
    leg.add(boot);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M.polymer);
    knee.position.y = -0.44;
    leg.add(knee);
    group.add(leg);
    return leg;
  };
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  const torso = new THREE.Group();
  torso.position.y = 0;
  group.add(torso);

  const chest = capsule(0.24, 0.42, cloth);
  chest.position.y = 1.38;
  torso.add(chest);

  const vest = box(0.5, 0.4, 0.34, M.clothDark, 0, 1.4, 0);
  torso.add(vest);
  const pouch = box(0.16, 0.13, 0.06, clothDark, -0.12, 1.3, 0.19);
  torso.add(pouch);
  const pouch2 = box(0.12, 0.1, 0.06, clothDark, 0.12, 1.31, 0.19);
  torso.add(pouch2);

  const neck = capsule(0.07, 0.06, M.skinDark);
  neck.position.y = 1.63;
  torso.add(neck);

  const head = new THREE.Group();
  head.position.y = 1.74;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), M.skin);
  head.add(skull);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), M.clothDark);
  helmet.position.y = 0.03;
  head.add(helmet);
  const visor = box(0.2, 0.05, 0.03, M.polymer, 0, 0.005, 0.13);
  head.add(visor);
  torso.add(head);

  // Shoulders + arms
  const buildArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.3, 1.5, 0);
    const upper = capsule(0.085, 0.24, cloth);
    upper.position.y = -0.14;
    arm.add(upper);
    const fore = capsule(0.07, 0.24, M.skinDark);
    fore.position.set(0, -0.42, -0.1);
    fore.rotation.x = -0.5;
    arm.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), M.glove);
    hand.position.set(0, -0.58, -0.2);
    arm.add(hand);
    arm.rotation.x = -0.45;
    arm.rotation.z = side * 0.12;
    torso.add(arm);
    return arm;
  };
  buildArm(-1);
  buildArm(1);

  if (type === 'rifleman') {
    const rifle = new THREE.Group();
    const body = box(0.06, 0.1, 0.62, M.metalGun, 0, 1.48, 0.32);
    rifle.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.42, 6), M.metalGun);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 1.5, 0.74);
    rifle.add(barrel);
    const mag = box(0.05, 0.16, 0.09, M.polymer, 0, 1.38, 0.34);
    mag.rotation.x = -0.2;
    rifle.add(mag);
    const grip = box(0.04, 0.12, 0.05, M.polymer, 0, 1.4, 0.18);
    rifle.add(grip);
    group.add(rifle);
  }

  ownMaterials(group);
  return { group, legL, legR, torso, head, type };
}

/* ------------------------------------------------------------------ */
/* First-person viewmodel                                              */
/* ------------------------------------------------------------------ */

export interface ViewModel {
  root: THREE.Group;
  muzzle: THREE.Object3D;
  flash: THREE.Mesh;
  flashLight: THREE.PointLight;
  hipPos: THREE.Vector3;
  adsPos: THREE.Vector3;
  hipRot: THREE.Euler;
  adsRot: THREE.Euler;
}

function gunMetalFor(weapon: Weapon) {
  const accent = new THREE.MeshStandardMaterial({
    color: weapon.color,
    roughness: 0.5,
    metalness: 0.35,
  });
  return accent;
}

function createSwordViewModel(weapon: Weapon): ViewModel {
  const root = new THREE.Group();
  const sword = new THREE.Group();
  root.add(sword);

  const mythic = weapon.rarity === 'mythic';
  const scale = mythic ? 1.08 : 0.96;
  const bladeMat = new THREE.MeshStandardMaterial({
    color: mythic ? 0xd9d5f0 : 0xc6ccd2,
    roughness: 0.16,
    metalness: 0.95,
    emissive: weapon.color,
    emissiveIntensity: mythic ? 0.22 : 0.05,
  });
  const edgeMat = new THREE.MeshBasicMaterial({ color: weapon.color });
  const gold = new THREE.MeshStandardMaterial({
    color: mythic ? 0xd9b466 : 0x93713f,
    roughness: 0.34,
    metalness: 0.85,
  });
  const wrapMat = new THREE.MeshStandardMaterial({ color: 0x1b1917, roughness: 0.94 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.38, metalness: 0.8 });

  const shape = new THREE.Shape();
  shape.moveTo(-0.046, 0.045);
  shape.lineTo(0.052, 0.045);
  shape.quadraticCurveTo(0.064, 0.3, 0.07, 0.58);
  shape.quadraticCurveTo(0.066, 0.79, 0.035, 0.93);
  shape.quadraticCurveTo(0.021, 0.98, 0.008, 1.02);
  shape.quadraticCurveTo(-0.007, 0.9, -0.026, 0.71);
  shape.quadraticCurveTo(-0.046, 0.4, -0.046, 0.045);
  const bladeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 8,
  });
  bladeGeo.translate(0, 0, -0.011);
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.castShadow = true;
  sword.add(blade);

  const spineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.024, 0.07, 0),
    new THREE.Vector3(-0.034, 0.3, 0),
    new THREE.Vector3(-0.03, 0.52, 0),
    new THREE.Vector3(-0.018, 0.74, 0),
    new THREE.Vector3(0.004, 0.92, 0),
  ]);
  const spine = new THREE.Mesh(new THREE.TubeGeometry(spineCurve, 18, 0.008, 6, false), darkSteel);
  sword.add(spine);
  const hamonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.034, 0.1, 0),
    new THREE.Vector3(0.046, 0.32, 0),
    new THREE.Vector3(0.048, 0.55, 0),
    new THREE.Vector3(0.032, 0.77, 0),
    new THREE.Vector3(0.011, 0.94, 0),
  ]);
  const hamonGlow = new THREE.MeshBasicMaterial({
    color: mythic ? 0xe0d0ff : 0xe8f1ff,
    transparent: true,
    opacity: mythic ? 0.85 : 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const hamon = new THREE.Mesh(new THREE.TubeGeometry(hamonCurve, 22, 0.005, 6, false), hamonGlow);
  sword.add(hamon);
  const fuller = new THREE.Mesh(new THREE.TubeGeometry(spineCurve, 18, 0.007, 6, false), darkSteel);
  fuller.position.x = 0.012;
  sword.add(fuller);
  if (mythic) {
    for (let i = 0; i < 4; i++) {
      const rune = box(0.004, 0.03, 0.026, edgeMat, -0.017, 0.27 + i * 0.1, 0);
      rune.rotation.z = -0.32;
      sword.add(rune);
    }
  }

  const habaki = box(0.068, 0.055, 0.036, gold, 0, 0.062, 0);
  sword.add(habaki);
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.018, 20), gold);
  tsuba.position.y = 0.012;
  sword.add(tsuba);
  const tsubaRim = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.007, 5, 20), gold);
  tsubaRim.rotation.x = Math.PI / 2;
  tsubaRim.position.y = 0.024;
  sword.add(tsubaRim);
  for (const side of [-1, 1]) {
    const guardHorn = box(0.028, 0.015, 0.022, gold, side * 0.078, 0.012, 0);
    guardHorn.rotation.z = side * 0.35;
    sword.add(guardHorn);
  }

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.023, 0.23, 10), wrapMat);
  grip.position.y = -0.105;
  sword.add(grip);
  const wrapAccent = new THREE.MeshStandardMaterial({
    color: mythic ? 0x4a3358 : 0x4a2b24,
    roughness: 0.86,
  });
  for (let i = 0; i < 7; i++) {
    const diamond = box(0.033, 0.027, 0.028, i % 2 === 0 ? wrapAccent : wrapMat, 0, -0.02 - i * 0.028, 0);
    diamond.rotation.y = Math.PI / 4;
    sword.add(diamond);
  }
  const mekugi = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.048, 6), gold);
  mekugi.rotation.z = Math.PI / 2;
  mekugi.position.set(0, -0.085, 0);
  sword.add(mekugi);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), gold);
  pommel.scale.set(1, 0.7, 1);
  pommel.position.y = -0.23;
  sword.add(pommel);
  const pommelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.027, 0.016, 10), darkSteel);
  pommelCap.position.y = -0.248;
  sword.add(pommelCap);

  /* Forearm and glove keep the weapon physically grounded in frame. */
  const sleeve = capsule(0.042, 0.22, M.sleeve);
  sleeve.position.set(0.06, -0.19, 0.13);
  sleeve.rotation.x = 1.02;
  sleeve.rotation.z = -0.28;
  root.add(sleeve);
  const glove = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M.glove);
  glove.scale.set(0.9, 0.78, 1.24);
  glove.position.set(0.005, -0.02, 0.035);
  root.add(glove);
  const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), M.glove);
  thumb.position.set(0.022, 0.015, -0.005);
  root.add(thumb);

  sword.scale.setScalar(scale);
  sword.rotation.x = -0.86;
  sword.rotation.z = -0.2;
  sword.position.set(0.01, -0.03, -0.02);

  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), new THREE.MeshBasicMaterial());
  flash.visible = false;
  root.add(flash);

  const flashLight = new THREE.PointLight(weapon.color, 0, 2, 2);
  root.add(flashLight);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.01, 0.8, -0.35);
  root.add(muzzle);

  const hipPos = new THREE.Vector3(0.26, -0.3, -0.44);
  const adsPos = new THREE.Vector3(0.11, -0.2, -0.54);
  const hipRot = new THREE.Euler(0.06, 0.1, -0.08);
  const adsRot = new THREE.Euler(-0.04, 0.02, 0.06);

  root.position.copy(hipPos);
  root.rotation.copy(hipRot);

  return { root, muzzle, flash, flashLight, hipPos, adsPos, hipRot, adsRot };
}

export function createViewModel(weapon: Weapon): ViewModel {
  if (weapon.kind === 'sword') return createSwordViewModel(weapon);

  const root = new THREE.Group();
  const gun = new THREE.Group();
  root.add(gun);

  const accent = gunMetalFor(weapon);
  const sniper = weapon.kind === 'sniper';
  const scale =
    weapon.kind === 'pistol' ? 0.76 : weapon.kind === 'smg' ? 0.9 : sniper ? 1.14 : 1;

  const receiverLen = (sniper ? 0.46 : 0.3) * scale;
  const receiver = box(0.062, sniper ? 0.095 : 0.085, receiverLen, M.metalGun, 0, 0, sniper ? -0.14 : -0.08);
  gun.add(receiver);
  const rail = box(0.05, 0.018, receiverLen * 0.94, M.polymer, 0, 0.052, sniper ? -0.15 : -0.09);
  gun.add(rail);
  const accentStrip = box(0.064, 0.018, receiverLen * 0.55, accent, 0, -0.025, sniper ? -0.12 : -0.06);
  gun.add(accentStrip);

  const handguardLen = weapon.kind === 'pistol' ? 0.06 : sniper ? 0.34 * scale : 0.16 * scale;
  const handguardZ = sniper ? -0.44 * scale : -0.3 * scale;
  const handguard = box(
    0.054,
    sniper ? 0.06 : 0.05,
    handguardLen,
    weapon.kind === 'pistol' ? M.polymer : M.metalGun,
    0,
    sniper ? -0.002 : 0.002,
    handguardZ,
  );
  gun.add(handguard);

  const barrelLen = weapon.kind === 'pistol' ? 0.09 : sniper ? 0.62 * scale : 0.2 * scale;
  const barrelZ = sniper ? -0.52 * scale : -0.34 * scale;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(sniper ? 0.014 : 0.011, sniper ? 0.014 : 0.011, barrelLen, 8),
    M.metalGun,
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.022, barrelZ - barrelLen / 2);
  gun.add(barrel);

  if (sniper) {
    /* Muzzle brake and free-floating rail give the platform a heavy silhouette. */
    const brake = box(0.034, 0.034, 0.07, M.steelDark, 0, 0.022, barrelZ - barrelLen + 0.015);
    gun.add(brake);
    const brakeSlot = box(0.036, 0.01, 0.04, M.polymer, 0, 0.022, barrelZ - barrelLen + 0.01);
    gun.add(brakeSlot);
    const bipod = new THREE.Group();
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.24, 6), M.steelDark);
      leg.position.set(side * 0.042, -0.085, -0.49 * scale);
      leg.rotation.z = side * 0.5;
      leg.rotation.x = -0.32;
      leg.castShadow = true;
      bipod.add(leg);
      const foot = box(0.02, 0.014, 0.03, M.polymer, side * 0.075, -0.18, -0.505 * scale);
      bipod.add(foot);
    }
    gun.add(bipod);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.1, 6), M.brass);
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(0.055, 0.012, -0.02);
    gun.add(bolt);
    const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), M.brass);
    boltKnob.position.set(0.108, 0.012, -0.02);
    gun.add(boltKnob);
  }

  if (weapon.kind !== 'pistol') {
    const mag = box(0.042, (sniper ? 0.2 : 0.15) * scale, 0.075, M.polymer, 0, sniper ? -0.115 : -0.1, sniper ? -0.12 : -0.09);
    mag.rotation.x = -0.18;
    gun.add(mag);
    const grip = box(0.045, 0.13, 0.06, M.polymer, 0, -0.09, 0.03);
    grip.rotation.x = 0.32;
    gun.add(grip);
    const stockLen = sniper ? 0.31 : 0.17;
    const stock = box(sniper ? 0.062 : 0.05, sniper ? 0.09 : 0.07, stockLen, M.polymer, 0, -0.005, sniper ? 0.19 : 0.12);
    gun.add(stock);
    const stockPad = box(sniper ? 0.068 : 0.054, sniper ? 0.115 : 0.09, 0.02, accent, 0, -0.005, sniper ? 0.345 : 0.205);
    gun.add(stockPad);
    if (sniper) {
      const cheek = box(0.056, 0.035, 0.13, M.polymer, 0, 0.048, 0.17);
      gun.add(cheek);
    }
  } else {
    const grip = box(0.04, 0.13, 0.055, M.polymer, 0, -0.09, 0.05);
    grip.rotation.x = 0.3;
    gun.add(grip);
  }

  if (weapon.optic === 'scope') {
    const tubeLen = sniper ? 0.3 : 0.16;
    const tubeRadius = sniper ? 0.04 : 0.028;
    const tubeZ = sniper ? -0.13 : -0.06;
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(tubeRadius, tubeRadius, tubeLen, 12),
      M.steelDark,
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, sniper ? 0.085 : 0.07, tubeZ);
    gun.add(tube);
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(sniper ? 0.034 : 0.024, 16),
      new THREE.MeshBasicMaterial({
        color: 0x8fd0ff,
        transparent: true,
        opacity: sniper ? 0.38 : 0.5,
      }),
    );
    lens.position.set(0, sniper ? 0.085 : 0.07, tubeZ - tubeLen / 2 - 0.001);
    gun.add(lens);
    if (sniper) {
      for (const z of [0.0, -0.26]) {
        const mount = box(0.038, 0.03, 0.03, M.steelDark, 0, 0.052, z);
        gun.add(mount);
      }
      const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 10), M.steelDark);
      turret.position.set(0, 0.128, tubeZ);
      gun.add(turret);
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.028, 10), M.brass);
      dial.rotation.z = Math.PI / 2;
      dial.position.set(0.048, 0.085, tubeZ);
      gun.add(dial);
    }
  } else if (weapon.optic === 'reddot') {
    const mount = box(0.03, 0.02, 0.06, M.steelDark, 0, 0.06, -0.1);
    gun.add(mount);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 14), M.steelDark);
    ring.position.set(0, 0.082, -0.1);
    gun.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.006, 8), M.glowRed);
    dot.position.set(0, 0.082, -0.1);
    gun.add(dot);
  } else {
    const rear = box(0.03, 0.022, 0.02, M.steelDark, 0, 0.062, 0.02);
    gun.add(rear);
    const front = box(0.014, 0.026, 0.014, M.steelDark, 0, 0.06, -0.33 * scale);
    gun.add(front);
  }

  // Arms
  const armGroup = new THREE.Group();
  const buildHand = (x: number, y: number, z: number, side: number) => {
    const sleeve = capsule(0.042, 0.24, M.sleeve);
    sleeve.position.set(x + side * 0.055, y - 0.16, z + 0.12);
    sleeve.rotation.x = 0.8;
    sleeve.rotation.z = -side * 0.32;
    armGroup.add(sleeve);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), M.glove);
    glove.scale.set(0.9, 0.85, 1.25);
    glove.position.set(x, y, z);
    armGroup.add(glove);
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), M.glove);
    thumb.position.set(x - side * 0.03, y + 0.02, z - 0.02);
    armGroup.add(thumb);
  };
  buildHand(0.004, -0.085, 0.035, 1);
  buildHand(-0.002, -0.02, (sniper ? -0.46 : -0.24) * scale, -1);
  root.add(armGroup);

  // Muzzle flash
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshBasicMaterial({
      color: 0xffd08a,
      map: makeFlashTexture(),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  flash.visible = false;
  flash.position.set(0, 0.022, barrelZ - barrelLen - 0.02);
  gun.add(flash);
  flash.rotation.z = Math.random() * Math.PI;

  const flashLight = new THREE.PointLight(0xffb066, 0, 3.4, 2);
  flashLight.position.copy(flash.position);
  gun.add(flashLight);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.022, barrelZ - barrelLen - 0.06);
  gun.add(muzzle);

  const hipPos = sniper
    ? new THREE.Vector3(0.2, -0.23, -0.36)
    : new THREE.Vector3(0.17, -0.19, -0.32);
  const adsPos = sniper
    ? new THREE.Vector3(0, -0.088, -0.22)
    : new THREE.Vector3(0, -0.075, -0.24);
  const hipRot = new THREE.Euler(sniper ? -0.01 : -0.02, 0.06, 0.02);
  const adsRot = new THREE.Euler(0, 0, 0);

  root.position.copy(hipPos);
  root.rotation.copy(hipRot);

  return { root, muzzle, flash, flashLight, hipPos, adsPos, hipRot, adsRot };
}

function makeFlashTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.35, 'rgba(255,196,110,0.85)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
