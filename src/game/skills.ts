import * as THREE from 'three';
import type { ClassSkillKind } from '../data/classes';

export interface SkillVfx {
  group: THREE.Group;
  /** progress 0..1, elapsed seconds */
  update: (progress: number, elapsed: number) => void;
}

function glowMaterial(color: number, opacity = 0.85) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function solidMaterial(color: number, roughness = 0.5, metalness = 0.3, emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity: emissive ? 1.6 : 0,
  });
}

function ring(radius: number, thickness: number, color: number, opacity = 0.8) {
  return new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 64), glowMaterial(color, opacity));
}

function easeOut(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

/* ------------------------------------------------------------------ */
/* Transformation / invocation aura                                    */
/* ------------------------------------------------------------------ */

const AURA_COLOR: Record<ClassSkillKind, number> = {
  rally: 0xffd98a,
  feast: 0x9f2c32,
  bloodveil: 0xd1465e,
  frenzy: 0xff6538,
  undying: 0xffe1a1,
  hellfire: 0xff4326,
  shadowstep: 0x8a9dff,
  decree: 0xffcf72,
};

export function createClassAura(
  kind: ClassSkillKind,
  classId: string,
  classColor: string,
  colorOverride?: number,
): SkillVfx {
  const group = new THREE.Group();
  const color = colorOverride ?? AURA_COLOR[kind] ?? new THREE.Color(classColor).getHex();
  const accent = new THREE.Color(classColor).getHex();
  const ghoul = classId === 'ghoul';
  const human = classId === 'human';
  const demon = classId === 'demon';
  const vamp = classId === 'vampire';
  const immortal = classId === 'immortal';

  /* Ground seal: layered rings and a rotating rune plate. */
  const ground = new THREE.Group();
  const outer = ring(1.65, 0.026, color, 0.7);
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = 0.035;
  ground.add(outer);
  const inner = ring(1.1, 0.014, accent, 0.8);
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.045;
  ground.add(inner);

  const seal = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 1.45, 8, 1),
    glowMaterial(color, 0.14),
  );
  seal.rotation.x = -Math.PI / 2;
  seal.position.y = 0.03;
  ground.add(seal);
  group.add(ground);

  /* A vertical bloom of light. */
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 1.25, 3.4, 32, 1, true),
    glowMaterial(color, 0.16),
  );
  pillar.position.y = 1.65;
  group.add(pillar);

  /* Floating rune shards orbit the operator. */
  const orbs: Array<{ mesh: THREE.Mesh; angle: number; radius: number; y: number; speed: number }> = [];
  const orbMat = glowMaterial(color, 0.9);
  for (let i = 0; i < 18; i++) {
    const geometry =
      i % 3 === 0
        ? new THREE.OctahedronGeometry(0.035 + Math.random() * 0.03)
        : new THREE.SphereGeometry(0.02 + Math.random() * 0.022, 6, 4);
    const orb = new THREE.Mesh(geometry, orbMat);
    const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.25;
    const radius = 0.62 + Math.random() * 0.55;
    const y = 0.16 + Math.random() * 1.75;
    orb.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    group.add(orb);
    orbs.push({ mesh: orb, angle, radius, y, speed: 0.6 + Math.random() * 0.8 });
  }

  /* Spines for the more predatory awakenings. */
  const spikes: THREE.Mesh[] = [];
  if (ghoul || demon || vamp) {
    const spikeMat = solidMaterial(ghoul ? 0x2b171b : demon ? 0x32150f : 0x3b171f, 0.62, 0.3, color);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 0.9 + (i % 2) * 0.35;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.06 + (i % 3) * 0.018, 0.34 + (i % 4) * 0.12, 5),
        spikeMat,
      );
      spike.position.set(Math.cos(a) * r, 0.18, Math.sin(a) * r);
      spike.rotation.z = Math.cos(a) * 0.5;
      spike.rotation.x = Math.sin(a) * 0.5;
      group.add(spike);
      spikes.push(spike);
    }
  }

  /* Ghoul V4: a crown of dark tendrils and a crimson ground stain. */
  if (ghoul) {
    const tendrilMat = solidMaterial(0x231317, 0.72, 0.2, 0x7d1d2a);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.36, 0.05, Math.sin(a) * 0.36),
        new THREE.Vector3(Math.cos(a + 0.5) * 0.9, 0.8, Math.sin(a + 0.5) * 0.9),
        new THREE.Vector3(Math.cos(a + 0.2) * 1.15, 1.8, Math.sin(a + 0.2) * 1.15),
        new THREE.Vector3(Math.cos(a - 0.35) * 0.55, 2.3, Math.sin(a - 0.35) * 0.55),
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.026, 6, false), tendrilMat);
      tube.rotation.y = i * 0.2;
      group.add(tube);
    }
    const crown = ring(0.44, 0.022, 0xc72f40, 0.9);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 2.2;
    group.add(crown);
  }

  /* Human V4: unbroken white-gold resolve, an upright halo and wing-like
     light blades. */
  if (human || immortal) {
    const halo = ring(0.52, 0.022, 0xffe6a5, 0.92);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 2.08;
    group.add(halo);
    const haloInner = ring(0.42, 0.01, 0xfff5d7, 0.7);
    haloInner.rotation.x = Math.PI / 2;
    haloInner.position.y = 2.07;
    group.add(haloInner);
    const wingMat = glowMaterial(0xffdda0, 0.55);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const feather = new THREE.Mesh(
          new THREE.PlaneGeometry(0.06, 0.74 + i * 0.18),
          wingMat,
        );
        feather.position.set(side * (0.52 + i * 0.13), 1.54 + i * 0.08, 0.2);
        feather.rotation.z = side * (0.5 + i * 0.14);
        feather.rotation.y = side * 0.25;
        group.add(feather);
      }
    }
  }

  /* Vampire: suspended blood ribbons. */
  const ribbons: THREE.Mesh[] = [];
  if (vamp || kind === 'bloodveil') {
    const ribbonMat = glowMaterial(0xd83452, 0.55);
    for (let i = 0; i < 5; i++) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.1, 0),
        new THREE.Vector3(Math.cos(i * 1.4) * 0.7, 0.8, Math.sin(i * 1.4) * 0.7),
        new THREE.Vector3(Math.cos(i * 1.4 + 0.8) * 1.1, 1.7, Math.sin(i * 1.4 + 0.8) * 1.1),
      ]);
      const ribbon = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.02, 5, false), ribbonMat);
      group.add(ribbon);
      ribbons.push(ribbon);
    }
  }

  /* V4 horns: curved, glowing spines that read as an awakening rather than
     a prop. They follow the operator so the transformation feels worn. */
  const hornMat = solidMaterial(0x16131a, 0.42, 0.5, color);
  const hornGlow = glowMaterial(color, 0.55);
  const berserk = classId === 'berserk';
  const assassin = classId === 'assassin';
  const heroking = classId === 'heroking';

  if (ghoul) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = 0.16;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * r, 1.88, Math.sin(a) * r),
        new THREE.Vector3(Math.cos(a) * (r + 0.06), 2.05, Math.sin(a) * (r + 0.06)),
        new THREE.Vector3(Math.cos(a) * (r + 0.02), 2.22, Math.sin(a) * (r + 0.02)),
      ]);
      const spike = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.022, 6, false), solidMaterial(0x2a1216, 0.5, 0.4, 0x8f1f2a));
      group.add(spike);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), glowMaterial(0xc72f40, 0.8));
      tip.position.set(Math.cos(a) * (r + 0.02), 2.24, Math.sin(a) * (r + 0.02));
      group.add(tip);
    }
  } else if (demon) {
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.14, 1.9, -0.04),
        new THREE.Vector3(side * 0.34, 2.12, -0.18),
        new THREE.Vector3(side * 0.46, 2.34, -0.1),
        new THREE.Vector3(side * 0.3, 2.48, 0.02),
      ]);
      const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.05, 10, false), solidMaterial(0x2a120e, 0.45, 0.45, 0xff4a24));
      group.add(horn);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), glowMaterial(0xff5a2a, 0.85));
      tip.position.set(side * 0.3, 2.48, 0.02);
      group.add(tip);
    }
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.08, 1.92, 0.02),
        new THREE.Vector3(side * 0.16, 2.06, 0.06),
        new THREE.Vector3(side * 0.2, 2.18, 0.02),
      ]);
      const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.028, 8, false), solidMaterial(0x2a120e, 0.45, 0.45, 0xff4a24));
      group.add(horn);
    }
  } else if (human || immortal) {
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.1, 1.94, -0.06),
        new THREE.Vector3(side * 0.16, 2.18, -0.1),
        new THREE.Vector3(side * 0.14, 2.46, -0.06),
      ]);
      const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.026, 8, false), solidMaterial(0xf0e2b8, 0.28, 0.6, 0xffe6a5));
      group.add(horn);
    }
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.018, 6, 32), glowMaterial(0xffe6a5, 0.7));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 2.55;
    group.add(halo);
  } else if (berserk) {
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.13, 1.92, -0.05),
        new THREE.Vector3(side * 0.18, 2.2, -0.08),
        new THREE.Vector3(side * 0.16, 2.46, -0.04),
      ]);
      const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.048, 10, false), solidMaterial(0x3a2416, 0.5, 0.35, 0xff6a3d));
      group.add(horn);
    }
  } else if (assassin) {
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.11, 1.94, -0.03),
        new THREE.Vector3(side * 0.22, 2.08, -0.14),
        new THREE.Vector3(side * 0.3, 2.18, -0.1),
      ]);
      const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.02, 8, false), solidMaterial(0x1a1a2a, 0.4, 0.5, 0x8a9dff));
      group.add(horn);
    }
  } else if (vamp) {
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.12, 1.92, -0.04),
        new THREE.Vector3(side * 0.26, 2.06, -0.16),
        new THREE.Vector3(side * 0.32, 2.22, -0.08),
        new THREE.Vector3(side * 0.24, 2.34, 0.02),
      ]);
      const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.03, 8, false), solidMaterial(0x2a1218, 0.45, 0.4, 0xd83452));
      group.add(horn);
    }
  } else if (heroking) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const r = 0.2;
      const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.42, 8), solidMaterial(0x3a2a12, 0.4, 0.6, 0xffcf72));
      spike.position.set(Math.cos(a) * r, 2.1, Math.sin(a) * r);
      group.add(spike);
    }
  } else {
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.12, 1.92, -0.02),
        new THREE.Vector3(side * 0.2, 2.1, -0.08),
        new THREE.Vector3(side * 0.26, 2.28, -0.16),
        new THREE.Vector3(side * 0.2, 2.42, -0.12),
      ]);
      const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.032, 8, false), hornMat);
      group.add(horn);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), hornGlow);
      tip.position.set(side * 0.2, 2.42, -0.12);
      group.add(tip);
    }
  }

  const pulse = new THREE.PointLight(color, 3, 7, 2);
  pulse.position.y = 1.2;
  group.add(pulse);

  return {
    group,
    update: (p, elapsed) => {
      const open = easeOut(Math.min(1, p * 1.7));
      const fade = p < 0.12 ? p / 0.12 : p > 0.86 ? Math.max(0, 1 - (p - 0.86) / 0.14) : 1;
      group.scale.setScalar(0.55 + open * 0.45);
      group.visible = fade > 0.01;
      ground.rotation.y = elapsed * 0.55;
      seal.rotation.z = -elapsed * 0.8;
      pillar.scale.set(1 + Math.sin(elapsed * 5) * 0.06, 1, 1 + Math.sin(elapsed * 5) * 0.06);
      pillar.rotation.y = elapsed * 0.7;
      (pillar.material as THREE.MeshBasicMaterial).opacity = 0.16 * fade;

      const outerMat = outer.material as THREE.MeshBasicMaterial;
      outerMat.opacity = 0.7 * fade;
      inner.scale.setScalar(0.85 + Math.sin(elapsed * 4) * 0.08);
      (inner.material as THREE.MeshBasicMaterial).opacity = 0.8 * fade;
      (seal.material as THREE.MeshBasicMaterial).opacity = 0.14 * fade;

      for (const orb of orbs) {
        const a = orb.angle + elapsed * orb.speed;
        orb.mesh.position.set(
          Math.cos(a) * orb.radius,
          orb.y + Math.sin(elapsed * 2.2 + orb.angle) * 0.14,
          Math.sin(a) * orb.radius,
        );
        orb.mesh.rotation.y = elapsed * 2 + orb.angle;
      }
      (orbMat as THREE.MeshBasicMaterial).opacity = 0.9 * fade;

      for (const spike of spikes) {
        spike.scale.y = 0.8 + Math.sin(elapsed * 6 + spike.position.x) * 0.22;
      }

      for (const ribbon of ribbons) {
        ribbon.rotation.y = Math.sin(elapsed * 1.4 + ribbon.position.x) * 0.2;
      }

      pulse.intensity = 3 * fade * (0.8 + Math.sin(elapsed * 6) * 0.2);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Portal                                                              */
/* ------------------------------------------------------------------ */

export function createPortal(color = 0x8f9dff): SkillVfx {
  const group = new THREE.Group();

  const voidMat = new THREE.MeshBasicMaterial({
    color: 0x05030a,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const spiralMat = glowMaterial(color, 0.8);
  const rimMat = glowMaterial(color, 0.95);

  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), voidMat);
  group.add(disc);

  const inner = ring(0.72, 0.02, color, 0.85);
  group.add(inner);
  const outer = ring(1.08, 0.045, color, 0.9);
  group.add(outer);
  const outerHalo = ring(1.2, 0.08, color, 0.18);
  group.add(outerHalo);

  for (let i = 0; i < 3; i++) {
    const spiral = new THREE.Mesh(
      new THREE.TorusGeometry(0.32 + i * 0.2, 0.008, 5, 36, Math.PI * 1.1),
      spiralMat,
    );
    spiral.rotation.z = i * 2.2;
    group.add(spiral);
  }

  const shards: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const shard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 0.18 + (i % 3) * 0.08),
      rimMat,
    );
    shard.position.set(Math.cos(angle) * 1.22, Math.sin(angle) * 1.22, 0.02);
    shard.rotation.z = angle - Math.PI / 2;
    group.add(shard);
    shards.push(shard);
  }

  const light = new THREE.PointLight(color, 4, 8, 2);
  light.position.z = 0.4;
  group.add(light);

  return {
    group,
    update: (p, elapsed) => {
      const open = p < 0.25 ? easeOut(p / 0.25) : 1;
      const close = p > 0.72 ? Math.max(0, 1 - (p - 0.72) / 0.28) : 1;
      const s = open * close;
      group.visible = s > 0.01;
      group.scale.set(s * 1.02, s * 1.18, s * 1.02);
      inner.rotation.z = elapsed * 1.4;
      outer.rotation.z = -elapsed * 0.7;
      outerHalo.rotation.z = elapsed * 0.4;
      (spiralMat as THREE.MeshBasicMaterial).opacity = 0.8 * s;
      (rimMat as THREE.MeshBasicMaterial).opacity = 0.95 * s;
      voidMat.opacity = 0.92 * s;
      for (let i = 0; i < shards.length; i++) {
        shards[i].scale.y = 0.6 + Math.sin(elapsed * 4 + i) * 0.35;
      }
      light.intensity = 4 * s;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Sword trail                                                         */
/* ------------------------------------------------------------------ */

export function createSlashArc(color = 0xd8c7ff): SkillVfx {
  const group = new THREE.Group();
  const material = glowMaterial(color, 0.92);
  const arc = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 1.58, 36, 1, -1.15, 2.3),
    material,
  );
  arc.rotation.z = 0.1;
  group.add(arc);
  const thin = new THREE.Mesh(
    new THREE.RingGeometry(1.42, 1.62, 36, 1, -1.0, 2.0),
    glowMaterial(0xf6ebff, 0.75),
  );
  thin.rotation.z = 0.1;
  group.add(thin);
  const light = new THREE.PointLight(color, 2, 4, 2);
  group.add(light);

  return {
    group,
    update: (p, elapsed) => {
      const fade = Math.max(0, 1 - p);
      group.scale.setScalar(0.72 + easeOut(p) * 0.55);
      group.rotation.z = -0.7 + p * 1.4;
      material.opacity = 0.92 * fade;
      (thin.material as THREE.MeshBasicMaterial).opacity = 0.75 * fade;
      light.intensity = 2 * fade;
      void elapsed;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Sword arts                                                          */
/* ------------------------------------------------------------------ */

/** A travelling crescent of blade force, aligned to the caster's facing. */
export function createCrescentWave(color = 0xd8c7ff): SkillVfx {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const mainMat = glowMaterial(color, 0.9);
  const coreMat = glowMaterial(0xffffff, 0.85);
  const edgeMat = glowMaterial(color, 0.55);

  const main = new THREE.Mesh(new THREE.RingGeometry(0.64, 1.6, 42, 1, -1.22, 2.44), mainMat);
  main.rotation.z = Math.PI / 2;
  body.add(main);
  const core = new THREE.Mesh(new THREE.RingGeometry(1.52, 1.7, 42, 1, -1.16, 2.32), coreMat);
  core.rotation.z = Math.PI / 2;
  body.add(core);
  const echo = new THREE.Mesh(new THREE.RingGeometry(1.76, 1.9, 42, 1, -1.1, 2.2), edgeMat);
  echo.rotation.z = Math.PI / 2;
  body.add(echo);

  const shards: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const a = -1.12 + (i / 8) * 2.24;
    const shard = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.22 + (i % 3) * 0.1), edgeMat);
    shard.position.set(Math.sin(a) * 1.72, Math.cos(a) * 1.72, 0.03);
    shard.rotation.z = -a;
    body.add(shard);
    shards.push(shard);
  }

  const light = new THREE.PointLight(color, 5, 9, 2);
  light.position.z = -0.6;
  group.add(light);

  return {
    group,
    update: (p, elapsed) => {
      const fade = p < 0.12 ? p / 0.12 : p > 0.78 ? Math.max(0, 1 - (p - 0.78) / 0.22) : 1;
      const travel = easeOut(p) * 10.6;
      body.position.z = -travel;
      body.rotation.z = Math.sin(elapsed * 4.2) * 0.08;
      group.scale.setScalar(0.92 + p * 0.34);
      mainMat.opacity = 0.9 * fade;
      coreMat.opacity = 0.85 * fade;
      edgeMat.opacity = 0.55 * fade;
      for (let i = 0; i < shards.length; i++) {
        shards[i].scale.y = 0.7 + Math.sin(elapsed * 8 + i) * 0.35;
      }
      light.intensity = 5 * fade;
    },
  };
}

/** Ground-slam finisher: rings, radial blade shadows, and a central pillar. */
export function createSwordNova(color = 0xd8c7ff): SkillVfx {
  const group = new THREE.Group();

  const floorMat = glowMaterial(color, 0.85);
  const floor = ring(1.0, 0.04, color, 0.85);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.04;
  group.add(floor);
  const inner = ring(0.66, 0.022, 0xffffff, 0.7);
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.05;
  group.add(inner);

  const streakMat = glowMaterial(color, 0.7);
  const streaks: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 2.0), streakMat);
    streak.position.set(Math.cos(a) * 0.9, 0.6, Math.sin(a) * 0.9);
    streak.rotation.y = -a + Math.PI / 2;
    streak.rotation.x = 0.12;
    group.add(streak);
    streaks.push(streak);
  }

  const pillarMat = glowMaterial(0xffffff, 0.28);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.62, 7.5, 16, 1, true), pillarMat);
  pillar.position.y = 3.4;
  group.add(pillar);

  const shardMat = glowMaterial(color, 0.9);
  const shards: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const shard = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.1 + Math.random() * 0.12),
      shardMat,
    );
    shard.position.set(Math.cos(a) * (0.4 + Math.random() * 0.8), 0.25 + Math.random() * 1.4, Math.sin(a) * (0.4 + Math.random() * 0.8));
    group.add(shard);
    shards.push(shard);
  }

  const light = new THREE.PointLight(color, 7, 12, 2);
  light.position.y = 1.4;
  group.add(light);

  return {
    group,
    update: (p, elapsed) => {
      const fade = p < 0.1 ? p / 0.1 : Math.max(0, 1 - (p - 0.1) / 0.9);
      const burst = easeOut(Math.min(1, p * 1.5));
      group.scale.setScalar(0.72 + burst * 0.55);
      floor.scale.setScalar(0.4 + burst * 1.5);
      inner.scale.setScalar(0.4 + burst * 1.9);
      floorMat.opacity = 0.85 * fade;
      (inner.material as THREE.MeshBasicMaterial).opacity = 0.7 * fade;
      streakMat.opacity = 0.7 * fade;
      pillarMat.opacity = 0.28 * fade;
      shardMat.opacity = 0.9 * fade;
      for (let i = 0; i < streaks.length; i++) {
        streaks[i].scale.y = 0.5 + burst * 1.1;
        streaks[i].position.y = 0.35 + burst * 0.55;
      }
      for (let i = 0; i < shards.length; i++) {
        const shard = shards[i];
        shard.position.y += (1.6 + (i % 4) * 0.5) * 0.016;
        shard.rotation.x += 0.08;
        shard.rotation.z += 0.06;
      }
      pillar.scale.set(1 + Math.sin(elapsed * 8) * 0.12, 1, 1 + Math.sin(elapsed * 8) * 0.12);
      light.intensity = 7 * fade;
    },
  };
}

/** Wake left behind a blink cut. */
export function createDashStreaks(color = 0xd8c7ff): SkillVfx {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const mat = glowMaterial(color, 0.8);
  const bright = glowMaterial(0xffffff, 0.65);
  const streaks: THREE.Mesh[] = [];
  for (let i = 0; i < 11; i++) {
    const w = 0.02 + Math.random() * 0.03;
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(w, 1.4 + Math.random() * 2.4),
      i % 3 === 0 ? bright : mat,
    );
    streak.position.set((Math.random() - 0.5) * 1.1, 0.25 + Math.random() * 1.5, (Math.random() - 0.5) * 3.4);
    streak.rotation.x = Math.PI / 2;
    streak.rotation.z = (Math.random() - 0.5) * 0.4;
    body.add(streak);
    streaks.push(streak);
  }

  const ringMat = glowMaterial(color, 0.9);
  const wake = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.045, 6, 32), ringMat);
  wake.rotation.x = -Math.PI / 2;
  wake.position.y = 0.05;
  group.add(wake);

  const light = new THREE.PointLight(color, 4, 8, 2);
  light.position.y = 1.1;
  group.add(light);

  return {
    group,
    update: (p, elapsed) => {
      const fade = Math.max(0, 1 - p);
      body.position.z = p * 2.4;
      body.scale.set(1 + p * 0.5, 1, 1 - p * 0.35);
      mat.opacity = 0.8 * fade;
      bright.opacity = 0.65 * fade;
      ringMat.opacity = 0.9 * fade;
      wake.scale.setScalar(1 + p * 2.2);
      for (let i = 0; i < streaks.length; i++) {
        streaks[i].position.z += 0.055;
        streaks[i].scale.y = 1 + p * 1.2;
      }
      light.intensity = 4 * fade;
      void elapsed;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Class techniques                                                    */
/* ------------------------------------------------------------------ */

/** Immortal ward: a faceted golden dome that breathes with the cast. */
export function createAegisDome(color = 0xffd479, radius = 3.4): SkillVfx {
  const group = new THREE.Group();
  const shellMat = glowMaterial(color, 0.16);
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.52),
    shellMat,
  );
  group.add(shell);

  const latticeMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.32,
    wireframe: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lattice = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.004, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    latticeMat,
  );
  group.add(lattice);

  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(Math.cos((i + 1) * 0.3) * radius, 0.028, 6, 60),
      glowMaterial(i === 0 ? 0xfff1c9 : color, 0.7),
    );
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = Math.sin((i + 1) * 0.3) * radius;
    group.add(ringMesh);
    rings.push(ringMesh);
  }

  const floor = new THREE.Mesh(new THREE.RingGeometry(radius * 0.9, radius * 1.02, 64), glowMaterial(color, 0.6));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.04;
  group.add(floor);

  const light = new THREE.PointLight(color, 4, radius * 3, 2);
  light.position.y = 1.2;
  group.add(light);

  return {
    group,
    update: (p, elapsed) => {
      const fade = p < 0.12 ? p / 0.12 : p > 0.8 ? Math.max(0, 1 - (p - 0.8) / 0.2) : 1;
      shellMat.opacity = 0.16 * fade * (0.85 + Math.sin(elapsed * 3.4) * 0.15);
      latticeMat.opacity = 0.32 * fade;
      shell.scale.setScalar(0.94 + Math.sin(elapsed * 2.6) * 0.015);
      lattice.rotation.y = elapsed * 0.22;
      for (let i = 0; i < rings.length; i++) {
        const mat = rings[i].material as THREE.MeshBasicMaterial;
        mat.opacity = 0.7 * fade * (0.7 + Math.sin(elapsed * 2.4 + i) * 0.3);
        rings[i].rotation.z = elapsed * (0.4 + i * 0.16);
      }
      (floor.material as THREE.MeshBasicMaterial).opacity = 0.6 * fade;
      light.intensity = 4 * fade;
    },
  };
}

/** Hero King standard: planted shaft, banner cloth, and radial judgement. */
export function createBannerPillar(color = 0xffd479): SkillVfx {
  const group = new THREE.Group();
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x3b3227,
    roughness: 0.5,
    metalness: 0.7,
    emissive: color,
    emissiveIntensity: 0.25,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.05, 6.4, 10), shaftMat);
  shaft.position.y = 3.2;
  group.add(shaft);
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), glowMaterial(color, 0.95));
  finial.position.y = 6.5;
  group.add(finial);

  const clothMat = new THREE.MeshStandardMaterial({
    color: 0x8c2f33,
    roughness: 0.92,
    side: THREE.DoubleSide,
    emissive: color,
    emissiveIntensity: 0.16,
  });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 2.3, 6, 10), clothMat);
  cloth.position.set(0.66, 4.9, 0);
  group.add(cloth);
  const crest = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 5, 24), glowMaterial(color, 0.8));
  crest.position.set(0.66, 5.16, 0.02);
  group.add(crest);

  const beamMat = glowMaterial(color, 0.2);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 7.4, 22, 1, true), beamMat);
  beam.position.y = 3.6;
  group.add(beam);

  const floorMat = glowMaterial(color, 0.8);
  const floor = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.9, 64), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.04;
  group.add(floor);
  const chevrons: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const chevron = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.7), glowMaterial(color, 0.55));
    chevron.position.set(Math.cos(a) * 2.25, 0.06, Math.sin(a) * 2.25);
    chevron.rotation.x = -Math.PI / 2;
    chevron.rotation.z = -a + Math.PI / 2;
    group.add(chevron);
    chevrons.push(chevron);
  }

  const light = new THREE.PointLight(color, 5, 16, 2);
  light.position.y = 2.4;
  group.add(light);

  return {
    group,
    update: (p, elapsed) => {
      const fade = p < 0.1 ? p / 0.1 : p > 0.75 ? Math.max(0, 1 - (p - 0.75) / 0.25) : 1;
      const rise = easeOut(Math.min(1, p * 3));
      shaft.scale.y = rise;
      shaft.position.y = 3.2 * rise;
      finial.position.y = 6.5 * rise;
      cloth.position.y = 4.9 * rise;
      crest.position.y = 5.16 * rise;
      cloth.rotation.y = Math.sin(elapsed * 2.1) * 0.16;
      const verts = cloth.geometry.getAttribute('position');
      for (let i = 0; i < verts.count; i++) {
        const x = verts.getX(i);
        verts.setZ(i, Math.sin(elapsed * 3 + x * 3.4) * 0.08 * (x / 0.625 + 0.5));
      }
      verts.needsUpdate = true;
      cloth.geometry.computeVertexNormals();
      clothMat.emissiveIntensity = 0.16 + Math.sin(elapsed * 4) * 0.08;
      beamMat.opacity = 0.2 * fade * (0.7 + Math.sin(elapsed * 5) * 0.3);
      floorMat.opacity = 0.8 * fade;
      floor.scale.setScalar(1 + Math.sin(elapsed * 3.2) * 0.06);
      for (let i = 0; i < chevrons.length; i++) {
        (chevrons[i].material as THREE.MeshBasicMaterial).opacity =
          0.55 * fade * (0.5 + Math.sin(elapsed * 4 + i * 0.8) * 0.5);
      }
      light.intensity = 5 * fade;
    },
  };
}

/** Vampire waltz: concentric blood rings orbiting the operator. */
export function createSanguineVortex(color = 0xd1465e): SkillVfx {
  const group = new THREE.Group();
  const rings: THREE.Mesh[] = [];
  const ringMats: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 4; i++) {
    const mat = glowMaterial(i === 0 ? 0xffd0d8 : color, 0.72);
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(1.1 + i * 0.5, 0.022 + i * 0.008, 6, 60), mat);
    mesh.rotation.x = Math.PI / 2 + (i % 2 === 0 ? 0.18 : -0.18);
    mesh.position.y = 0.35 + i * 0.42;
    group.add(mesh);
    rings.push(mesh);
    ringMats.push(mat);
  }
  const beads: THREE.Mesh[] = [];
  for (let i = 0; i < 16; i++) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.035 + Math.random() * 0.03, 8, 6), glowMaterial(0xffb9c4, 0.85));
    const a = (i / 16) * Math.PI * 2;
    bead.position.set(Math.cos(a) * (1.3 + Math.random() * 1.2), 0.3 + Math.random() * 1.7, Math.sin(a) * (1.3 + Math.random() * 1.2));
    group.add(bead);
    beads.push(bead);
  }
  const light = new THREE.PointLight(color, 4, 10, 2);
  light.position.y = 1.2;
  group.add(light);
  return {
    group,
    update: (p, elapsed) => {
      const fade = p < 0.12 ? p / 0.12 : Math.max(0, 1 - Math.max(0, p - 0.55) / 0.45);
      group.rotation.y = elapsed * 1.9;
      group.scale.setScalar(0.78 + easeOut(p) * 0.48);
      for (let i = 0; i < rings.length; i++) {
        rings[i].rotation.z = elapsed * (1.2 + i * 0.5);
        ringMats[i].opacity = 0.72 * fade;
      }
      for (let i = 0; i < beads.length; i++) {
        const a = (i / beads.length) * Math.PI * 2 + elapsed * 1.9;
        const radius = 1.25 + ((i % 4) * 0.22);
        beads[i].position.set(Math.cos(a) * radius, 0.3 + ((i * 0.37) % 1.8), Math.sin(a) * radius);
        (beads[i].material as THREE.MeshBasicMaterial).opacity = 0.85 * fade;
      }
      light.intensity = 4 * fade;
    },
  };
}

/** Demon art: a burning lane of three sequential detonations. */
export function createInfernoLane(color = 0xff5b30): SkillVfx {
  const group = new THREE.Group();
  const stations: THREE.Group[] = [];
  const mats: THREE.MeshBasicMaterial[] = [];
  for (let s = 0; s < 3; s++) {
    const station = new THREE.Group();
    station.position.z = -s * 4.2;
    group.add(station);
    stations.push(station);

    const ringMat = glowMaterial(color, 0.85);
    const groundRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.32, 48), ringMat);
    groundRing.rotation.x = -Math.PI / 2;
    groundRing.position.y = 0.05;
    station.add(groundRing);
    mats.push(ringMat);

    const coreMat = glowMaterial(0xffe0a1, 0.5);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.85, 5.6, 18, 1, true), coreMat);
    core.position.y = 2.8;
    station.add(core);
    mats.push(coreMat);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const tongueMat = glowMaterial(0xff8a3d, 0.6);
      const tongue = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.2, 7), tongueMat);
      tongue.position.set(Math.cos(a) * 1.1, 0.6, Math.sin(a) * 1.1);
      tongue.rotation.x = Math.PI;
      station.add(tongue);
      mats.push(tongueMat);
    }
    const light = new THREE.PointLight(color, 0, 8, 2);
    light.position.y = 1.6;
    station.add(light);
    station.userData.light = light;
  }

  return {
    group,
    update: (p, elapsed) => {
      for (let s = 0; s < 3; s++) {
        const start = s * 0.18;
        const local = THREE.MathUtils.clamp((p - start) / 0.42, 0, 1);
        const fade = Math.max(0, 1 - Math.max(0, local - 0.45) / 0.55);
        stations[s].visible = local > 0;
        stations[s].scale.setScalar(0.7 + easeOut(local) * 0.7);
        const light = stations[s].userData.light as THREE.PointLight;
        light.intensity = 6 * fade * (0.6 + Math.sin(elapsed * 14 + s) * 0.4);
      }
      for (let i = 0; i < mats.length; i++) {
        mats[i].opacity = Math.max(0, 1 - p) * (0.55 + Math.sin(elapsed * 12 + i) * 0.2);
      }
    },
  };
}

/** Ground fissure for the berserker slam. */
export function createQuakeFissure(color = 0xffa050): SkillVfx {
  const group = new THREE.Group();
  const floorMat = glowMaterial(color, 0.8);
  const floor = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.72, 64), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.04;
  group.add(floor);

  const crackMat = glowMaterial(0xffd9a6, 0.85);
  const cracks: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.25;
    const len = 2.4 + Math.random() * 2.6;
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.06 + Math.random() * 0.08, len), crackMat);
    crack.position.set(Math.cos(a) * len * 0.5, 0.05, Math.sin(a) * len * 0.5);
    crack.rotation.x = -Math.PI / 2;
    crack.rotation.z = -a + Math.PI / 2;
    group.add(crack);
    cracks.push(crack);
  }

  const shardMat = glowMaterial(color, 0.9);
  const shards: THREE.Mesh[] = [];
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.12 + Math.random() * 0.16), shardMat);
    shard.position.set(Math.cos(a) * (1.2 + Math.random() * 3), 0.12, Math.sin(a) * (1.2 + Math.random() * 3));
    group.add(shard);
    shards.push(shard);
  }

  const light = new THREE.PointLight(color, 6, 16, 2);
  light.position.y = 1;
  group.add(light);

  return {
    group,
    update: (p, elapsed) => {
      const fade = Math.max(0, 1 - p);
      const burst = easeOut(Math.min(1, p * 2.4));
      floor.scale.setScalar(0.3 + burst * 1.6);
      floorMat.opacity = 0.8 * fade;
      crackMat.opacity = 0.85 * fade;
      for (let i = 0; i < cracks.length; i++) {
        cracks[i].scale.y = 0.4 + burst * 0.8;
        cracks[i].position.y = 0.05 + Math.sin(elapsed * 12 + i) * 0.01;
      }
      for (let i = 0; i < shards.length; i++) {
        shards[i].position.y = 0.1 + burst * (0.4 + (i % 5) * 0.32);
        shards[i].rotation.x += 0.12;
        shards[i].rotation.y += 0.09;
      }
      shardMat.opacity = 0.9 * fade;
      light.intensity = 6 * fade;
    },
  };
}

/** Instinct activation: a compressed sphere of intent and trailing lines. */
export function createInstinctWake(color = 0x9fd8ff): SkillVfx {
  const group = new THREE.Group();
  const ringMat = glowMaterial(color, 0.85);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12), glowMaterial(color, 0.4));
  core.position.y = 1.05;
  group.add(core);

  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.55 + i * 0.26, 0.02, 6, 44), ringMat);
    r.position.y = 0.7 + i * 0.35;
    r.rotation.x = Math.PI / 2 + (i - 1) * 0.45;
    group.add(r);
    rings.push(r);
  }

  const lineMat = glowMaterial(0xcfeaff, 0.6);
  const lines: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 1.5 + Math.random()), lineMat);
    line.position.set((Math.random() - 0.5) * 1.4, 0.4 + Math.random() * 1.5, (Math.random() - 0.5) * 1.4);
    line.rotation.y = Math.random() * Math.PI;
    group.add(line);
    lines.push(line);
  }

  const light = new THREE.PointLight(color, 5, 8, 2);
  light.position.y = 1.2;
  group.add(light);

  return {
    group,
    update: (p, elapsed) => {
      const fade = Math.max(0, 1 - p);
      const burst = easeOut(Math.min(1, p * 3));
      core.scale.setScalar(0.6 + burst * 1.3 + Math.sin(elapsed * 20) * 0.05);
      ringMat.opacity = 0.85 * fade;
      for (let i = 0; i < rings.length; i++) {
        rings[i].scale.setScalar(0.7 + burst * (1.4 + i * 0.4));
        rings[i].rotation.z = elapsed * (2.4 + i);
      }
      lineMat.opacity = 0.6 * fade;
      for (let i = 0; i < lines.length; i++) {
        lines[i].position.x += Math.sign(lines[i].position.x || 1) * 0.012;
        lines[i].scale.y = 0.4 + burst * 1.1;
      }
      (core.material as THREE.MeshBasicMaterial).opacity = 0.4 * fade;
      light.intensity = 5 * fade;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Cleanup                                                             */
/* ------------------------------------------------------------------ */

export function disposeSkillVfx(root: THREE.Object3D) {
  root.traverse((child) => {
    const m = child as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (mat) mat.dispose();
    }
  });
}
