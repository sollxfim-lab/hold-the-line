import * as THREE from 'three';
import type { ClassSkillKind, ClassTechniqueKind } from '../data/classes';
import type { Coat } from '../data/cosmetics';
import type { Weapon } from '../data/weapons';

/* ------------------------------------------------------------------ */
/* Tailored third-person operator rig                                  */
/* ------------------------------------------------------------------ */

type Mat = THREE.MeshStandardMaterial;

function material(
  color: number,
  roughness: number,
  metalness = 0,
  emissive = 0x000000,
  emissiveIntensity = 0,
): Mat {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
  });
}

function mesh(
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function capsule(radius: number, length: number, mat: THREE.Material) {
  return mesh(new THREE.CapsuleGeometry(radius, length, 6, 14), mat);
}

function cylinder(
  top: number,
  bottom: number,
  height: number,
  mat: THREE.Material,
  segments = 16,
) {
  return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), mat);
}

function sphere(radius: number, mat: THREE.Material, segments = 16) {
  return mesh(new THREE.SphereGeometry(radius, segments, Math.max(8, segments / 2)), mat);
}

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}

function ownMaterials(root: THREE.Object3D) {
  root.traverse((child) => {
    const m = child as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const clones = mats.map((old) => {
      const next = old.clone();
      next.userData.owned = true;
      return next;
    });
    m.material = Array.isArray(m.material) ? clones : clones[0];
  });
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((child) => {
    const m = child as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (mat && mat.userData.owned) mat.dispose();
    }
  });
}

/** Cloth panels use a gently curved plane rather than a flat board. */
function clothPanel(
  width: number,
  height: number,
  mat: THREE.Material,
  baseRotX = 0,
  baseRotY = 0,
  baseRotZ = 0,
) {
  const geometry = new THREE.PlaneGeometry(width, height, 5, 12);
  const attr = geometry.getAttribute('position');
  for (let i = 0; i < attr.count; i++) {
    const x = attr.getX(i);
    const y = attr.getY(i);
    const edge = Math.abs(x) / (width * 0.5);
    const z = Math.sin((y / height + 0.5) * Math.PI * 1.25) * 0.035 + edge * edge * 0.026;
    attr.setZ(i, z);
  }
  geometry.computeVertexNormals();
  const m = new THREE.Mesh(geometry, mat);
  m.position.y = -height / 2;
  m.castShadow = true;
  m.receiveShadow = true;
  const group = new THREE.Group();
  group.position.set(0, 0, 0);
  group.rotation.set(baseRotX, baseRotY, baseRotZ);
  group.userData.baseRotX = baseRotX;
  group.userData.baseRotY = baseRotY;
  group.userData.baseRotZ = baseRotZ;
  group.add(m);

  /* A narrow trim along the hem makes the coat read as tailored rather than
     a flat silhouette. */
  const trim = box(width + 0.006, 0.018, 0.014, mat, 0, -height + 0.008, 0.018);
  trim.material = mat;
  group.add(trim);
  return group;
}

export interface FingerRig {
  base: THREE.Group;
  mid: THREE.Group;
  /** Resting side-spread so the fingers do not read as a flat paddle. */
  splay: number;
  /** 0 = trigger/index finger, 1..3 = middle, ring, little. */
  slot: number;
}

export interface HandRig {
  wrist: THREE.Group;
  fingers: FingerRig[];
  thumbBase: THREE.Group;
  thumbMid: THREE.Group;
  curl: number;
}

export interface PlayerModel {
  group: THREE.Group;
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  footL: THREE.Group;
  footR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  handL: HandRig;
  handR: HandRig;
  coatPanels: THREE.Group[];
  weaponRoot: THREE.Group;
  weapon: THREE.Group | null;
  weaponKind: string;
  muzzle: THREE.Object3D | null;
  aim: number;
  walk: number;
  breath: number;
  cast: number;
  /** Smoothed grip strength (0 open hand, 1 locked fist). */
  grip: number;
}

export function createPlayerModel(coat: Coat, classColor: string): PlayerModel {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const glow = new THREE.Color(classColor).getHex();
  const cloth = material(coat.color, 0.9);
  const lining = material(coat.lining, 0.94);
  const trim = material(coat.accent, 0.46, 0.55);
  const under = material(0x22251f, 0.92);
  const underLight = material(0x34372e, 0.88);
  const leather = material(0x30261c, 0.78, 0.05);
  const leatherDark = material(0x1d1a16, 0.84);
  const steel = material(0x6d7169, 0.32, 0.82);
  const steelDark = material(0x2c302c, 0.42, 0.72);
  const brass = material(0xb38f55, 0.36, 0.82);
  const skin = material(0xb08a68, 0.82);
  const skinShade = material(0x89694f, 0.86);
  const hair = material(0x24211c, 0.88);
  const mask = material(0x1b1e1a, 0.92);
  const glove = material(0x252721, 0.86);
  const lens = material(0x15181a, 0.2, 0.5, glow, 0.9);

  /* ---- legs ---- */
  const buildLeg = (side: number, worldX: number) => {
    const leg = new THREE.Group();
    leg.position.set(worldX, 0.98, 0);
    const thigh = capsule(0.108, 0.28, under);
    thigh.position.y = -0.19;
    leg.add(thigh);

    const thighPlate = capsule(0.116, 0.1, leatherDark);
    thighPlate.position.set(0, -0.22, -0.035);
    thighPlate.scale.set(1, 0.8, 0.8);
    leg.add(thighPlate);

    if (side < 0) {
      const holster = box(0.13, 0.27, 0.09, leather, -0.105, -0.25, 0.015);
      holster.rotation.z = 0.08;
      leg.add(holster);
      const strap = box(0.14, 0.025, 0.095, leatherDark, -0.105, -0.17, 0.02);
      leg.add(strap);
    }

    const knee = new THREE.Group();
    knee.position.y = -0.43;
    leg.add(knee);
    const shin = capsule(0.085, 0.32, under);
    shin.position.y = -0.2;
    knee.add(shin);

    const kneecap = sphere(0.1, steel);
    kneecap.scale.set(1, 0.82, 0.72);
    kneecap.position.set(0, 0.02, -0.075);
    knee.add(kneecap);

    const boot = new THREE.Group();
    boot.position.set(0, -0.45, -0.035);
    const bootBody = capsule(0.09, 0.16, leatherDark);
    bootBody.rotation.x = Math.PI / 2;
    bootBody.position.set(0, 0, -0.02);
    boot.add(bootBody);
    const toe = sphere(0.1, leatherDark);
    toe.scale.set(0.9, 0.55, 1.25);
    toe.position.set(0, -0.045, -0.18);
    boot.add(toe);
    const sole = box(0.18, 0.035, 0.34, material(0x131411, 0.96), 0, -0.09, -0.055);
    boot.add(sole);
    const shinGuard = box(0.13, 0.2, 0.07, steelDark, 0, -0.18, -0.08);
    boot.add(shinGuard);
    knee.add(boot);

    body.add(leg);
    return { leg, knee, foot: boot };
  };

  const left = buildLeg(-1, -0.155);
  const right = buildLeg(1, 0.155);

  /* ---- torso and coat ---- */
  const torso = new THREE.Group();
  torso.position.y = 0.98;
  body.add(torso);

  const waist = cylinder(0.24, 0.215, 0.22, under, 18);
  waist.position.y = 0.07;
  torso.add(waist);
  const belt = cylinder(0.25, 0.25, 0.065, leather, 20);
  belt.position.y = 0.14;
  torso.add(belt);
  const buckle = box(0.075, 0.06, 0.025, brass, 0, 0.14, -0.24);
  torso.add(buckle);

  const chest = capsule(0.25, 0.32, cloth);
  chest.position.y = 0.39;
  chest.scale.set(1.02, 1, 0.68);
  torso.add(chest);

  const underVest = capsule(0.224, 0.36, under);
  underVest.position.y = 0.38;
  underVest.scale.set(0.96, 0.95, 0.66);
  torso.add(underVest);

  /* Armour plate is a softer capsule shell, not a stack of cubes. */
  const plate = capsule(0.235, 0.27, steelDark);
  plate.position.set(0, 0.42, -0.075);
  plate.scale.set(1.02, 0.82, 0.5);
  torso.add(plate);
  const plateFace = capsule(0.16, 0.16, underLight);
  plateFace.position.set(0, 0.43, -0.175);
  plateFace.scale.set(1.18, 0.8, 0.24);
  torso.add(plateFace);

  const chestLamp = sphere(0.034, material(0x2a1b14, 0.3, 0.3, glow, 1.5), 12);
  chestLamp.position.set(0.13, 0.45, -0.23);
  torso.add(chestLamp);

  const harness = new THREE.Group();
  for (const side of [-1, 1]) {
    const strap = box(0.045, 0.42, 0.035, leather, side * 0.16, 0.4, -0.175);
    strap.rotation.z = side * 0.17;
    harness.add(strap);
  }
  torso.add(harness);
  const magPouch = box(0.12, 0.12, 0.075, leather, -0.16, 0.33, -0.18);
  magPouch.rotation.z = -0.05;
  torso.add(magPouch);
  const magPouch2 = box(0.12, 0.12, 0.075, leather, 0.16, 0.33, -0.18);
  magPouch2.rotation.z = 0.05;
  torso.add(magPouch2);
  const radio = box(0.08, 0.14, 0.06, steelDark, -0.245, 0.45, -0.05);
  radio.rotation.z = -0.08;
  torso.add(radio);
  const antenna = cylinder(0.007, 0.007, 0.22, steelDark, 6);
  antenna.position.set(-0.265, 0.62, -0.05);
  antenna.rotation.z = -0.12;
  torso.add(antenna);

  /* Mantle over the shoulders gives the character a strong silhouette. */
  const mantle = new THREE.Group();
  const mantleShell = sphere(0.33, cloth, 20);
  mantleShell.scale.set(1.02, 0.38, 0.72);
  mantleShell.position.set(0, 0.58, 0.02);
  mantle.add(mantleShell);
  const mantleRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.018, 6, 28, Math.PI * 1.7),
    trim,
  );
  mantleRim.rotation.x = Math.PI / 2;
  mantleRim.rotation.z = Math.PI * 0.15;
  mantleRim.position.y = 0.61;
  mantle.add(mantleRim);
  torso.add(mantle);

  if (coat.id === 'crimson') {
    for (const side of [-1, 1]) {
      const epaulette = sphere(0.13, trim, 16);
      epaulette.scale.set(1.25, 0.4, 0.8);
      epaulette.position.set(side * 0.31, 0.59, 0);
      torso.add(epaulette);
    }
  }

  /* Split trench-coat tails: two curved back panels and two side wings. */
  const coatPanels: THREE.Group[] = [];
  const backL = clothPanel(0.26, 0.86, cloth, 0.03, -0.1, -0.025);
  backL.position.set(-0.115, 0.11, 0.18);
  torso.add(backL);
  coatPanels.push(backL);
  const backR = clothPanel(0.26, 0.86, cloth, 0.03, 0.1, 0.025);
  backR.position.set(0.115, 0.11, 0.18);
  torso.add(backR);
  coatPanels.push(backR);
  const sideL = clothPanel(0.21, 0.7, lining, 0.02, -0.82, -0.16);
  sideL.position.set(-0.235, 0.12, 0.02);
  torso.add(sideL);
  coatPanels.push(sideL);
  const sideR = clothPanel(0.21, 0.7, lining, 0.02, 0.82, 0.16);
  sideR.position.set(0.235, 0.12, 0.02);
  torso.add(sideR);
  coatPanels.push(sideR);

  /* Collar and lapels. */
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.03, 6, 20, Math.PI * 1.35),
    cloth,
  );
  collar.rotation.x = Math.PI / 2;
  collar.rotation.z = Math.PI * 0.18;
  collar.position.set(0, 0.63, 0.02);
  torso.add(collar);
  for (const side of [-1, 1]) {
    const lapel = clothPanel(0.12, 0.28, lining, -0.25, side * 0.45, side * 0.22);
    lapel.position.set(side * 0.12, 0.64, -0.16);
    torso.add(lapel);
  }

  /* ---- head ---- */
  const head = new THREE.Group();
  head.position.y = 0.78;
  torso.add(head);

  const neck = cylinder(0.065, 0.075, 0.11, skinShade, 12);
  neck.position.y = -0.09;
  head.add(neck);
  const skull = sphere(0.148, skin, 20);
  skull.scale.set(0.93, 1.06, 0.95);
  head.add(skull);
  const jaw = sphere(0.118, skinShade, 16);
  jaw.scale.set(0.86, 0.64, 0.82);
  jaw.position.set(0, -0.075, -0.02);
  head.add(jaw);
  const hairCap = mesh(
    new THREE.SphereGeometry(0.156, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    hair,
  );
  hairCap.position.y = 0.035;
  hairCap.scale.set(0.96, 1, 0.98);
  head.add(hairCap);
  const fringe = sphere(0.13, hair, 14);
  fringe.scale.set(0.98, 0.34, 0.9);
  fringe.position.set(0, 0.105, 0.01);
  head.add(fringe);

  const faceMask = mesh(
    new THREE.SphereGeometry(0.15, 18, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.44),
    mask,
  );
  faceMask.scale.set(0.93, 1.02, 0.96);
  faceMask.position.set(0, -0.016, -0.002);
  head.add(faceMask);

  const browBand = box(0.235, 0.032, 0.03, leatherDark, 0, 0.028, -0.127);
  head.add(browBand);
  for (const side of [-1, 1]) {
    const eye = sphere(0.012, lens, 8);
    eye.scale.set(1.25, 0.85, 0.45);
    eye.position.set(side * 0.052, 0.025, -0.142);
    head.add(eye);
    const brow = box(0.052, 0.012, 0.012, hair, side * 0.052, 0.058, -0.132);
    brow.rotation.z = side * 0.14;
    head.add(brow);
    const ear = cylinder(0.027, 0.027, 0.018, skinShade, 10);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(side * 0.142, 0.012, 0);
    head.add(ear);
    const earDisc = cylinder(0.033, 0.033, 0.012, steelDark, 10);
    earDisc.rotation.z = Math.PI / 2;
    earDisc.position.set(side * 0.152, 0.012, 0);
    head.add(earDisc);
  }
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.135, 0.035, 6, 18, Math.PI * 1.65),
    lining,
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.rotation.z = Math.PI * 0.2;
  scarf.position.set(0, -0.125, 0.01);
  head.add(scarf);
  const scarfTail = clothPanel(0.12, 0.38, lining, 0.38, 0.1, 0.15);
  scarfTail.position.set(0.1, -0.12, 0.1);
  head.add(scarfTail);

  /* ---- arms ---- */
  const buildArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.345, 0.5, 0);
    const shoulder = sphere(0.135, cloth, 16);
    shoulder.scale.set(1.1, 0.95, 0.92);
    arm.add(shoulder);
    const pauldron = sphere(0.155, steelDark, 16);
    pauldron.scale.set(1.1, 0.55, 0.9);
    pauldron.position.set(side * 0.02, 0.055, -0.015);
    arm.add(pauldron);
    const upper = capsule(0.088, 0.24, cloth);
    upper.position.y = -0.16;
    arm.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.31;
    arm.add(elbow);
    const joint = sphere(0.083, underLight, 12);
    joint.scale.set(1, 0.85, 1);
    elbow.add(joint);
    const forearm = capsule(0.075, 0.23, under);
    forearm.position.y = -0.17;
    elbow.add(forearm);
    const bracer = cylinder(0.088, 0.078, 0.17, leatherDark, 12);
    bracer.position.y = -0.19;
    elbow.add(bracer);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.012, 5, 12), trim);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.28;
    elbow.add(cuff);
    const hand = new THREE.Group();
    hand.position.y = -0.33;
    elbow.add(hand);

    /* Palm block, tapered so the wrist reads narrower than the knuckles. */
    const palm = sphere(0.072, glove, 14);
    palm.scale.set(0.86, 0.72, 1.16);
    palm.position.z = -0.004;
    hand.add(palm);
    const heel = sphere(0.058, glove, 12);
    heel.scale.set(0.86, 0.66, 1.1);
    heel.position.set(0, 0.035, 0.008);
    hand.add(heel);
    const knuckleBar = box(0.115, 0.028, 0.07, leatherDark, 0, -0.042, -0.012);
    knuckleBar.rotation.x = 0.06;
    hand.add(knuckleBar);

    /* Four articulated fingers: proximal + distal phalanx, gloved pads and a
       steel knuckle cap. They close around grips and open for cast poses. */
    const fingers: FingerRig[] = [];
    const spreads = [0.046, 0.016, -0.014, -0.042];
    const lengths = [0.032, 0.036, 0.033, 0.026];
    const zs = [-0.024, -0.006, 0.012, 0.028];
    for (let i = 0; i < 4; i++) {
      const base = new THREE.Group();
      base.position.set(spreads[i], -0.052, zs[i]);
      base.rotation.z = side * 0.04 - spreads[i] * 0.18;
      hand.add(base);
      const proxLen = lengths[i];
      const prox = capsule(0.0125, proxLen, glove);
      prox.position.y = -proxLen * 0.5;
      base.add(prox);
      const knuckle = sphere(0.0155, leatherDark, 8);
      knuckle.scale.set(1, 0.72, 1);
      knuckle.position.y = -0.004;
      base.add(knuckle);
      const mid = new THREE.Group();
      mid.position.y = -proxLen - 0.006;
      base.add(mid);
      const dist = capsule(0.0105, proxLen * 0.78, glove);
      dist.position.y = -proxLen * 0.4;
      mid.add(dist);
      const pad = sphere(0.0115, leatherDark, 8);
      pad.scale.set(1.15, 0.75, 1.05);
      pad.position.y = -proxLen * 0.78;
      mid.add(pad);
      fingers.push({ base, mid, splay: side * 0.4 + (i - 1.5) * 0.16, slot: i });
    }

    /* Opposing thumb: two phalanges angled across the palm. */
    const thumbBase = new THREE.Group();
    thumbBase.position.set(-side * 0.052, -0.012, -0.014);
    thumbBase.rotation.z = side * -0.92;
    thumbBase.rotation.x = -0.28;
    hand.add(thumbBase);
    const thumbProx = capsule(0.0145, 0.036, glove);
    thumbProx.position.y = -0.02;
    thumbBase.add(thumbProx);
    const thumbKnuckle = sphere(0.016, leatherDark, 8);
    thumbKnuckle.position.y = -0.002;
    thumbBase.add(thumbKnuckle);
    const thumbMid = new THREE.Group();
    thumbMid.position.y = -0.041;
    thumbMid.rotation.z = side * 0.22;
    thumbBase.add(thumbMid);
    const thumbDist = capsule(0.012, 0.03, glove);
    thumbDist.position.y = -0.015;
    thumbMid.add(thumbDist);
    const thumbPad = sphere(0.0125, leatherDark, 8);
    thumbPad.scale.set(1.2, 0.8, 1);
    thumbPad.position.y = -0.032;
    thumbMid.add(thumbPad);

    torso.add(arm);
    const rig: HandRig = { wrist: hand, fingers, thumbBase, thumbMid, curl: 0 };
    return { arm, elbow, hand: rig };
  };
  const armLeft = buildArm(-1);
  const armRight = buildArm(1);

  const weaponRoot = new THREE.Group();
  weaponRoot.position.set(0.18, 0.3, -0.38);
  torso.add(weaponRoot);

  ownMaterials(group);

  const model: PlayerModel = {
    group,
    body,
    torso,
    head,
    legL: left.leg,
    legR: right.leg,
    kneeL: left.knee,
    kneeR: right.knee,
    footL: left.foot,
    footR: right.foot,
    armL: armLeft.arm,
    armR: armRight.arm,
    elbowL: armLeft.elbow,
    elbowR: armRight.elbow,
    handL: armLeft.hand,
    handR: armRight.hand,
    coatPanels,
    weaponRoot,
    weapon: null,
    weaponKind: 'rifle',
    muzzle: null,
    aim: 0,
    walk: 0,
    breath: 0,
    cast: 0,
    grip: 0.5,
  };
  return model;
}

/* ------------------------------------------------------------------ */
/* Held weapon models                                                  */
/* ------------------------------------------------------------------ */

export interface HeldWeapon {
  group: THREE.Group;
  muzzle: THREE.Object3D;
}

function createSword(weapon: Weapon): HeldWeapon {
  const group = new THREE.Group();
  const mythic = weapon.rarity === 'mythic';
  const scale = mythic ? 1.18 : 1;

  const bladeMat = material(
    mythic ? 0xd9d6ef : 0xc8ced4,
    0.16,
    0.96,
    weapon.color,
    mythic ? 0.28 : 0.06,
  );
  const edgeMat = material(0xe9f0ff, 0.1, 0.9, weapon.color, mythic ? 1.9 : 0.7);
  const darkSteel = material(0x232529, 0.42, 0.72);
  const gold = material(mythic ? 0xdfbc70 : 0x9d7847, 0.32, 0.85);
  const wrap = material(0x1b1918, 0.94);
  const wrapAccent = material(mythic ? 0x4a3358 : 0x4a2b24, 0.86);
  const hamonMat = new THREE.MeshBasicMaterial({
    color: mythic ? 0xe0d0ff : 0xe8f1ff,
    transparent: true,
    opacity: mythic ? 0.9 : 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  /* Curved katana profile. The cutting edge (right) sweeps out while the
     spine stays narrow, which reads as a forged blade rather than a plank. */
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.05, 0.055);
  bladeShape.lineTo(0.056, 0.055);
  bladeShape.quadraticCurveTo(0.07, 0.32, 0.076, 0.6);
  bladeShape.quadraticCurveTo(0.072, 0.82, 0.038, 0.97);
  bladeShape.quadraticCurveTo(0.024, 1.02, 0.01, 1.07);
  bladeShape.quadraticCurveTo(-0.008, 0.94, -0.028, 0.74);
  bladeShape.quadraticCurveTo(-0.05, 0.42, -0.05, 0.055);
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: 0.005,
    bevelSegments: 3,
    curveSegments: 8,
  });
  bladeGeo.translate(0, 0, -0.013);
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.castShadow = true;
  blade.receiveShadow = true;
  blade.scale.setScalar(scale);
  group.add(blade);

  /* Spine ridge and narrow fuller follow the curve. */
  const spineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.026, 0.08, 0),
    new THREE.Vector3(-0.038, 0.3, 0),
    new THREE.Vector3(-0.036, 0.52, 0),
    new THREE.Vector3(-0.022, 0.74, 0),
    new THREE.Vector3(0.004, 0.94, 0),
  ]);
  const spine = new THREE.Mesh(new THREE.TubeGeometry(spineCurve, 20, 0.009, 6, false), darkSteel);
  spine.scale.setScalar(scale);
  group.add(spine);
  const fullerCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.006, 0.1, 0),
    new THREE.Vector3(-0.012, 0.34, 0),
    new THREE.Vector3(-0.006, 0.56, 0),
    new THREE.Vector3(0.01, 0.78, 0),
  ]);
  const fuller = new THREE.Mesh(new THREE.TubeGeometry(fullerCurve, 18, 0.0085, 6, false), darkSteel);
  fuller.scale.setScalar(scale);
  group.add(fuller);

  /* Glowing hamon runs just inside the cutting edge. */
  const hamonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.036, 0.12, 0),
    new THREE.Vector3(0.05, 0.34, 0),
    new THREE.Vector3(0.052, 0.56, 0),
    new THREE.Vector3(0.034, 0.79, 0),
    new THREE.Vector3(0.012, 0.98, 0),
  ]);
  const hamon = new THREE.Mesh(new THREE.TubeGeometry(hamonCurve, 26, 0.0055, 6, false), hamonMat);
  hamon.scale.setScalar(scale);
  group.add(hamon);
  const edgeLine = new THREE.Mesh(new THREE.TubeGeometry(hamonCurve, 26, 0.0024, 4, false), edgeMat);
  edgeLine.position.x = 0.012;
  edgeLine.scale.setScalar(scale);
  group.add(edgeLine);

  if (mythic) {
    const runeMat = material(0xffffff, 0.2, 0.3, weapon.color, 2.2);
    for (let i = 0; i < 4; i++) {
      const rune = box(0.005, 0.04, 0.03, runeMat, -0.02, 0.3 + i * 0.12, 0);
      rune.rotation.z = -0.36 - i * 0.03;
      group.add(rune);
    }
  }

  /* Habaki collar seats the blade in the guard. */
  const habaki = box(0.075, 0.06, 0.04, gold, 0, 0.072, 0);
  habaki.rotation.z = 0.02;
  group.add(habaki);
  const habakiLine = box(0.082, 0.008, 0.043, darkSteel, 0, 0.052, 0);
  group.add(habakiLine);

  const tsuba = cylinder(0.088, 0.088, 0.022, gold, 22);
  tsuba.position.y = 0.02;
  group.add(tsuba);
  const tsubaRim = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.008, 5, 22), gold);
  tsubaRim.rotation.x = Math.PI / 2;
  tsubaRim.position.y = 0.034;
  group.add(tsubaRim);
  for (const side of [-1, 1]) {
    const horn = box(0.03, 0.018, 0.026, gold, side * 0.082, 0.02, 0);
    horn.rotation.z = side * 0.35;
    group.add(horn);
  }

  const grip = cylinder(0.021, 0.026, 0.25, wrap, 12);
  grip.position.y = -0.12;
  group.add(grip);
  for (let i = 0; i < 8; i++) {
    const diamond = box(0.036, 0.03, 0.03, i % 2 === 0 ? wrapAccent : wrap, 0, -0.018 - i * 0.03, 0);
    diamond.rotation.y = Math.PI / 4;
    group.add(diamond);
  }
  const mekugi = cylinder(0.007, 0.007, 0.052, gold, 6);
  mekugi.rotation.z = Math.PI / 2;
  mekugi.position.set(0, -0.09, 0);
  group.add(mekugi);
  const pommel = sphere(0.036, gold, 14);
  pommel.scale.set(1, 0.7, 1);
  pommel.position.y = -0.255;
  group.add(pommel);
  const pommelCap = cylinder(0.036, 0.03, 0.018, darkSteel, 12);
  pommelCap.position.y = -0.275;
  group.add(pommelCap);

  ownMaterials(group);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 1.07 * scale, 0);
  group.add(muzzle);
  return { group, muzzle };
}

function createGun(weapon: Weapon): HeldWeapon {
  const group = new THREE.Group();
  const accent = material(weapon.color, 0.48, 0.45);
  const steel = material(0x2a2d27, 0.36, 0.74);
  const polymer = material(0x181a16, 0.82);
  const brass = material(0xba9550, 0.36, 0.8);
  const sniper = weapon.kind === 'sniper';
  const pistol = weapon.kind === 'pistol';
  const scale = pistol ? 0.86 : sniper ? 1.08 : 1;

  const receiver = box(0.065 * scale, 0.085 * scale, (sniper ? 0.44 : 0.34) * scale, steel, 0, 0, -0.06);
  group.add(receiver);
  const topRail = box(0.05 * scale, 0.016, 0.27 * scale, polymer, 0, 0.05, -0.08);
  group.add(topRail);
  const accentStrip = box(0.068 * scale, 0.017, 0.18 * scale, accent, 0, -0.022, -0.06);
  group.add(accentStrip);

  const barrelLen = pistol ? 0.1 : sniper ? 0.62 : 0.28;
  const barrel = cylinder(0.013, 0.013, barrelLen, steel, 10);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.018, -0.2 - barrelLen / 2);
  group.add(barrel);

  if (sniper) {
    const brake = box(0.042, 0.042, 0.09, steel, 0, 0.018, -0.2 - barrelLen - 0.005);
    group.add(brake);
    const bipod = new THREE.Group();
    for (const side of [-1, 1]) {
      const leg = cylinder(0.007, 0.007, 0.2, steel, 6);
      leg.position.set(side * 0.05, -0.1, -0.45);
      leg.rotation.z = side * 0.5;
      bipod.add(leg);
    }
    group.add(bipod);
  }

  if (!pistol) {
    const mag = box(0.045, 0.17, 0.08, polymer, 0, -0.12, -0.03);
    mag.rotation.x = -0.14;
    group.add(mag);
    const stock = box(0.055, 0.075, sniper ? 0.34 : 0.2, polymer, 0, -0.022, 0.22);
    group.add(stock);
    const pad = box(0.062, 0.1, 0.03, accent, 0, -0.022, 0.22 + (sniper ? 0.17 : 0.1));
    group.add(pad);
    const grip = box(0.045, 0.14, 0.065, polymer, 0, -0.1, 0.08);
    grip.rotation.x = 0.34;
    group.add(grip);
    const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 4, 10, Math.PI), steel);
    triggerGuard.rotation.y = Math.PI / 2;
    triggerGuard.position.set(0, -0.08, 0.01);
    group.add(triggerGuard);
  } else {
    const grip = box(0.045, 0.13, 0.055, polymer, 0, -0.09, 0.02);
    grip.rotation.x = 0.28;
    group.add(grip);
  }

  if (weapon.optic === 'scope') {
    const tubeLen = sniper ? 0.29 : 0.15;
    const tube = cylinder(0.045, 0.045, tubeLen, steel, 14);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.088, -0.15);
    group.add(tube);
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.036, 16),
      new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.55 }),
    );
    lens.position.set(0, 0.088, -0.15 - tubeLen / 2 - 0.001);
    group.add(lens);
    const dial = cylinder(0.018, 0.018, 0.032, brass, 10);
    dial.rotation.z = Math.PI / 2;
    dial.position.set(0.052, 0.088, -0.15);
    group.add(dial);
  } else {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 5, 12), steel);
    ring.position.set(0, 0.075, -0.13);
    group.add(ring);
    const post = box(0.012, 0.026, 0.012, steel, 0, 0.075, -0.22);
    group.add(post);
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.018, -0.2 - barrelLen - 0.03);
  group.add(muzzle);

  /* Sling loop and empty chamber detail. */
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 4, 10), brass);
  loop.rotation.y = Math.PI / 2;
  loop.position.set(0.045, -0.04, 0.17);
  group.add(loop);

  ownMaterials(group);
  return { group, muzzle };
}

export function createHeldWeapon(weapon: Weapon): HeldWeapon {
  return weapon.kind === 'sword' ? createSword(weapon) : createGun(weapon);
}

export function mountPlayerWeapon(model: PlayerModel, weapon: Weapon) {
  if (model.weapon) {
    model.weaponRoot.remove(model.weapon);
    disposeTree(model.weapon);
  }
  const held = createHeldWeapon(weapon);
  model.weapon = held.group;
  model.weaponKind = weapon.kind;
  model.muzzle = held.muzzle;
  model.weaponRoot.add(held.group);
}

/* ------------------------------------------------------------------ */
/* Animation                                                           */
/* ------------------------------------------------------------------ */

export interface PlayerAnimState {
  dt: number;
  time: number;
  speed: number;
  grounded: boolean;
  ads: boolean;
  reloading: boolean;
  recoil: number;
  meleeT: number;
  meleeDur: number;
  meleeCombo: number;
  castT: number;
  castDur: number;
  castKind: ClassSkillKind | null;
  techniqueT: number;
  techniqueDur: number;
  techniqueKind: ClassTechniqueKind | null;
  dodgeT: number;
  dodgeDur: number;
  dodgeSide: number;
  pitch: number;
}

function dampAngle(current: number, target: number, lambda: number, dt: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-lambda * dt));
}

function damp(target: THREE.Vector3, x: number, y: number, z: number, lambda: number, dt: number) {
  target.x = THREE.MathUtils.damp(target.x, x, lambda, dt);
  target.y = THREE.MathUtils.damp(target.y, y, lambda, dt);
  target.z = THREE.MathUtils.damp(target.z, z, lambda, dt);
}

function dampEuler(target: THREE.Euler, x: number, y: number, z: number, lambda: number, dt: number) {
  target.x = THREE.MathUtils.damp(target.x, x, lambda, dt);
  target.y = THREE.MathUtils.damp(target.y, y, lambda, dt);
  target.z = THREE.MathUtils.damp(target.z, z, lambda, dt);
}

/**
 * Animates every joint in the rig. This runs for both camera modes so the
 * operator is always simulation-correct when CapsLock swaps the view.
 */
export function animatePlayer(model: PlayerModel, s: PlayerAnimState) {
  const dt = Math.min(0.05, s.dt);
  const move = THREE.MathUtils.clamp(s.speed / 5.4, 0, 1.35);
  const aimTarget = s.ads ? 1 : 0;
  model.aim = THREE.MathUtils.damp(model.aim, aimTarget, 11, dt);
  model.breath += dt * 1.8;
  model.walk += dt * (2.4 + s.speed * 1.6);

  const walk = model.walk;
  const stride = Math.sin(walk);
  const strideAlt = Math.sin(walk + Math.PI);
  const air = !s.grounded;
  const moveBlend = THREE.MathUtils.clamp(move, 0, 1);
  const bodyBob = air ? 0.025 : Math.abs(Math.sin(walk * 2)) * 0.02 * moveBlend;
  model.body.position.y = THREE.MathUtils.damp(
    model.body.position.y,
    bodyBob + Math.sin(model.breath) * 0.004,
    12,
    dt,
  );

  const castP = s.castDur > 0 ? THREE.MathUtils.clamp(s.castT / s.castDur, 0, 1) : 0;
  const casting = s.castKind !== null && castP > 0 && castP < 1;
  const castPulse = casting ? Math.sin(castP * Math.PI) : 0;
  const techP = s.techniqueDur > 0 ? THREE.MathUtils.clamp(s.techniqueT / s.techniqueDur, 0, 1) : 0;
  const techActive = s.techniqueKind !== null && techP > 0 && techP < 1;
  const techPulse = techActive ? Math.sin(techP * Math.PI) : 0;
  const techWind = techActive ? Math.sin(Math.min(techP, 0.45) / 0.45 * Math.PI * 0.5) : 0;
  const techSlam = techActive ? Math.max(0, (techP - 0.42) / 0.58) : 0;
  const dodgeP = s.dodgeDur > 0 ? THREE.MathUtils.clamp(s.dodgeT / s.dodgeDur, 0, 1) : 0;
  const dodging = s.dodgeDur > 0 && dodgeP > 0 && dodgeP < 1;
  const dodgePulse = dodging ? Math.sin(dodgeP * Math.PI) : 0;
  const dodgeSide = dodging ? s.dodgeSide : 0;
  const meleeActive = s.meleeDur > 0 && s.meleeT < s.meleeDur;
  const meleeP = meleeActive ? THREE.MathUtils.clamp(s.meleeT / s.meleeDur, 0, 1) : 0;
  const meleeSwing = meleeActive ? Math.sin(meleeP * Math.PI) : 0;
  const combo = s.meleeCombo;
  const comboTwist = meleeActive
    ? (combo === 3 ? 0.12 : combo === 2 ? -0.28 : 0.28) * meleeSwing
    : 0;

  /* ---- torso ---- */
  const torsoLean =
    moveBlend * 0.11 +
    model.aim * 0.075 +
    (air ? 0.05 : 0) +
    (casting ? 0.08 * castPulse : 0) +
    (techActive ? (s.techniqueKind === 'quake' ? -0.3 * techWind + 0.26 * techSlam : 0.13 * techPulse) : 0) +
    (dodging ? 0.16 * dodgePulse : 0) +
    (meleeActive ? (combo === 3 ? 0.2 : 0.1) * meleeSwing : 0) -
    s.pitch * 0.16;
  const torsoTwist =
    Math.sin(walk) * 0.045 * moveBlend +
    comboTwist +
    (casting ? Math.sin(castP * Math.PI * 2) * 0.07 : 0) +
    (techActive
      ? s.techniqueKind === 'sanguine'
        ? Math.sin(techP * Math.PI * 3) * 0.38
        : s.techniqueKind === 'blinkstrike'
          ? -0.36 * techWind + 0.5 * techSlam
          : s.techniqueKind === 'carrion'
            ? -0.28 * techPulse
            : 0.1 * techPulse
      : 0);
  model.torso.rotation.x = THREE.MathUtils.damp(model.torso.rotation.x, torsoLean, 11, dt);
  model.torso.rotation.y = THREE.MathUtils.damp(model.torso.rotation.y, torsoTwist, 13, dt);
  model.torso.rotation.z = THREE.MathUtils.damp(
    model.torso.rotation.z,
    Math.sin(walk * 0.5) * 0.026 * moveBlend,
    10,
    dt,
  );

  /* ---- head ---- */
  const headLift =
    (casting ? -0.18 * castPulse : 0) +
    (meleeActive ? -0.06 * meleeSwing : 0) -
    model.aim * 0.03 -
    s.pitch * 0.26;
  model.head.rotation.x = THREE.MathUtils.damp(model.head.rotation.x, headLift, 9, dt);
  model.head.rotation.y = THREE.MathUtils.damp(
    model.head.rotation.y,
    -torsoTwist * 0.45 + Math.sin(walk * 0.5) * 0.025,
    8,
    dt,
  );

  /* ---- legs ---- */
  const legSwing = air ? 0.24 : stride * moveBlend * 0.68;
  const legSwingAlt = air ? -0.32 : strideAlt * moveBlend * 0.68;
  model.legL.rotation.x = THREE.MathUtils.damp(model.legL.rotation.x, legSwing + (casting ? 0.06 : 0), 16, dt);
  model.legR.rotation.x = THREE.MathUtils.damp(model.legR.rotation.x, legSwingAlt + (casting ? -0.04 : 0), 16, dt);
  model.legL.rotation.z = THREE.MathUtils.damp(model.legL.rotation.z, air ? 0.08 : 0.018, 10, dt);
  model.legR.rotation.z = THREE.MathUtils.damp(model.legR.rotation.z, air ? -0.08 : -0.018, 10, dt);
  const kneeL = Math.max(0, -stride) * 0.78 * moveBlend + (air ? 0.5 : 0);
  const kneeR = Math.max(0, -strideAlt) * 0.78 * moveBlend + (air ? 0.5 : 0);
  model.kneeL.rotation.x = THREE.MathUtils.damp(model.kneeL.rotation.x, -kneeL, 15, dt);
  model.kneeR.rotation.x = THREE.MathUtils.damp(model.kneeR.rotation.x, -kneeR, 15, dt);

  /* Ankles roll through the step: toe-off on the back foot, heel strike on
     the front foot. It is a small detail but it stops the boots skating. */
  const footL = air ? -0.3 : Math.max(0, strideAlt) * 0.34 * moveBlend - 0.04;
  const footR = air ? -0.3 : Math.max(0, stride) * 0.34 * moveBlend - 0.04;
  model.footL.rotation.x = THREE.MathUtils.damp(model.footL.rotation.x, footL, 15, dt);
  model.footR.rotation.x = THREE.MathUtils.damp(model.footR.rotation.x, footR, 15, dt);

  /* ---- arms ---- */
  const aim = model.aim;
  let armRX = 0.08 - stride * 0.18 * (1 - aim) * moveBlend;
  let armRZ = -0.12;
  let elbowRX = -0.48;
  let armLX = -0.06 + stride * 0.55 * (1 - aim) * moveBlend;
  let armLZ = 0.13;
  let elbowLX = -0.5;

  if (aim > 0.02) {
    armRX = THREE.MathUtils.lerp(armRX, 1.24, aim);
    armRZ = THREE.MathUtils.lerp(armRZ, -0.18, aim);
    elbowRX = THREE.MathUtils.lerp(elbowRX, -0.18, aim);
    armLX = THREE.MathUtils.lerp(armLX, 1.36, aim);
    armLZ = THREE.MathUtils.lerp(armLZ, 0.5, aim);
    elbowLX = THREE.MathUtils.lerp(elbowLX, -0.62, aim);
  }

  if (model.weaponKind === 'sword') {
    if (combo === 3) {
      armRX = THREE.MathUtils.damp(armRX, 2.45 - meleeP * 1.75, 16, dt);
      armRZ = THREE.MathUtils.damp(armRZ, -0.34 + meleeP * 0.1, 14, dt);
      elbowRX = THREE.MathUtils.damp(elbowRX, -1.15 + meleeP * 0.95, 16, dt);
      armLX = THREE.MathUtils.damp(armLX, 1.5 - meleeP * 1.0, 14, dt);
      armLZ = THREE.MathUtils.damp(armLZ, 0.42 - meleeP * 0.18, 14, dt);
      elbowLX = THREE.MathUtils.damp(elbowLX, -0.9 + meleeP * 0.3, 14, dt);
    } else {
      armRX = THREE.MathUtils.damp(armRX, 0.56 + meleeSwing * 1.1, 13, dt);
      armRZ = THREE.MathUtils.damp(armRZ, -0.26 - meleeSwing * 0.55, 13, dt);
      elbowRX = THREE.MathUtils.damp(elbowRX, -0.72 + meleeSwing * 0.45, 13, dt);
      armLX = THREE.MathUtils.damp(armLX, 0.28 - meleeSwing * 0.35, 11, dt);
      armLZ = THREE.MathUtils.damp(armLZ, 0.32, 11, dt);
      elbowLX = THREE.MathUtils.damp(elbowLX, -0.6, 11, dt);
    }
  }

  if (casting) {
    if (s.castKind === 'feast' || s.castKind === 'hellfire' || s.castKind === 'decree') {
      armRX = THREE.MathUtils.lerp(armRX, 0.42, castPulse);
      armRZ = THREE.MathUtils.lerp(armRZ, -0.95, castPulse);
      armLX = THREE.MathUtils.lerp(armLX, 0.42, castPulse);
      armLZ = THREE.MathUtils.lerp(armLZ, 0.95, castPulse);
      elbowRX = THREE.MathUtils.lerp(elbowRX, -0.2, castPulse);
      elbowLX = THREE.MathUtils.lerp(elbowLX, -0.2, castPulse);
    } else if (s.castKind === 'shadowstep') {
      armRX = THREE.MathUtils.lerp(armRX, 1.5, castPulse);
      armLX = THREE.MathUtils.lerp(armLX, 1.45, castPulse);
      armRZ = THREE.MathUtils.lerp(armRZ, -0.4, castPulse);
      armLZ = THREE.MathUtils.lerp(armLZ, 0.4, castPulse);
    } else {
      armRX = THREE.MathUtils.lerp(armRX, 0.3, castPulse);
      armRZ = THREE.MathUtils.lerp(armRZ, -1.18, castPulse);
      armLX = THREE.MathUtils.lerp(armLX, 0.3, castPulse);
      armLZ = THREE.MathUtils.lerp(armLZ, 1.18, castPulse);
      elbowRX = THREE.MathUtils.lerp(elbowRX, -0.12, castPulse);
      elbowLX = THREE.MathUtils.lerp(elbowLX, -0.12, castPulse);
    }
  }

  if (techActive) {
    const w = techWind;
    const k = techSlam;
    switch (s.techniqueKind) {
      case 'breach':
        armRX = THREE.MathUtils.lerp(armRX, 1.5 - k * 0.35, techPulse);
        armRZ = THREE.MathUtils.lerp(armRZ, -0.2, techPulse);
        elbowRX = THREE.MathUtils.lerp(elbowRX, -0.24, techPulse);
        armLX = THREE.MathUtils.lerp(armLX, 0.86, techPulse);
        armLZ = THREE.MathUtils.lerp(armLZ, 0.62, techPulse);
        elbowLX = THREE.MathUtils.lerp(elbowLX, -0.72, techPulse);
        break;
      case 'carrion':
        armRX = THREE.MathUtils.lerp(armRX, -0.62 + w * 0.4, techPulse);
        armRZ = THREE.MathUtils.lerp(armRZ, 0.55, techPulse);
        elbowRX = THREE.MathUtils.lerp(elbowRX, -1.15, techPulse);
        armLX = THREE.MathUtils.lerp(armLX, 1.2, techPulse);
        armLZ = THREE.MathUtils.lerp(armLZ, 0.24, techPulse);
        elbowLX = THREE.MathUtils.lerp(elbowLX, -0.5, techPulse);
        break;
      case 'sanguine':
        armRX = THREE.MathUtils.lerp(armRX, 1.34, techPulse);
        armRZ = THREE.MathUtils.lerp(armRZ, 1.02, techPulse);
        elbowRX = THREE.MathUtils.lerp(elbowRX, -0.22, techPulse);
        armLX = THREE.MathUtils.lerp(armLX, 1.34, techPulse);
        armLZ = THREE.MathUtils.lerp(armLZ, -1.02, techPulse);
        elbowLX = THREE.MathUtils.lerp(elbowLX, -0.22, techPulse);
        break;
      case 'quake':
        armRX = THREE.MathUtils.lerp(armRX, 2.9 - k * 2.5, Math.max(w, k));
        armRZ = THREE.MathUtils.lerp(armRZ, -0.34, w);
        elbowRX = THREE.MathUtils.lerp(elbowRX, -0.5 + k * 0.4, w);
        armLX = THREE.MathUtils.lerp(armLX, 2.9 - k * 2.5, Math.max(w, k));
        armLZ = THREE.MathUtils.lerp(armLZ, 0.34, w);
        elbowLX = THREE.MathUtils.lerp(elbowLX, -0.5 + k * 0.4, w);
        break;
      case 'aegis':
        armRX = THREE.MathUtils.lerp(armRX, 0.94, techPulse);
        armRZ = THREE.MathUtils.lerp(armRZ, -0.52 - w * 0.55, techPulse);
        elbowRX = THREE.MathUtils.lerp(elbowRX, -0.66 + w * 0.3, techPulse);
        armLX = THREE.MathUtils.lerp(armLX, 0.94, techPulse);
        armLZ = THREE.MathUtils.lerp(armLZ, 0.52 + w * 0.55, techPulse);
        elbowLX = THREE.MathUtils.lerp(elbowLX, -0.66 + w * 0.3, techPulse);
        break;
      case 'inferno':
        armRX = THREE.MathUtils.lerp(armRX, 1.52, techPulse);
        armRZ = THREE.MathUtils.lerp(armRZ, -0.12, techPulse);
        elbowRX = THREE.MathUtils.lerp(elbowRX, -0.18, techPulse);
        armLX = THREE.MathUtils.lerp(armLX, 0.72, techPulse);
        armLZ = THREE.MathUtils.lerp(armLZ, 0.9, techPulse);
        elbowLX = THREE.MathUtils.lerp(elbowLX, -1.25, techPulse);
        break;
      case 'blinkstrike':
        armRX = THREE.MathUtils.lerp(armRX, -0.72 + k * 2.3, 1);
        armRZ = THREE.MathUtils.lerp(armRZ, -0.86 + k * 0.66, 1);
        elbowRX = THREE.MathUtils.lerp(elbowRX, -1.5 + k * 1.3, 1);
        armLX = THREE.MathUtils.lerp(armLX, 0.55, techPulse);
        armLZ = THREE.MathUtils.lerp(armLZ, 0.66, techPulse);
        elbowLX = THREE.MathUtils.lerp(elbowLX, -0.9, techPulse);
        break;
      case 'banner':
        armRX = THREE.MathUtils.lerp(armRX, 2.86, techPulse);
        armRZ = THREE.MathUtils.lerp(armRZ, -0.42, techPulse);
        elbowRX = THREE.MathUtils.lerp(elbowRX, -0.34, techPulse);
        armLX = THREE.MathUtils.lerp(armLX, 0.52, techPulse);
        armLZ = THREE.MathUtils.lerp(armLZ, 0.88, techPulse);
        elbowLX = THREE.MathUtils.lerp(elbowLX, -1.15, techPulse);
        break;
      default:
        break;
    }
  }

  model.armR.rotation.x = THREE.MathUtils.damp(model.armR.rotation.x, armRX, 14, dt);
  model.armR.rotation.z = THREE.MathUtils.damp(model.armR.rotation.z, armRZ, 14, dt);
  model.elbowR.rotation.x = THREE.MathUtils.damp(model.elbowR.rotation.x, elbowRX, 14, dt);
  model.armL.rotation.x = THREE.MathUtils.damp(model.armL.rotation.x, armLX, 14, dt);
  model.armL.rotation.z = THREE.MathUtils.damp(model.armL.rotation.z, armLZ, 14, dt);
  model.elbowL.rotation.x = THREE.MathUtils.damp(model.elbowL.rotation.x, elbowLX, 14, dt);

  /* ---- hands ---- */
  const swordGrip = model.weaponKind === 'sword';
  let rightGrip = swordGrip ? 0.94 : 0.88;
  let leftGrip = swordGrip ? 0.24 : 0.34;
  let openness = 0;
  if (model.aim > 0.05 && !swordGrip) leftGrip = THREE.MathUtils.lerp(leftGrip, 0.66, model.aim);
  if (s.reloading) leftGrip = 0.82;
  if (meleeActive) rightGrip = 1;
  if (casting) {
    openness = castPulse * (s.castKind === 'shadowstep' ? 0.15 : 0.92);
    rightGrip -= openness;
    leftGrip -= openness;
  }
  if (techActive) {
    const closed =
      s.techniqueKind === 'quake' ||
      s.techniqueKind === 'breach' ||
      s.techniqueKind === 'banner' ||
      s.techniqueKind === 'blinkstrike';
    const t = closed ? techPulse : techPulse * 0.95;
    rightGrip = THREE.MathUtils.lerp(rightGrip, closed ? 1 : 0.08, t);
    leftGrip = THREE.MathUtils.lerp(leftGrip, closed ? 1 : 0.06, t);
    openness = Math.max(openness, closed ? 0 : t);
  }
  if (dodging) {
    rightGrip = THREE.MathUtils.lerp(rightGrip, 0.98, dodgePulse);
    leftGrip = THREE.MathUtils.lerp(leftGrip, 0.9, dodgePulse);
  }
  model.grip = THREE.MathUtils.damp(model.grip, rightGrip, 12, dt);

  const indexRelax = swordGrip ? 1 : 0.34;
  const poseHand = (rig: HandRig, grip: number, triggerRelax: number) => {
    rig.curl = THREE.MathUtils.damp(rig.curl, THREE.MathUtils.clamp(grip, 0, 1.2), 13, dt);
    const c = rig.curl;
    for (const finger of rig.fingers) {
      const relax = finger.slot === 0 ? triggerRelax : 1;
      const baseTarget = 0.05 + c * 1.16 * relax + (finger.slot === 0 ? s.recoil * 0.18 : 0);
      const midTarget = 0.05 + c * 1.05 * relax;
      finger.base.rotation.x = THREE.MathUtils.damp(finger.base.rotation.x, baseTarget, 20, dt);
      finger.mid.rotation.x = THREE.MathUtils.damp(finger.mid.rotation.x, midTarget, 22, dt);
      finger.base.rotation.y = THREE.MathUtils.damp(
        finger.base.rotation.y,
        Math.sin(walk * 0.9 + finger.slot * 1.3) * 0.012 * moveBlend,
        9,
        dt,
      );
    }
    rig.thumbBase.rotation.x = THREE.MathUtils.damp(
      rig.thumbBase.rotation.x,
      -0.26 + c * 0.5,
      15,
      dt,
    );
    rig.thumbMid.rotation.x = THREE.MathUtils.damp(rig.thumbMid.rotation.x, c * 0.72, 17, dt);
    rig.wrist.rotation.x = THREE.MathUtils.damp(
      rig.wrist.rotation.x,
      (swordGrip ? -0.06 : 0.03) - openness * 0.5 + c * -0.08,
      12,
      dt,
    );
    rig.wrist.rotation.z = THREE.MathUtils.damp(
      rig.wrist.rotation.z,
      swordGrip ? -0.12 : -0.03,
      10,
      dt,
    );
  };
  poseHand(model.handR, rightGrip, indexRelax);
  poseHand(model.handL, leftGrip, 0.72);

  /* ---- coat ---- */
  const wind = 0.9 + moveBlend * 0.8;
  const coatLift = (air ? 0.24 : 0) + moveBlend * 0.16;
  for (let i = 0; i < model.coatPanels.length; i++) {
    const panel = model.coatPanels[i];
    const side = i < 2 ? (i === 0 ? -1 : 1) : i === 2 ? -1 : 1;
    const baseX = Number(panel.userData.baseRotX ?? 0);
    const baseZ = Number(panel.userData.baseRotZ ?? 0);
    const flutter = Math.sin(walk * 1.05 + i * 1.7) * 0.035 * wind;
    panel.rotation.x = THREE.MathUtils.damp(
      panel.rotation.x,
      baseX + coatLift + flutter + (casting ? castPulse * 0.13 : 0),
      8,
      dt,
    );
    panel.rotation.z = THREE.MathUtils.damp(
      panel.rotation.z,
      baseZ + side * (0.02 + Math.sin(walk * 0.8 + i) * 0.025 * wind),
      7,
      dt,
    );
  }

  /* ---- weapon pose ---- */
  const wr = model.weaponRoot;
  wr.rotation.order = 'YXZ';
  if (model.weaponKind === 'sword') {
    const idle = new THREE.Vector3(0.34, 0.22, -0.04);
    const aimPos = new THREE.Vector3(0.15, 0.28, -0.34);
    const target = new THREE.Vector3().copy(idle).lerp(aimPos, aim);
    let rx = THREE.MathUtils.lerp(-0.38, -1.28, aim);
    let ry = THREE.MathUtils.lerp(0.18, 0.04, aim);
    let rz = THREE.MathUtils.lerp(-0.26, -0.18, aim);
    if (meleeActive) {
      target.set(0.16, 0.29, -0.48);
      if (combo === 3) {
        target.set(0.12, 0.48 - meleeP * 0.16, -0.36 - meleeP * 0.24);
        rx = 0.72 - meleeP * 2.86;
        ry = 0.22 - meleeP * 0.12;
        rz = -0.1 - meleeP * 0.08;
      } else {
        const sweep = Math.sin((meleeP - 0.12) * Math.PI);
        rx = -1.18 + Math.cos(meleeP * Math.PI) * 0.25;
        ry = (combo === 2 ? -1 : 1) * (0.95 - sweep * 1.9);
        rz = (combo === 2 ? 1 : -1) * (0.8 - sweep * 1.6);
      }
    }
    if (s.reloading) {
      target.y -= 0.08;
      rx += 0.12;
    }
    if (techActive) {
      const k = techSlam;
      switch (s.techniqueKind) {
        case 'blinkstrike':
          target.set(0.09, 0.44, -0.58);
          rx = 0.18;
          ry = 0.1 - k * 0.5;
          rz = -0.05;
          break;
        case 'quake':
          target.set(0.3, 0.14 + k * 0.1, -0.1);
          rx = -0.8 + k * 0.55;
          ry = 0.34;
          rz = -0.42;
          break;
        case 'sanguine':
          target.set(0.2, 0.36, -0.24);
          rx = -1.34;
          ry = Math.sin(techP * Math.PI * 3) * 0.8;
          rz = -0.16;
          break;
        case 'banner':
          target.set(0.2, 0.54, -0.16);
          rx = -0.32;
          ry = 0.06;
          rz = -0.1;
          break;
        case 'aegis':
          target.set(0.18, 0.26, -0.34);
          rx = -1.16;
          ry = 0.28;
          rz = 0.32;
          break;
        default:
          target.set(0.28, 0.2, -0.28);
          rx = -0.78;
          ry = 0.3;
          rz = -0.3;
          break;
      }
    }
    if (dodging) {
      target.x -= dodgeSide * 0.12 * dodgePulse;
      target.z += 0.05 * dodgePulse;
      rz += dodgeSide * 0.3 * dodgePulse;
    }
    damp(wr.position, target.x, target.y, target.z, meleeActive ? 30 : 14, dt);
    dampEuler(wr.rotation, rx, ry, rz, meleeActive ? 30 : 14, dt);
  } else {
    const idlePos = new THREE.Vector3(0.2, 0.2, -0.36);
    const adsPos = new THREE.Vector3(0.13, 0.45, -0.54);
    const target = new THREE.Vector3().copy(idlePos).lerp(adsPos, aim);
    let rx = THREE.MathUtils.lerp(0.12, 0.0, aim);
    let ry = THREE.MathUtils.lerp(0.08, 0.0, aim);
    let rz = THREE.MathUtils.lerp(-0.04, 0.0, aim);
    if (s.reloading) {
      target.y -= 0.2;
      target.z += 0.06;
      rx += 0.42;
      rz += 0.18;
    }
    if (meleeActive) {
      /* A rifle buttstroke still uses the weapon rig. */
      target.z -= 0.12;
      ry += (combo === 2 ? -1 : 1) * meleeSwing * 0.7;
      rx -= meleeSwing * 0.4;
    }
    target.z += s.recoil * 0.045;
    target.y += s.recoil * 0.018;
    rx -= s.recoil * 0.16;
    rx += s.pitch * 0.5;
    if (casting && s.castKind === 'shadowstep') {
      target.z -= 0.12;
      target.y -= 0.05;
    }
    if (techActive) {
      target.y -= 0.16 * techPulse;
      target.z += 0.08 * techPulse;
      rx += 0.34 * techPulse;
      rz += 0.26 * techPulse;
    }
    if (dodging) {
      target.x -= dodgeSide * 0.1 * dodgePulse;
      rz += dodgeSide * 0.32 * dodgePulse;
    }
    damp(wr.position, target.x, target.y, target.z, 16, dt);
    dampEuler(wr.rotation, rx, ry, rz, 16, dt);
  }

  /* Subtle idle sway across the whole body. */
  model.body.position.x = THREE.MathUtils.damp(
    model.body.position.x,
    Math.sin(walk * 0.5) * 0.014 * moveBlend - comboTwist * 0.05,
    10,
    dt,
  );
  model.body.rotation.z = THREE.MathUtils.damp(
    model.body.rotation.z,
    Math.sin(model.breath * 0.55) * 0.008 - stride * 0.018 * moveBlend - dodgeSide * 0.34 * dodgePulse,
    6,
    dt,
  );
  model.body.rotation.x = THREE.MathUtils.damp(
    model.body.rotation.x,
    air ? -0.015 : 0,
    6,
    dt,
  );

  /* The rig should always settle back to a neutral stance when idle. */
  model.group.rotation.z = dampAngle(model.group.rotation.z, 0, 8, dt);
}
