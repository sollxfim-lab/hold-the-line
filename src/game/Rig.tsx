import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { getPlayerClass, type ClassTechniqueKind, type PlayerClass } from '../data/classes';
import { getCoat } from '../data/cosmetics';
import { getWeapon, WEAPONS, type Weapon } from '../data/weapons';
import { getSwordCombo, type SwordComboSkill } from '../data/swordSkills';
import {
  createEnemyModel,
  createViewModel,
  createWorld,
  type EnemyModel,
  type EnemyType,
  type ViewModel,
  type WorldData,
} from './models';
import { animatePlayer, createPlayerModel, mountPlayerWeapon } from './player';
import {
  createAegisDome,
  createBannerPillar,
  createClassAura,
  createCrescentWave,
  createDashStreaks,
  createInfernoLane,
  createInstinctWake,
  createPortal,
  createQuakeFissure,
  createSanguineVortex,
  createSlashArc,
  createSwordNova,
  disposeSkillVfx,
  type SkillVfx,
} from './skills';
import { sfx } from './audio';

const EYE = 1.62;
const PLAYER_RADIUS = 0.44;
const SENS = 0.0022;
const GRAVITY = 23;
const JUMP_SPEED = 7.35;

const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();

const SPARK_GEO = new THREE.SphereGeometry(0.032, 4, 3);
const SPARK_MAT = new THREE.MeshBasicMaterial({ color: 0xffc27a });
const BLOOD_GEO = new THREE.SphereGeometry(0.04, 4, 3);
const BLOOD_MAT = new THREE.MeshBasicMaterial({ color: 0xc23a26 });
const BLAST_GEO = new THREE.SphereGeometry(0.55, 8, 6);
const RING_GEO = new THREE.TorusGeometry(1, 0.055, 6, 44);
const CASING_GEO = new THREE.BoxGeometry(0.018, 0.018, 0.05);
const CASING_MAT = new THREE.MeshStandardMaterial({ color: 0xc9a04e, metalness: 0.8, roughness: 0.35 });

const TRACER_MAT = new THREE.LineBasicMaterial({
  color: 0xffe1a8,
  transparent: true,
  opacity: 0.75,
  depthWrite: false,
});

interface EnemyInst {
  id: number;
  model: EnemyModel;
  pos: THREE.Vector3;
  home: THREE.Vector3;
  baseY: number;
  hp: number;
  maxHp: number;
  type: EnemyType;
  speed: number;
  attackTimer: number;
  fireTimer: number;
  bob: number;
  phase: number;
  wobble: number;
  strafe: number;
  dead: boolean;
  deadT: number;
  deathDir: number;
  stagger: number;
  engaged: boolean;
  flashT: number;
  flashMats: THREE.MeshStandardMaterial[];
  ally: boolean;
  expiry: number;
  /* Boss-only attack schedulers... */
  slamCd: number;
  slamT: number;
  slamFired: boolean;
  volleyCd: number;
  chargeCd: number;
  chargeWind: number;
  chargeT: number;
  chargeX: number;
  chargeZ: number;
  contactCd: number;
  bossStage: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  dmg: number;
  life: number;
}

interface Effect {
  obj: THREE.Object3D;
  kind: 'tracer' | 'spark' | 'blast' | 'casing' | 'ring';
  life: number;
  max: number;
  vel?: THREE.Vector3;
  grav?: number;
  spin?: number;
  radius?: number;
}

function disposeEffect(fx: Effect) {
  if (fx.obj instanceof THREE.Line) {
    fx.obj.geometry.dispose();
    (fx.obj.material as THREE.Material).dispose();
    return;
  }
  if (!(fx.obj instanceof THREE.Mesh)) return;
  const geometry = fx.obj.geometry;
  if (
    geometry !== SPARK_GEO &&
    geometry !== BLOOD_GEO &&
    geometry !== BLAST_GEO &&
    geometry !== RING_GEO &&
    geometry !== CASING_GEO
  ) {
    geometry.dispose();
  }
  if (fx.kind === 'blast' || fx.kind === 'ring') (fx.obj.material as THREE.Material).dispose();
}

interface WaveState {
  index: number;
  queue: number;
  spawnTimer: number;
  clearTimer: number;
  cleared: boolean;
}

interface ActiveVfx {
  vfx: SkillVfx;
  start: number;
  dur: number;
  parent?: THREE.Object3D;
}

interface CastState {
  cls: PlayerClass;
  start: number;
  applied: boolean;
}

interface SwordCastState {
  combo: SwordComboSkill;
  index: number;
  weapon: Weapon;
  start: number;
  applied: boolean;
  dir: THREE.Vector3;
  chain: number;
}

interface TechniqueCastState {
  cls: PlayerClass;
  kind: ClassTechniqueKind;
  start: number;
  applied: boolean;
}

interface DodgeState {
  start: number;
  dur: number;
  dir: THREE.Vector3;
  side: number;
  ghosts: number;
  nextGhost: number;
}

interface Afterimage {
  obj: THREE.Group;
  mat: THREE.MeshBasicMaterial;
  life: number;
  max: number;
}

const TECH_IMPACT_MS: Record<ClassTechniqueKind, number> = {
  breach: 520,
  carrion: 500,
  sanguine: 640,
  quake: 780,
  aegis: 600,
  inferno: 560,
  blinkstrike: 460,
  banner: 620,
};

const TECH_CAST_MS: Record<ClassTechniqueKind, number> = {
  breach: 2100,
  carrion: 2200,
  sanguine: 2600,
  quake: 2600,
  aegis: 2800,
  inferno: 2400,
  blinkstrike: 2000,
  banner: 3000,
};

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (
      mesh.geometry &&
      mesh.geometry !== SPARK_GEO &&
      mesh.geometry !== BLOOD_GEO &&
      mesh.geometry !== BLAST_GEO &&
      mesh.geometry !== RING_GEO &&
      mesh.geometry !== CASING_GEO
    ) {
      mesh.geometry.dispose();
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (mat && mat.userData.owned) mat.dispose();
    }
  });
}

function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

function resolveCollisions(
  pos: THREE.Vector3,
  radius: number,
  colliders: THREE.Box3[],
  bounds: number,
  feetY = 0,
) {
  const limit = bounds - 1;
  pos.x = THREE.MathUtils.clamp(pos.x, -limit, limit);
  pos.z = THREE.MathUtils.clamp(pos.z, -limit, limit);
  for (const b of colliders) {
    /* Airborne operators clear low barriers and crates instead of sliding
       along their sides. */
    if (feetY > b.max.y - 0.1) continue;
    const cx = THREE.MathUtils.clamp(pos.x, b.min.x, b.max.x);
    const cz = THREE.MathUtils.clamp(pos.z, b.min.z, b.max.z);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 > radius * radius) continue;
    if (d2 < 1e-6) {
      const dl = pos.x - b.min.x;
      const dr = b.max.x - pos.x;
      const db = pos.z - b.min.z;
      const df = b.max.z - pos.z;
      const m = Math.min(dl, dr, db, df);
      if (m === dl) pos.x = b.min.x - radius;
      else if (m === dr) pos.x = b.max.x + radius;
      else if (m === db) pos.z = b.min.z - radius;
      else pos.z = b.max.z + radius;
    } else {
      const d = Math.sqrt(d2);
      pos.x += (dx / d) * (radius - d);
      pos.z += (dz / d) * (radius - d);
    }
  }
}

function raySphere(origin: THREE.Vector3, dir: THREE.Vector3, center: THREE.Vector3, radius: number): number | null {
  tmpV.copy(center).sub(origin);
  const t = tmpV.dot(dir);
  if (t < 0) return null;
  const d2 = tmpV.lengthSq() - t * t;
  const r2 = radius * radius;
  if (d2 > r2) return null;
  const thc = Math.sqrt(r2 - d2);
  return t - thc;
}

function rayWorld(world: WorldData, origin: THREE.Vector3, dir: THREE.Vector3): number {
  const ray = new THREE.Ray(origin, dir);
  let nearest = 160;
  for (const b of world.colliders) {
    const hit = ray.intersectBox(b, tmpV3);
    if (hit) {
      const d = hit.distanceTo(origin);
      if (d < nearest) nearest = d;
    }
  }
  return nearest;
}

const ENEMY_NAME: Record<EnemyType, string> = {
  grunt: 'Breacher',
  rifleman: 'Rifleman',
  drone: 'Sentry drone',
  boss: 'The Warden',
  zombie: 'Shambler',
};

export function Rig() {
  const { camera, gl, scene } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const world = useMemo<WorldData>(() => createWorld(), []);
  const equipped = useGameStore((s) => s.equipped);
  const classId = useGameStore((s) => s.classId);
  const coatId = useGameStore((s) => s.coatId);
  const vm = useMemo<ViewModel>(() => createViewModel(getWeapon(equipped)), [equipped]);
  const player = useMemo(
    () => createPlayerModel(getCoat(coatId), getPlayerClass(classId).color),
    [coatId, classId],
  );

  const pos = useRef(new THREE.Vector3(0, 0, 14));
  const vel = useRef(new THREE.Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const keys = useRef<Set<string>>(new Set());
  const trigger = useRef({ held: false, semi: false });
  const nextShot = useRef(0);
  const recoilPitch = useRef(0);
  const recoilYaw = useRef(0);
  const viewKick = useRef(0);
  const shake = useRef(0);
  const bob = useRef(0);
  const flashTimer = useRef(0);
  const reload = useRef({ active: false, t: 0, dur: 1 });
  const raise = useRef(0);
  const lastYaw = useRef(0);
  const lookSway = useRef(0);
  const vertVel = useRef(0);
  const grounded = useRef(true);
  const airJumpsLeft = useRef(1);
  const landKick = useRef(0);
  const regenAcc = useRef(0);
  const guardianSeen = useRef(0);
  const classBuff = useRef({ dmg: 1, rate: 1, speed: 1, until: 0 });
  const cloakUntil = useRef(0);
  const radarTimer = useRef(0);
  const nukeSeen = useRef(0);
  const melee = useRef({ t: 99, dur: 0.36, combo: 1 });
  const basicChain = useRef({ next: 1, lastAt: 0 });
  const swordChain = useRef({ step: 0, lastAt: 0 });
  const swordCast = useRef<SwordCastState | null>(null);
  const techniqueCast = useRef<TechniqueCastState | null>(null);
  const cast = useRef<CastState | null>(null);
  const dodge = useRef<DodgeState | null>(null);
  const afterimages = useRef<Afterimage[]>([]);
  const dodgeSeen = useRef(0);
  const bossSpawned = useRef(false);
  const instinctSide = useRef(1);
  const immortalWings = useRef<THREE.Group | null>(null);
  const blindUntil = useRef(0);
  const instinctVisionUntil = useRef(0);
  const visionMarkers = useRef<THREE.Mesh[]>([]);
  const moonMeshes = useRef<THREE.Mesh[]>([]);
  const spikes = useRef<Array<{ mesh: THREE.Mesh; life: number; max: number }>>([]);
  const ghoulSpikeCd = useRef(0);
  const activeVfx = useRef<ActiveVfx[]>([]);
  const persistentAura = useRef<{ vfx: SkillVfx; cls: string } | null>(null);
  const aggroSoundAt = useRef(0);
  const viewBlend = useRef(0);

  const enemies = useRef<EnemyInst[]>([]);
  const projectiles = useRef<Projectile[]>([]);
  const effects = useRef<Effect[]>([]);
  const wave = useRef<WaveState>({ index: 0, queue: 0, spawnTimer: 0, clearTimer: 0, cleared: false });
  const spawnAttempt = useRef(0);
  const lastRun = useRef(0);

  /* ---------------- setup ---------------- */
  useEffect(() => {
    scene.background = new THREE.Color(0x2a2418);
    scene.fog = new THREE.Fog(0x2a2418, 34, 132);
    cam.near = 0.03;
    cam.far = 240;
    cam.updateProjectionMatrix();
  }, [scene, camera]);

  useEffect(() => {
    cam.add(vm.root);
    vm.root.visible = false;
    return () => {
      cam.remove(vm.root);
      disposeObject(vm.root);
    };
  }, [camera, vm]);

  useEffect(() => {
    mountPlayerWeapon(player, getWeapon(equipped));
  }, [player, equipped]);

  useEffect(() => {
    player.body.visible = false;
    return () => {
      for (const entry of activeVfx.current) {
        (entry.parent ?? scene).remove(entry.vfx.group);
        disposeSkillVfx(entry.vfx.group);
      }
      activeVfx.current = [];
      cast.current = null;
      if (persistentAura.current) {
        player.group.remove(persistentAura.current.vfx.group);
        disposeSkillVfx(persistentAura.current.vfx.group);
        persistentAura.current = null;
      }
      disposeObject(player.group);
    };
  }, [player, scene]);

  useEffect(() => {
    reload.current.active = false;
    reload.current.t = 0;
    trigger.current.held = false;
    trigger.current.semi = false;
    raise.current = 1;
    useGameStore.getState().setReloading(false);
  }, [equipped]);

  /* ---------------- input ---------------- */
  useEffect(() => {
    const el = gl.domElement;

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current.add(k);
      if (k === ' ') {
        e.preventDefault();
        if (!e.repeat && !useGameStore.getState().flyMode) tryJump();
      }
      const st = useGameStore.getState();
      if (st.phase !== 'playing' || st.paused) return;
      if (k === 'capslock') {
        if (!e.repeat) {
          e.preventDefault();
          st.toggleCamera();
          sfx.switched();
        }
        return;
      }
      if (k === 'r') startReload();
      if (k === 'q') useClassSkill();
      if (k === 'e' && !e.repeat) useTechnique();
      if (k === 'v' && !e.repeat) useInstinct();
      if (k === 'g' && !e.repeat) spawnSpike();
      if (k === 'z') useSwordSkill(0);
      if (k === 'x') useSwordSkill(1);
      if (k === 'c') useSwordSkill(2);
      if (k === 'f') st.setAds(!st.ads);
      if (k === 'h') {
        st.useMedkit();
      }
      if (k === 'm') sfx.toggleMute();
      let slot = -1;
      if (k >= '1' && k <= '9') slot = Number(k) - 1;
      else if (k === '0') slot = 9;
      if (slot >= 0) {
        const id = WEAPONS[slot]?.id;
        if (id && st.owned.includes(id) && id !== st.equipped) {
          st.setEquipped(id);
          sfx.switched();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.target !== el) return;
      const st = useGameStore.getState();
      if (st.phase !== 'playing' || st.paused) return;
      sfx.init();
      if (document.pointerLockElement !== el) {
        void el.requestPointerLock();
        return;
      }
      if (e.button === 0) {
        trigger.current.held = true;
        trigger.current.semi = true;
      }
      if (e.button === 2) {
        st.setAds(true);
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) trigger.current.held = false;
      if (e.button === 2) {
        const st = useGameStore.getState();
        if (st.phase === 'playing') st.setAds(false);
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      const st = useGameStore.getState();
      /* Scoped optics slow the look rate so long-range tracking stays precise. */
      const zoomScale = st.ads ? Math.max(0.38, getWeapon(st.equipped).adsFov / 68) : 1;
      yaw.current -= e.movementX * SENS * zoomScale;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - e.movementY * SENS * zoomScale,
        -1.18,
        1.18,
      );
    };
    const onWheel = (e: WheelEvent) => {
      const st = useGameStore.getState();
      if (st.phase !== 'playing' || st.paused) return;
      const order = WEAPONS.map((w) => w.id).filter((id) => st.owned.includes(id));
      if (order.length < 2) return;
      const i = Math.max(0, order.indexOf(st.equipped));
      const next = order[(i + (e.deltaY > 0 ? 1 : order.length - 1)) % order.length];
      st.setEquipped(next);
      sfx.switched();
    };
    const onContext = (e: Event) => e.preventDefault();
    const onLockChange = () => {
      if (document.pointerLockElement !== el) trigger.current.held = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('contextmenu', onContext);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContext);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, player]);

  /* ---------------- helpers used by the loop ---------------- */
  function tryJump() {
    const st = useGameStore.getState();
    if (st.phase !== 'playing' || st.paused || st.flyMode) return;
    const power = JUMP_SPEED * st.upgrades.jumpPower * (st.classId === 'immortal' ? 1.25 : 1);
    if (grounded.current) {
      vertVel.current = power;
      grounded.current = false;
      airJumpsLeft.current = st.upgrades.airJumps;
      landKick.current = 0;
      sfx.jump();
      return;
    }
    if (airJumpsLeft.current > 0) {
      vertVel.current = power * 1.06;
      airJumpsLeft.current -= 1;
      sfx.doubleJump();
      spawnRing(
        new THREE.Vector3(pos.current.x, pos.current.y + 0.06, pos.current.z),
        0.85,
        0x9fd4ff,
      );
    }
  }

  function startReload() {
    const st = useGameStore.getState();
    if (st.phase !== 'playing' || reload.current.active) return;
    const w = getWeapon(st.equipped);
    if (w.kind === 'sword' || st.ammo >= w.mag || st.reserve <= 0) return;
    reload.current.active = true;
    reload.current.t = 0;
    const human = st.classId === 'human' ? 0.9 : 1;
    const rally = performance.now() < classBuff.current.until ? 0.7 : 1;
    reload.current.dur = w.reload * st.upgrades.reload * human * rally;
    st.setReloading(true);
    sfx.reload();
  }

  function aoeDamage(radius: number, damage: number, color: number, ringRadius = radius) {
    const center = new THREE.Vector3(pos.current.x, 0.08, pos.current.z);
    spawnRing(center, ringRadius, color);
    let hits = 0;
    for (const e of enemies.current) {
      if (e.dead) continue;
      const dx = e.pos.x - pos.current.x;
      const dz = e.pos.z - pos.current.z;
      if (dx * dx + dz * dz > radius * radius) continue;
      damageEnemy(e, damage, false, new THREE.Vector3(e.pos.x, e.baseY + 1.2, e.pos.z));
      hits++;
    }
    if (hits > 0) sfx.shockwave();
    return hits;
  }

  function getOutgoingMultiplier(
    st: ReturnType<typeof useGameStore.getState>,
    cls: PlayerClass,
    maxHp: number,
  ) {
    let classDamage = 1;
    if (cls.id === 'human') classDamage = 1.05;
    else if (cls.id === 'berserk') classDamage = 1 + Math.max(0, 1 - st.hp / maxHp) * 0.35;
    else if (cls.id === 'heroking') classDamage = 1.08;
    else if (cls.id === 'demon') classDamage = 1.06;
    else if (cls.id === 'immortal') classDamage = 1.04;
    else if (cls.id === 'ghoul') classDamage = 1.03;
    else if (cls.id === 'vampire') classDamage = 1.02;
    const buff = performance.now() < classBuff.current.until ? classBuff.current : null;
    return (
      st.upgrades.damage *
      (1 + st.perks.damage * 0.04) *
      classDamage *
      (buff?.dmg ?? 1) *
      (st.oneHitKill ? 1000 : 1)
    );
  }

  function useClassSkill() {
    const st = useGameStore.getState();
    if (st.phase !== 'playing' || st.paused) return;
    if (cast.current || techniqueCast.current) return;
    const cls = getPlayerClass(st.classId);
    const now = performance.now();
    if (now < st.skillReadyAt) {
      sfx.empty();
      return;
    }
    if (!st.triggerSkill(cls.skill.cooldown * 1000)) return;

    /* The transformation begins immediately; the gameplay payload lands on
       the cast timeline's impact frame below. */
    const aura = createClassAura(cls.skill.kind, cls.id, cls.color);
    player.group.add(aura.group);
    activeVfx.current.push({ vfx: aura, start: now, dur: 3200, parent: player.group });

    if (cls.skill.kind === 'shadowstep') {
      const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
      const portal = createPortal(0x8fa4ff);
      portal.group.position.set(
        pos.current.x + forward.x * 3.1,
        pos.current.y + 1.04,
        pos.current.z + forward.z * 3.1,
      );
      portal.group.rotation.y = yaw.current;
      portal.group.visible = false;
      scene.add(portal.group);
      activeVfx.current.push({ vfx: portal, start: now + 90, dur: 1700 });
      sfx.portal();
    } else {
      sfx.cast();
    }

    cast.current = { cls, start: now, applied: false };
  }

  function applySkillImpact(cls: PlayerClass) {
    const st = useGameStore.getState();
    const now = performance.now();
    const power = 1 + (st.wave - 1) * 0.22;
    const center = new THREE.Vector3(pos.current.x, 0.08, pos.current.z);

    switch (cls.skill.kind) {
      case 'rally': {
        const w = getWeapon(st.equipped);
        if (w.kind !== 'sword') {
          const mag = Math.min(w.mag, st.ammo + st.reserve);
          const used = mag - st.ammo;
          st.setAmmo(mag, Math.max(0, st.reserve - used));
        }
        st.setReloading(false);
        reload.current.active = false;
        reload.current.t = 0;
        classBuff.current = { dmg: 1.2, rate: 1.25, speed: 1.05, until: now + 6000 };
        spawnRing(center, 2.2, 0xffd479);
        sfx.select('mythic');
        break;
      }
      case 'feast': {
        const hits = aoeDamage(7, 130 * power, 0x9fb45c);
        if (hits > 0) useGameStore.getState().healPlayer(15 * hits);
        sfx.select('mythic');
        break;
      }
      case 'bloodveil': {
        const targets = enemies.current
          .filter(
            (e) =>
              !e.dead &&
              Math.hypot(e.pos.x - pos.current.x, e.pos.z - pos.current.z) <= 11,
          )
          .sort((a, b) => a.pos.distanceToSquared(pos.current) - b.pos.distanceToSquared(pos.current))
          .slice(0, 4);
        let drained = 0;
        const from = new THREE.Vector3(pos.current.x, pos.current.y + 1.3, pos.current.z);
        for (const target of targets) {
          const point = new THREE.Vector3(target.pos.x, target.baseY + 1.2, target.pos.z);
          spawnArc(from, point, 0xd86a80);
          damageEnemy(target, 150 * power, false, point);
          drained += 150 * power;
        }
        if (drained > 0) {
          useGameStore.getState().healPlayer(Math.round(drained * 0.5));
          sfx.chain();
        }
        sfx.select('epic');
        break;
      }
      case 'frenzy': {
        classBuff.current = { dmg: 1.5, rate: 1.1, speed: 1.35, until: now + 7000 };
        spawnRing(center, 3.2, 0xff6a3d);
        sfx.shockwave();
        break;
      }
      case 'undying': {
        st.setInvulnerable(now + 6000);
        st.healPlayer(30);
        spawnRing(center, 6, 0xffd479);
        sfx.guardian();
        break;
      }
      case 'hellfire': {
        aoeDamage(9, 200 * power, 0xff5b30);
        sfx.select('divine');
        break;
      }
      case 'shadowstep': {
        const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
        const from = new THREE.Vector3(pos.current.x, 0.08, pos.current.z);
        pos.current.addScaledVector(forward, 7);
        resolveCollisions(pos.current, PLAYER_RADIUS, world.colliders, world.bounds, pos.current.y);
        spawnRing(from, 1.4, 0x8fb4ff);
        spawnRing(new THREE.Vector3(pos.current.x, 0.08, pos.current.z), 1.4, 0x8fb4ff);
        cloakUntil.current = now + 4000;
        sfx.shadowstep();
        break;
      }
      case 'decree': {
        aoeDamage(14, 300 * power, 0xffd479);
        useGameStore.getState().healPlayer(40);
        sfx.guardian();
        break;
      }
    }
  }

  /* ---------------- class techniques (E) ---------------- */
  function useTechnique() {
    const st = useGameStore.getState();
    if (st.phase !== 'playing' || st.paused) return;
    if (st.flyMode) {
      sfx.empty();
      return;
    }
    if (cast.current || swordCast.current || techniqueCast.current) return;
    const cls = getPlayerClass(st.classId);
    const kind = cls.technique.kind;
    const now = performance.now();
    if (!st.triggerTechnique(cls.technique.cooldown * 1000, TECH_CAST_MS[kind])) {
      sfx.empty();
      return;
    }
    techniqueCast.current = { cls, kind, start: now, applied: false };

    const color = new THREE.Color(cls.color).getHex();
    spawnRing(new THREE.Vector3(pos.current.x, 0.06, pos.current.z), 2.1, color);
    const charge = createClassAura(cls.skill.kind, cls.id, cls.color);
    player.group.add(charge.group);
    activeVfx.current.push({ vfx: charge, start: now, dur: 1350, parent: player.group });
    sfx.technique(kind);

    if (kind === 'blinkstrike') {
      /* The blink already reads as a cast; keep the windup short. */
      viewKick.current += 0.15;
    }
    if (kind === 'quake') {
      recoilPitch.current -= 0.02;
    }
  }

  function techniqueTargets(radius: number, point: THREE.Vector3, damage: number) {
    let hits = 0;
    for (const e of enemies.current) {
      if (e.dead) continue;
      const dx = e.pos.x - point.x;
      const dz = e.pos.z - point.z;
      if (dx * dx + dz * dz > radius * radius) continue;
      damageEnemy(
        e,
        damage,
        false,
        new THREE.Vector3(e.pos.x, e.baseY + (e.type === 'boss' ? 2 : 1.2), e.pos.z),
      );
      hits++;
    }
    return hits;
  }

  function applyTechniqueImpact(entry: TechniqueCastState) {
    const st = useGameStore.getState();
    if (st.phase !== 'playing' || st.paused) return;
    const now = performance.now();
    const cls = entry.cls;
    const kind = entry.kind;
    const power = 1 + (st.wave - 1) * 0.22;
    const color = new THREE.Color(cls.color).getHex();
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const center = new THREE.Vector3(pos.current.x, 0.08, pos.current.z);

    switch (kind) {
      case 'breach': {
        const from = pos.current.clone();
        pos.current.addScaledVector(forward, 4.2);
        resolveCollisions(pos.current, PLAYER_RADIUS, world.colliders, world.bounds, pos.current.y);
        const nova = createSwordNova(color);
        nova.group.position.set(pos.current.x, 0.02, pos.current.z);
        scene.add(nova.group);
        activeVfx.current.push({ vfx: nova, start: now, dur: 950 });
        const trail = createDashStreaks(color);
        trail.group.position.copy(from);
        trail.group.rotation.y = yaw.current;
        scene.add(trail.group);
        activeVfx.current.push({ vfx: trail, start: now, dur: 620 });
        const hits = techniqueTargets(4.4, pos.current, 180 * power);
        if (hits > 0) useGameStore.getState().healPlayer(Math.min(20, hits * 3));
        shake.current = Math.min(1, shake.current + 0.7);
        viewKick.current += 0.65;
        sfx.shockwave();
        break;
      }
      case 'carrion': {
        const from = pos.current.clone();
        const midpoint = from.clone().addScaledVector(forward, 3.2);
        pos.current.addScaledVector(forward, 6.4);
        resolveCollisions(pos.current, PLAYER_RADIUS, world.colliders, world.bounds, pos.current.y);
        const trail = createDashStreaks(color);
        trail.group.position.copy(from);
        trail.group.rotation.y = yaw.current;
        scene.add(trail.group);
        activeVfx.current.push({ vfx: trail, start: now, dur: 700 });
        spawnRing(midpoint.setY(0.06), 2.2, color);
        let hits = techniqueTargets(3.2, midpoint, 130 * power);
        hits += techniqueTargets(2.6, pos.current, 110 * power);
        if (hits > 0) useGameStore.getState().healPlayer(9 * hits);
        /* Ghoul curse: blind every hostile, then feed the operator. */
        blindUntil.current = now + 30000;
        /* Dark shadows, crown and horns for the ghoul. */
        const darkMat = new THREE.MeshStandardMaterial({
          color: 0x0a0a0a,
          roughness: 0.3,
          metalness: 0.8,
          emissive: 0x2a0a0a,
          emissiveIntensity: 0.9,
        });
        const crown = new THREE.Group();
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 6, 28), darkMat);
        band.rotation.x = Math.PI / 2;
        crown.add(band);
        for (const side of [-1, 1]) {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.55, 5), darkMat);
          horn.position.set(side * 0.18, 0.3, side * -0.05);
          horn.rotation.z = side * -0.28;
          horn.rotation.x = -0.15;
          crown.add(horn);
          const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 5), darkMat);
          hornTip.position.set(side * 0.18, 0.6, side * -0.05);
          hornTip.rotation.z = side * -0.28;
          hornTip.rotation.x = -0.15;
          crown.add(hornTip);
        }
        crown.position.set(0, 0.12, 0);
        player.head.add(crown);
        window.setTimeout(() => {
          player.head.remove(crown);
          darkMat.dispose();
        }, 30000);
        const shadowAura = createInstinctWake(0x1a0a0a);
        shadowAura.group.position.set(pos.current.x, 0.02, pos.current.z);
        scene.add(shadowAura.group);
        activeVfx.current.push({ vfx: shadowAura, start: now, dur: 1200 });
        for (const e of enemies.current) {
          if (e.ally) continue;
          e.engaged = false;
          e.stagger = 0.6;
        }
        classBuff.current = {
          dmg: Math.max(classBuff.current.dmg, 1.3),
          rate: Math.max(classBuff.current.rate, 1.05),
          speed: Math.max(classBuff.current.speed, 1.15),
          until: Math.max(classBuff.current.until, now + 30000),
        };
        ghoulSpikeCd.current = 0;
        shake.current = Math.min(1, shake.current + 0.32);
        sfx.chain();
        break;
      }
      case 'sanguine': {
        const hits = techniqueTargets(9, center, 120 * power);
        if (hits > 0) useGameStore.getState().healPlayer(6 * hits);
        classBuff.current = {
          dmg: Math.max(classBuff.current.dmg, 1.08),
          rate: Math.max(classBuff.current.rate, 1.06),
          speed: 1.25,
          until: now + 5200,
        };
        /* Red moon over the arena and a pack of shamblers. */
        const moonMat = new THREE.MeshBasicMaterial({
          color: 0xff3a3a,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), moonMat);
        moon.position.set(0, 52, 0);
        scene.add(moon);
        moonMeshes.current.push(moon);
        for (let i = 0; i < 4; i++) {
          const at = new THREE.Vector3(
            pos.current.x + Math.cos((i / 4) * Math.PI * 2) * 4,
            0,
            pos.current.z + Math.sin((i / 4) * Math.PI * 2) * 4,
          );
          spawnZombie(at);
        }
        const vortex = createSanguineVortex(color);
        vortex.group.position.set(pos.current.x, 0.02, pos.current.z);
        scene.add(vortex.group);
        activeVfx.current.push({ vfx: vortex, start: now, dur: 1150 });
        shake.current = Math.min(1, shake.current + 0.3);
        sfx.chain();
        break;
      }
      case 'quake': {
        const fissure = createQuakeFissure(color);
        fissure.group.position.set(pos.current.x, 0.02, pos.current.z);
        scene.add(fissure.group);
        activeVfx.current.push({ vfx: fissure, start: now, dur: 1250 });
        techniqueTargets(6.5, center, 240 * power);
        shake.current = Math.min(1, shake.current + 1);
        viewKick.current += 1;
        landKick.current = Math.max(landKick.current, 0.14);
        sfx.shockwave();
        break;
      }
      case 'aegis': {
        st.setInvulnerable(now + 4000);
        useGameStore.getState().healPlayer(24);
        techniqueTargets(4.2, center, 95 * power);
        const dome = createAegisDome(color, 3.6);
        dome.group.position.set(pos.current.x, 0.02, pos.current.z);
        scene.add(dome.group);
        activeVfx.current.push({ vfx: dome, start: now, dur: 4400 });
        spawnRing(center, 4.2, color);
        sfx.guardian();
        break;
      }
      case 'inferno': {
        const lane = createInfernoLane(color);
        lane.group.position.set(pos.current.x, 0.02, pos.current.z);
        lane.group.rotation.y = yaw.current;
        scene.add(lane.group);
        activeVfx.current.push({ vfx: lane, start: now, dur: 1500 });
        for (let i = 0; i < 3; i++) {
          const point = center.clone().addScaledVector(forward, 4.2 * (i + 1));
          techniqueTargets(3.0, point, (105 + i * 25) * power);
        }
        shake.current = Math.min(1, shake.current + 0.55);
        sfx.shockwave();
        break;
      }
      case 'blinkstrike': {
        let target: EnemyInst | null = null;
        let best = 15 * 15;
        for (const e of enemies.current) {
          if (e.dead) continue;
        if (e.ally) continue;
          const d = e.pos.distanceToSquared(pos.current);
          if (d < best) {
            best = d;
            target = e;
          }
        }
        const from = pos.current.clone();
        if (target) {
          const away = new THREE.Vector3(target.pos.x - pos.current.x, 0, target.pos.z - pos.current.z).normalize();
          pos.current.set(target.pos.x + away.x * 1.7, 0, target.pos.z + away.z * 1.7);
          resolveCollisions(pos.current, PLAYER_RADIUS, world.colliders, world.bounds, pos.current.y);
          const chest = new THREE.Vector3(
            target.pos.x,
            target.baseY + (target.type === 'boss' ? 2 : 1.25),
            target.pos.z,
          );
          const arc = createSlashArc(color);
          arc.group.position.copy(chest);
          arc.group.rotation.y = Math.atan2(away.x, away.z);
          scene.add(arc.group);
          activeVfx.current.push({ vfx: arc, start: now, dur: 640 });
          techniqueTargets(3.1, target.pos, 120 * power);
          damageEnemy(target, 320 * power, true, chest);
          spawnBlast(chest);
          shake.current = Math.min(1, shake.current + 0.45);
          viewKick.current += 0.5;
        } else {
          pos.current.addScaledVector(forward, 6);
          resolveCollisions(pos.current, PLAYER_RADIUS, world.colliders, world.bounds, pos.current.y);
          techniqueTargets(3, pos.current, 160 * power);
        }
        const trail = createDashStreaks(color);
        trail.group.position.copy(from);
        trail.group.rotation.y = yaw.current;
        scene.add(trail.group);
        activeVfx.current.push({ vfx: trail, start: now, dur: 560 });
        sfx.shadowstep();
        break;
      }
      case 'banner': {
        const standard = createBannerPillar(color);
        standard.group.position.copy(center).addScaledVector(forward, 1.8);
        standard.group.rotation.y = yaw.current;
        scene.add(standard.group);
        activeVfx.current.push({ vfx: standard, start: now, dur: 5200 });
        classBuff.current = {
          dmg: Math.max(classBuff.current.dmg, 1.3),
          rate: Math.max(classBuff.current.rate, 1.08),
          speed: Math.max(classBuff.current.speed, 1.12),
          until: now + 6000,
        };
        useGameStore.getState().healPlayer(18);
        techniqueTargets(6, center, 130 * power);
        spawnRing(center, 6, color);
        shake.current = Math.min(1, shake.current + 0.38);
        sfx.guardian();
        break;
      }
      default:
        break;
    }
  }

  /* ---------------- instinct dodge (V) ---------------- */
  function spawnAfterimage() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9fd8ff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ghost = player.group.clone(true);
    ghost.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = mat;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
    ghost.position.copy(pos.current);
    ghost.rotation.y = yaw.current;
    scene.add(ghost);
    afterimages.current.push({ obj: ghost, mat, life: 0.55, max: 0.55 });
  }

  function useInstinct() {
    const st = useGameStore.getState();
    if (st.phase !== 'playing' || st.paused) return;
    if (!st.triggerInstinct(8500, 430)) {
      sfx.empty();
      return;
    }
    const dir = new THREE.Vector3();
    if (keys.current.has('w')) dir.x -= Math.sin(yaw.current), dir.z -= Math.cos(yaw.current);
    if (keys.current.has('s')) dir.x += Math.sin(yaw.current), dir.z += Math.cos(yaw.current);
    if (keys.current.has('d')) dir.x += Math.cos(yaw.current), dir.z -= Math.sin(yaw.current);
    if (keys.current.has('a')) dir.x -= Math.cos(yaw.current), dir.z += Math.sin(yaw.current);
    let side = 0;
    if (dir.lengthSq() < 0.001) {
      side = instinctSide.current;
      instinctSide.current *= -1;
      dir.set(Math.cos(yaw.current) * side, 0, -Math.sin(yaw.current) * side);
    } else {
      dir.normalize();
      side = dir.x * Math.cos(yaw.current) - dir.z * Math.sin(yaw.current) >= 0 ? 1 : -1;
    }
    dodge.current = {
      start: performance.now(),
      dur: 430,
      dir,
      side,
      ghosts: 0,
      nextGhost: 0,
    };
    instinctVisionUntil.current = performance.now() + 4000;
    const wake = createInstinctWake(0x9fd8ff);
    wake.group.position.set(pos.current.x, 0.02, pos.current.z);
    wake.group.rotation.y = yaw.current;
    scene.add(wake.group);
    activeVfx.current.push({ vfx: wake, start: performance.now(), dur: 760 });
    spawnRing(new THREE.Vector3(pos.current.x, 0.06, pos.current.z), 1.5, 0x9fd8ff);
    shake.current = Math.min(1, shake.current + 0.12);
    sfx.instinct();
  }

  /* ---------------- zombie summon (vampire E) ---------------- */
  function spawnZombie(at: THREE.Vector3) {
    const model = createEnemyModel('zombie');
    const x = at.x + (Math.random() - 0.5) * 2.4;
    const z = at.z + (Math.random() - 0.5) * 2.4;
    model.group.position.set(x, 0, z);
    scene.add(model.group);
    const flashMats: THREE.MeshStandardMaterial[] = [];
    model.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        flashMats.push(mesh.material as THREE.MeshStandardMaterial);
      }
    });
    enemies.current.push({
      id: spawnAttempt.current,
      model,
      pos: new THREE.Vector3(x, 0, z),
      home: new THREE.Vector3(x, 0, z),
      baseY: 0,
      hp: 70,
      maxHp: 70,
      type: 'zombie',
      speed: 2.9,
      attackTimer: 0.8,
      fireTimer: 99,
      bob: Math.random() * Math.PI * 2,
      phase: 0,
      wobble: Math.random() * Math.PI * 2,
      strafe: Math.random() > 0.5 ? 1 : -1,
      dead: false,
      deadT: 0,
      deathDir: 1,
      stagger: 0,
      engaged: true,
      flashT: 0,
      flashMats,
      ally: true,
      expiry: performance.now() + 15000,
      slamCd: 0,
      slamT: 0,
      slamFired: false,
      volleyCd: 0,
      chargeCd: 0,
      chargeWind: 0,
      chargeT: 0,
      chargeX: 0,
      chargeZ: 0,
      contactCd: 0,
      bossStage: 0,
    });
    spawnAttempt.current++;
  }
  function spawnSpike() {
    const st = useGameStore.getState();
    if (st.classId !== 'ghoul') return;
    const now = performance.now();
    if (now > blindUntil.current) {
      sfx.empty();
      return;
    }
    if (ghoulSpikeCd.current > now) {
      sfx.empty();
      return;
    }
    ghoulSpikeCd.current = now + 1500;
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const at = pos.current.clone().addScaledVector(forward, 6);
    const dmg = (90 + (st.wave - 1) * 8) * (1 + (st.wave - 1) * 0.22);
    for (const e of enemies.current) {
      if (e.dead || e.ally) continue;
      const dx = e.pos.x - at.x;
      const dz = e.pos.z - at.z;
      if (dx * dx + dz * dz > 2.6 * 2.6) continue;
      damageEnemy(e, dmg, false, new THREE.Vector3(e.pos.x, e.baseY + 1.2, e.pos.z));
    }
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 2.6, 7),
      new THREE.MeshStandardMaterial({
        color: 0x2a221c,
        roughness: 0.6,
        metalness: 0.4,
        emissive: 0x6a3a1a,
        emissiveIntensity: 0.7,
      }),
    );
    spike.position.set(at.x, 1.3, at.z);
    scene.add(spike);
    spikes.current.push({ mesh: spike, life: 0.9, max: 0.9 });
    spawnRing(new THREE.Vector3(at.x, 0.06, at.z), 2.6, 0xff8a4a);
    sfx.shockwave();
  }

  function useSwordSkill(index: number) {
    const st = useGameStore.getState();
    if (st.phase !== 'playing' || st.paused || st.flyMode) return;
    if (cast.current || swordCast.current || techniqueCast.current) return;
    const w = getWeapon(st.equipped);
    if (w.kind !== 'sword') return;
    const combo = getSwordCombo(w.id)[index];
    if (!combo) return;

    const now = performance.now();
    if (!st.triggerSwordSkill(index, combo.cooldown * 1000, combo.cast + 520)) {
      sfx.empty();
      return;
    }

    const dir = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const chained = now - swordChain.current.lastAt <= 4500;
    const chain = chained ? Math.min(3, swordChain.current.step + 1) : 1;
    swordChain.current = { step: chain, lastAt: now };
    swordCast.current = {
      combo,
      index,
      weapon: w,
      start: now,
      applied: false,
      dir,
      chain,
    };
    basicChain.current = { next: 1, lastAt: 0 };
    melee.current = {
      t: 0,
      dur: Math.max(0.38, combo.cast / 1000 + 0.1),
      combo: index === 2 ? 3 : index === 1 ? 2 : 1,
    };
    st.reportShot();
    sfx.swordArt(combo.kind);

    if (combo.kind === 'dash') {
      const trail = createDashStreaks(w.color);
      trail.group.position.copy(pos.current);
      trail.group.rotation.y = yaw.current;
      scene.add(trail.group);
      activeVfx.current.push({ vfx: trail, start: now, dur: 620 });
      recoilPitch.current += 0.008;
    } else if (combo.kind === 'wave') {
      const wave = createCrescentWave(w.color);
      wave.group.position.set(
        pos.current.x + dir.x * 1.7,
        pos.current.y + 1.16,
        pos.current.z + dir.z * 1.7,
      );
      wave.group.rotation.y = yaw.current;
      scene.add(wave.group);
      activeVfx.current.push({ vfx: wave, start: now + 40, dur: 1050 });
      recoilPitch.current += 0.012;
      shake.current = Math.min(1, shake.current + 0.12);
    } else {
      const nova = createSwordNova(w.color);
      nova.group.position.set(pos.current.x, 0.02, pos.current.z);
      scene.add(nova.group);
      activeVfx.current.push({ vfx: nova, start: now + 70, dur: 1150 });
      shake.current = Math.min(1, shake.current + 0.32);
      viewKick.current += 0.5;
    }
  }

  function applySwordImpact(entry: SwordCastState) {
    const st = useGameStore.getState();
    if (st.phase !== 'playing' || st.paused) return;
    const cls = getPlayerClass(st.classId);
    const maxHp = Math.round(100 + st.perks.hp * 10 + st.upgrades.maxHpBonus);
    const combo = entry.combo;
    const w = entry.weapon;
    const color = w.color;
    const dir = entry.dir;
    const fx = dir.x;
    const fz = dir.z;
    const base =
      w.damage *
      combo.power *
      getOutgoingMultiplier(st, cls, maxHp) *
      (1 + (entry.chain - 1) * 0.15);
    const chest = new THREE.Vector3(pos.current.x, pos.current.y + 1.3, pos.current.z);
    const now = performance.now();
    let hits = 0;

    if (combo.kind === 'dash') {
      const from = new THREE.Vector3(pos.current.x, pos.current.y, pos.current.z);
      const distance = combo.distance ?? 4.6;
      pos.current.x += fx * distance;
      pos.current.z += fz * distance;
      if (!st.noclip) {
        resolveCollisions(
          pos.current,
          PLAYER_RADIUS,
          world.colliders,
          world.bounds,
          pos.current.y,
        );
      }
      const to = new THREE.Vector3(pos.current.x, pos.current.y, pos.current.z);
      for (const e of enemies.current) {
        if (e.dead) continue;
        if (e.ally) continue;
        const dx = e.pos.x - from.x;
        const dz = e.pos.z - from.z;
        const along = dx * fx + dz * fz;
        const lateral = Math.abs(dx * fz - dz * fx);
        if (along < -0.5 || along > distance + 0.9) continue;
        if (lateral > combo.radius) continue;
        if (Math.abs(e.baseY - pos.current.y) > 2.8) continue;
        damageEnemy(e, base, false, new THREE.Vector3(e.pos.x, e.baseY + 1.2, e.pos.z));
        e.stagger = Math.max(e.stagger, 0.55);
        const kx = e.pos.x - from.x;
        const kz = e.pos.z - from.z;
        const kd = Math.hypot(kx, kz) || 1;
        e.pos.x += (kx / kd) * 0.9;
        e.pos.z += (kz / kd) * 0.9;
        hits++;
      }
      spawnRing(from, 1.3, color);
      spawnRing(to, 2.1, color);
      spawnArc(
        new THREE.Vector3(from.x, from.y + 1.25, from.z),
        new THREE.Vector3(to.x, to.y + 1.25, to.z),
        color,
      );
      shake.current = Math.min(1, shake.current + 0.18);
      viewKick.current += 0.24;
    } else if (combo.kind === 'wave') {
      for (const e of enemies.current) {
        if (e.dead) continue;
        if (e.ally) continue;
        const dx = e.pos.x - pos.current.x;
        const dz = e.pos.z - pos.current.z;
        const along = dx * fx + dz * fz;
        const lateral = Math.abs(dx * fz - dz * fx);
        if (along <= 0.3 || along > combo.range) continue;
        if (lateral > combo.radius + 0.6) continue;
        if (Math.abs(e.baseY - pos.current.y) > 2.8) continue;
        const point = new THREE.Vector3(e.pos.x, e.baseY + (e.type === 'boss' ? 2 : 1.15), e.pos.z);
        spawnArc(chest, point, color);
        damageEnemy(e, base, false, point);
        e.stagger = Math.max(e.stagger, 0.45);
        hits++;
        if (hits >= 8) break;
      }
      spawnRing(
        new THREE.Vector3(pos.current.x + fx * 4.5, 0.08, pos.current.z + fz * 4.5),
        combo.radius,
        color,
      );
      shake.current = Math.min(1, shake.current + 0.22);
      viewKick.current += 0.3;
    } else {
      for (const e of enemies.current) {
        if (e.dead) continue;
        if (e.ally) continue;
        const dx = e.pos.x - pos.current.x;
        const dz = e.pos.z - pos.current.z;
        const dist = Math.hypot(dx, dz);
        if (dist > combo.radius) continue;
        if (Math.abs(e.baseY - pos.current.y) > 3) continue;
        damageEnemy(e, base, false, new THREE.Vector3(e.pos.x, e.baseY + 1.2, e.pos.z));
        e.stagger = Math.max(e.stagger, 0.6);
        const kx = dx / (dist || 1);
        const kz = dz / (dist || 1);
        e.pos.x += kx * 1.6;
        e.pos.z += kz * 1.6;
        hits++;
      }
      spawnRing(new THREE.Vector3(pos.current.x, 0.08, pos.current.z), combo.radius, color);
      spawnRing(
        new THREE.Vector3(pos.current.x, 0.07, pos.current.z),
        combo.radius * 0.56,
        0xffffff,
      );
      shake.current = Math.min(1, shake.current + 0.55);
      viewKick.current += 0.72;
      sfx.shockwave();
    }

    if (hits > 0) {
      if (cls.id === 'vampire') st.healPlayer(hits * 2);
      if (st.upgrades.chain > 0) {
        const first = enemies.current.find((e) => !e.dead);
        if (first) chainFrom(first, base * 0.24, st.upgrades.chain);
      }
      st.reportHit(false);
    }
    void now;
  }

  function addEffect(effect: Effect) {
    effects.current.push(effect);
    scene.add(effect.obj);
  }

  function spawnSparks(point: THREE.Vector3, blood: boolean, count = 5) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(blood ? BLOOD_GEO : SPARK_GEO, blood ? BLOOD_MAT : SPARK_MAT);
      mesh.position.copy(point);
      addEffect({
        obj: mesh,
        kind: 'spark',
        life: 0.32 + Math.random() * 0.18,
        max: 0.5,
        vel: new THREE.Vector3((Math.random() - 0.5) * 7, Math.random() * 5 + 1.2, (Math.random() - 0.5) * 7),
        grav: -16,
      });
    }
  }

  function spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = TRACER_MAT.clone();
    const line = new THREE.Line(geo, mat);
    addEffect({ obj: line, kind: 'tracer', life: 0.07, max: 0.07 });
  }

  function spawnBlast(point: THREE.Vector3) {
    const mesh = new THREE.Mesh(BLAST_GEO, new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.9, depthWrite: false }));
    mesh.position.copy(point);
    addEffect({ obj: mesh, kind: 'blast', life: 0.3, max: 0.3 });
  }

  function spawnRing(point: THREE.Vector3, radius: number, color = 0xffcf8a) {
    const mesh = new THREE.Mesh(
      RING_GEO,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    mesh.position.copy(point);
    mesh.rotation.x = -Math.PI / 2;
    addEffect({ obj: mesh, kind: 'ring', life: 0.44, max: 0.44, radius });
  }

  function spawnArc(from: THREE.Vector3, to: THREE.Vector3, color = 0x9fd4ff) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    addEffect({ obj: new THREE.Line(geo, mat), kind: 'tracer', life: 0.16, max: 0.16 });
  }

  function chainFrom(source: EnemyInst, dmg: number, jumps: number) {
    let from = source;
    const visited = new Set<EnemyInst>([source]);
    let arced = false;
    for (let jump = 0; jump < jumps; jump++) {
      let next: EnemyInst | null = null;
      let best = 8 * 8;
      for (const e of enemies.current) {
        if (e.dead || visited.has(e)) continue;
        const d = e.pos.distanceToSquared(from.pos);
        if (d < best) {
          best = d;
          next = e;
        }
      }
      if (!next) break;
      const a = new THREE.Vector3(from.pos.x, from.baseY + 1.25, from.pos.z);
      const b = new THREE.Vector3(next.pos.x, next.baseY + 1.25, next.pos.z);
      spawnArc(a, b);
      damageEnemy(next, dmg, false, b.clone());
      visited.add(next);
      from = next;
      arced = true;
    }
    if (arced) sfx.chain();
  }

  function ejectCasing() {
    const mesh = new THREE.Mesh(CASING_GEO, CASING_MAT);
    vm.muzzle.getWorldPosition(tmpV);
    mesh.position.copy(tmpV);
    mesh.position.x += 0.05;
    mesh.position.y -= 0.02;
    addEffect({
      obj: mesh,
      kind: 'casing',
      life: 1.3,
      max: 1.3,
      vel: new THREE.Vector3(0.6 + Math.random() * 0.8, 1.6 + Math.random() * 0.9, 0.4 + Math.random() * 0.5),
      grav: -18,
      spin: 22,
    });
  }

  function damageEnemy(
    e: EnemyInst,
    dmg: number,
    headshot: boolean,
    point: THREE.Vector3,
    fromShockwave = false,
  ) {
    if (e.dead) return;
    const st = useGameStore.getState();
    e.hp -= dmg;
    e.engaged = true;
    e.stagger = Math.min(0.4, e.stagger + 0.18);
    e.flashT = 0.09;
    if (e.type === 'boss' && e.hp > 0) {
      if (e.bossStage === 0 && e.hp <= e.maxHp * 0.5) {
        e.bossStage = 1;
        spawnRing(new THREE.Vector3(e.pos.x, 0.07, e.pos.z), 4.4, 0xff5b3d);
        spawnRing(new THREE.Vector3(e.pos.x, 0.07, e.pos.z), 2.6, 0xffd479);
        sfx.bossRoar();
        shake.current = Math.min(1, shake.current + 0.7);
      }
      st.setBoss({ active: true, name: 'THE WARDEN', hp: Math.max(0, e.hp), maxHp: e.maxHp, wave: st.wave, stage: e.bossStage });
    }
    /* Physical hit reaction: a short shove away from the shooter. */
    const kx = e.pos.x - pos.current.x;
    const kz = e.pos.z - pos.current.z;
    const kd = Math.hypot(kx, kz) || 1;
    e.pos.x += (kx / kd) * 0.075;
    e.pos.z += (kz / kd) * 0.075;
    spawnSparks(point, true, headshot ? 8 : 4);
    st.reportHit(headshot);
    sfx.hit(headshot);
    if (e.hp <= 0) {
      e.dead = true;
      e.deadT = 0;
      e.deathDir = kx >= 0 ? 1 : -1;
      e.flashT = 0;
      for (const mat of e.flashMats) mat.emissive.setHex(0x000000);
      const reward =
        e.type === 'boss'
          ? 180 + st.wave * 20
          : e.type === 'grunt'
            ? 9
            : e.type === 'rifleman'
              ? 13
              : 16;
      if (!e.ally) st.registerKill(reward, ENEMY_NAME[e.type]);
      if (e.type === 'boss') {
        st.setBoss({ active: false, name: 'THE WARDEN', hp: 0, maxHp: e.maxHp, wave: st.wave, stage: 2 });
        sfx.bossDown();
        spawnRing(new THREE.Vector3(e.pos.x, 0.07, e.pos.z), 8.5, 0xffd479);
        spawnRing(new THREE.Vector3(e.pos.x, 0.07, e.pos.z), 4.4, 0xff5b3d);
        spawnBlast(new THREE.Vector3(e.pos.x, 1.4, e.pos.z));
        shake.current = Math.min(1, shake.current + 1);
      }
      if (st.upgrades.scavenger) st.setAmmo(st.ammo, Math.min(999, st.reserve + 5));
      sfx.kill();
      spawnBlast(point);

      /* Cataclysm: every kill erupts into a ground shockwave. Shockwave
         kills do not chain further, which keeps the effect readable. */
      if (st.upgrades.shockwave && !fromShockwave) {
        const radius = 4.6;
        spawnRing(new THREE.Vector3(e.pos.x, 0.08, e.pos.z), radius, 0xffc870);
        sfx.shockwave();
        const center = new THREE.Vector3(e.pos.x, 0, e.pos.z);
        const waveDmg = Math.max(28, dmg * 0.55);
        for (const other of enemies.current) {
          if (other === e || other.dead) continue;
          if (other.pos.distanceTo(center) > radius) continue;
          damageEnemy(
            other,
            waveDmg,
            false,
            new THREE.Vector3(other.pos.x, other.baseY + 1.2, other.pos.z),
            true,
          );
        }
      }
    }
  }

  function fireShot(now: number) {
    const st = useGameStore.getState();
    if (st.phase !== 'playing' || st.paused || reload.current.active || now < nextShot.current) return;
    const w = getWeapon(st.equipped);
    if (w.kind === 'sword') return;
    if (st.ammo <= 0) {
      sfx.empty();
      startReload();
      return;
    }
    const cls = getPlayerClass(st.classId);
    const buff = now < classBuff.current.until ? classBuff.current : null;
    nextShot.current = now + (60000 / w.rpm) * st.upgrades.fireRate / (buff?.rate ?? 1);

    if (!st.infiniteAmmo) st.setAmmo(st.ammo - 1, st.reserve);
    st.reportShot();
    sfx.shot(w.kind);

    recoilPitch.current += w.recoil * 0.0075;
    recoilYaw.current += (Math.random() - 0.5) * w.recoil * 0.005;
    viewKick.current = Math.min(1.5, viewKick.current + w.recoil * 0.5);
    shake.current = Math.min(1, shake.current + w.recoil * 0.22);
    flashTimer.current = 0.045;
    ejectCasing();

    const aimPitch = pitch.current + recoilPitch.current;
    const aimYaw = yaw.current + recoilYaw.current;
    const dir = new THREE.Vector3(
      -Math.sin(aimYaw) * Math.cos(aimPitch),
      Math.sin(aimPitch),
      -Math.cos(aimYaw) * Math.cos(aimPitch)
    ).normalize();

    const originCam = new THREE.Vector3(pos.current.x, pos.current.y + EYE, pos.current.z);
    const right = new THREE.Vector3(Math.cos(aimYaw), 0, -Math.sin(aimYaw));
    const tracerFrom = originCam
      .clone()
      .addScaledVector(right, 0.14)
      .addScaledVector(UP, -0.11)
      .addScaledVector(dir, 0.5);

    const moving = Math.min(1, Math.hypot(vel.current.x, vel.current.z) / 5.4);
    const airborneSpread = grounded.current ? 0 : 0.014;
    const spread =
      (st.ads ? w.adsSpread : w.spread) * (st.ads ? 1 : 1 + moving * 0.85) +
      airborneSpread * (st.ads ? 0.6 : 1);
    const pellets = w.pellets + st.upgrades.pellets;
    const pierce = w.penetration + st.upgrades.pierce;
    const maxHp = Math.round(100 + st.perks.hp * 10 + st.upgrades.maxHpBonus);
    let classDamage = 1;
    if (cls.id === 'human') classDamage = 1.05;
    else if (cls.id === 'berserk') classDamage = 1 + Math.max(0, 1 - st.hp / maxHp) * 0.35;
    else if (cls.id === 'heroking') classDamage = 1.08;
    else if (cls.id === 'demon') classDamage = 1.06;
    else if (cls.id === 'immortal') classDamage = 1.04;
    else if (cls.id === 'ghoul') classDamage = 1.03;
    else if (cls.id === 'vampire') classDamage = 1.02;
    const damageMul =
      st.upgrades.damage *
      (1 + st.perks.damage * 0.04) *
      classDamage *
      (buff?.dmg ?? 1) *
      (st.oneHitKill ? 1000 : 1);
    const critChance = Math.min(0.85, st.upgrades.crit + (cls.id === 'assassin' ? 0.08 : 0));
    const demonBurst = cls.id === 'demon' && Math.random() < 0.16;
    const chainJumps = st.upgrades.chain;
    let anyHit = false;
    let anyHead = false;

    const hits: Array<{ e: EnemyInst; dist: number; point: THREE.Vector3; headshot: boolean }> = [];

    for (let p = 0; p < pellets; p++) {
      const shotDir = dir.clone();
      if (spread > 0) {
        const u = tmpV.copy(UP).cross(shotDir).normalize();
        const v = tmpV2.crossVectors(shotDir, u).normalize();
        const r = Math.sqrt(Math.random()) * spread;
        const a = Math.random() * Math.PI * 2;
        shotDir.addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r).normalize();
      }

      const wallDist = rayWorld(world, originCam, shotDir);
      hits.length = 0;

      for (const e of enemies.current) {
        if (e.dead) continue;
        if (e.ally) continue;
        const drone = e.type === 'drone';
        const boss = e.type === 'boss';
        const bodyCenter = tmpV3.set(e.pos.x, e.baseY + (drone ? 1.3 : boss ? 2.0 : 1.16), e.pos.z);
        const bodyDist = raySphere(originCam, shotDir, bodyCenter, drone ? 0.5 : boss ? 0.92 : 0.44);
        const headCenter = new THREE.Vector3(e.pos.x, e.baseY + (drone ? 1.35 : boss ? 3.05 : 1.75), e.pos.z);
        const headDist = raySphere(originCam, shotDir, headCenter, drone ? 0.24 : boss ? 0.36 : 0.19);
        let dist: number | null = null;
        let headshot = false;
        if (headDist !== null) {
          dist = headDist;
          headshot = true;
        } else if (bodyDist !== null) {
          dist = bodyDist;
        }
        if (dist !== null && dist < wallDist) {
          const point = originCam.clone().addScaledVector(shotDir, dist);
          hits.push({ e, dist, point, headshot });
        }
      }

      hits.sort((a, b) => a.dist - b.dist);
      const maxTargets = pierce + 1;
      const endPoint = originCam.clone().addScaledVector(shotDir, Math.min(wallDist, 160));

      for (let i = 0; i < Math.min(maxTargets, hits.length); i++) {
        const hit = hits[i];
        let dmg = w.damage * damageMul;
        if (hit.headshot) dmg *= 2.4;
        const crit = Math.random() < critChance;
        if (crit) dmg *= 2.5;
        damageEnemy(hit.e, dmg, hit.headshot || crit, hit.point);
        if (chainJumps > 0) chainFrom(hit.e, dmg * 0.45, chainJumps);
        anyHit = true;
        if (hit.headshot || crit) anyHead = true;
        endPoint.copy(hit.point);
        if (st.upgrades.explosive || demonBurst) {
          spawnBlast(hit.point);
          for (const other of enemies.current) {
            if (other === hit.e || other.dead) continue;
            const d = other.pos.distanceTo(hit.e.pos);
            if (d < 2.2) {
              damageEnemy(
                other,
                dmg * 0.4,
                false,
                new THREE.Vector3(other.pos.x, other.baseY + 1.2, other.pos.z)
              );
            }
          }
        }
        if (i < maxTargets - 1 && hits[i + 1]) {
          spawnTracer(hit.point, hits[i + 1].point);
        }
      }

      spawnTracer(tracerFrom, endPoint);
      if (wallDist < 150 && hits.length === 0) {
        const point = originCam.clone().addScaledVector(shotDir, wallDist);
        spawnSparks(point, false, 3);
      }
    }

    if (anyHit && cls.id === 'vampire') {
      useGameStore.getState().healPlayer(3);
    }

    if (anyHit && st.upgrades.refund > 0 && Math.random() < st.upgrades.refund) {
      const current = useGameStore.getState();
      if (current.phase === 'playing') {
        current.setAmmo(Math.min(w.mag, current.ammo + 1), current.reserve);
        sfx.refund();
      }
    }

    viewKick.current += anyHead ? 0.15 : 0;
    if (anyHit) shake.current = Math.min(1, shake.current + (anyHead ? 0.15 : 0.05));
  }

  /* ---------------- melee ---------------- */
  function meleeAttack(now: number) {
    const st = useGameStore.getState();
    if (st.phase !== 'playing' || st.paused || now < nextShot.current) return;
    const w = getWeapon(st.equipped);
    if (w.kind !== 'sword') return;

    const cls = getPlayerClass(st.classId);
    const buff = now < classBuff.current.until ? classBuff.current : null;
    nextShot.current = now + ((60000 / w.rpm) * st.upgrades.fireRate) / (buff?.rate ?? 1);
    st.reportShot();

    if (now - basicChain.current.lastAt > 1150) basicChain.current.next = 1;
    const combo = basicChain.current.next;
    basicChain.current = { lastAt: now, next: combo >= 3 ? 1 : combo + 1 };
    melee.current = { t: 0, dur: combo === 3 ? 0.48 : 0.36, combo };
    sfx.slash(combo);
    recoilPitch.current += w.recoil * 0.005;
    recoilYaw.current += (Math.random() - 0.5) * w.recoil * 0.004;
    viewKick.current = Math.min(1.5, viewKick.current + w.recoil * 0.3);
    shake.current = Math.min(1, shake.current + w.recoil * (combo === 3 ? 0.2 : 0.12));

    /* Each swing carries a short forward lunge, with the finisher heavier. */
    const lungeX = -Math.sin(yaw.current);
    const lungeZ = -Math.cos(yaw.current);
    if (grounded.current) {
      const lunge = combo === 3 ? 1.7 : 0.8;
      vel.current.x += lungeX * lunge;
      vel.current.z += lungeZ * lunge;
    }

    /* A physical slash trail anchored to the operator, not a screen decal. */
    const slash = createSlashArc(w.color);
    slash.group.position.set(0, combo === 3 ? 1.5 : 1.34, -1.02);
    slash.group.rotation.z = combo === 2 ? Math.PI : combo === 3 ? Math.PI / 2 : 0;
    player.group.add(slash.group);
    activeVfx.current.push({ vfx: slash, start: now, dur: combo === 3 ? 340 : 270, parent: player.group });
    if (combo === 3) {
      const cross = createSlashArc(w.color);
      cross.group.position.set(0, 1.54, -0.92);
      cross.group.rotation.z = -Math.PI / 2;
      player.group.add(cross.group);
      activeVfx.current.push({ vfx: cross, start: now + 30, dur: 320, parent: player.group });
    }

    const maxHp = Math.round(100 + st.perks.hp * 10 + st.upgrades.maxHpBonus);
    const damageMul = getOutgoingMultiplier(st, cls, maxHp);
    const critChance = Math.min(0.9, st.upgrades.crit + (cls.id === 'assassin' ? 0.1 : 0) + 0.06);

    const fx = -Math.sin(yaw.current);
    const fz = -Math.cos(yaw.current);
    const reach = (w.reach ?? 3.4) + 0.55;
    const candidates: Array<{ e: EnemyInst; dist: number }> = [];
    for (const e of enemies.current) {
      if (e.dead) continue;
      const dx = e.pos.x - pos.current.x;
      const dz = e.pos.z - pos.current.z;
      const dist = Math.hypot(dx, dz);
      if (dist > reach) continue;
      if (Math.abs(e.baseY + 1.05 - (pos.current.y + 1.05)) > 2.2) continue;
      const dot = dist > 0.001 ? (dx * fx + dz * fz) / dist : 1;
      if (dot < 0.28) continue;
      candidates.push({ e, dist });
    }
    candidates.sort((a, b) => a.dist - b.dist);

    let hits = 0;
    const maxTargets = 1 + w.penetration;
    for (const { e } of candidates.slice(0, maxTargets)) {
      let dmg = w.damage * damageMul;
      if (combo === 3) dmg *= 1.3;
      const crit = Math.random() < critChance;
      if (crit) dmg *= 2.25;
      const point = new THREE.Vector3(e.pos.x, e.baseY + (e.type === 'boss' ? 2 : 1.15), e.pos.z);
      damageEnemy(e, dmg, crit, point);
      if (st.upgrades.chain > 0) chainFrom(e, dmg * 0.45, st.upgrades.chain);
      if (st.upgrades.explosive) {
        for (const other of enemies.current) {
          if (other === e || other.dead) continue;
          if (other.pos.distanceTo(e.pos) < 2.2) {
            damageEnemy(
              other,
              dmg * 0.4,
              false,
              new THREE.Vector3(other.pos.x, other.baseY + 1.1, other.pos.z),
            );
          }
        }
      }
      hits++;
    }

    if (hits > 0 && cls.id === 'vampire') st.healPlayer(3 + hits);
    if (hits > 0) {
      shake.current = Math.min(1, shake.current + 0.08 * hits);
      viewKick.current += 0.12;
    }
  }

  /* ---------------- enemy spawning ---------------- */
  function pickEnemyType(): EnemyType {
    const st = useGameStore.getState();
    const roll = Math.random();
    if (st.wave >= 3 && roll < 0.2) return 'drone';
    if (st.wave >= 2 && roll < 0.55) return 'rifleman';
    return 'grunt';
  }

  function spawnEnemy() {
    const st = useGameStore.getState();
    let x = 0;
    let z = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      const a = Math.random() * Math.PI * 2;
      /* Random distance each spawn instead of a fixed ring. */
      const d = 17 + Math.random() * 33;
      x = THREE.MathUtils.clamp(pos.current.x + Math.cos(a) * d, -world.bounds + 6, world.bounds - 6);
      z = THREE.MathUtils.clamp(pos.current.z + Math.sin(a) * d, -world.bounds + 6, world.bounds - 6);
      const blocked = world.colliders.some((b) => x > b.min.x - 1 && x < b.max.x + 1 && z > b.min.z - 1 && z < b.max.z + 1);
      if (!blocked) break;
    }

    const type = pickEnemyType();
    const model = createEnemyModel(type);
    model.group.position.set(x, 0, z);
    scene.add(model.group);

    const flashMats: THREE.MeshStandardMaterial[] = [];
    model.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        flashMats.push(mesh.material as THREE.MeshStandardMaterial);
      }
    });

    const waveScale = 1 + (st.wave - 1) * 0.17;
    const baseHp = type === 'grunt' ? 58 : type === 'rifleman' ? 52 : 68;
    const hp = Math.round(baseHp * waveScale);

    enemies.current.push({
      id: spawnAttempt.current,
      model,
      pos: new THREE.Vector3(x, 0, z),
      home: new THREE.Vector3(x, 0, z),
      baseY: type === 'drone' ? 0.35 + Math.random() * 0.3 : 0,
      hp,
      maxHp: hp,
      type,
      speed: (type === 'grunt' ? 3.1 : type === 'rifleman' ? 2.2 : 3.5) * (1 + st.wave * 0.015),
      attackTimer: 0.6 + Math.random() * 0.6,
      fireTimer: 1.2 + Math.random() * 1.4,
      bob: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      wobble: Math.random() * Math.PI * 2,
      strafe: Math.random() > 0.5 ? 1 : -1,
      dead: false,
      deadT: 0,
      deathDir: 1,
      stagger: 0,
      engaged: false,
      flashT: 0,
      flashMats,
      ally: false,
      expiry: 0,
      slamCd: 0,
      slamT: 0,
      slamFired: false,
      volleyCd: 0,
      chargeCd: 0,
      chargeWind: 0,
      chargeT: 0,
      chargeX: 0,
      chargeZ: 0,
      contactCd: 0,
      bossStage: 0,
    });
    spawnAttempt.current++;
  }

  /* ---------------- wave boss ---------------- */
  function spawnBoss() {
    const st = useGameStore.getState();
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    let x = THREE.MathUtils.clamp(pos.current.x + forward.x * 25, -world.bounds + 8, world.bounds - 8);
    let z = THREE.MathUtils.clamp(pos.current.z + forward.z * 25, -world.bounds + 8, world.bounds - 8);
    for (let attempt = 0; attempt < 10; attempt++) {
      const blocked = world.colliders.some(
        (b) => x > b.min.x - 2 && x < b.max.x + 2 && z > b.min.z - 2 && z < b.max.z + 2,
      );
      if (!blocked) break;
      x = THREE.MathUtils.clamp(x + (Math.random() - 0.5) * 12, -world.bounds + 8, world.bounds - 8);
      z = THREE.MathUtils.clamp(z + (Math.random() - 0.5) * 12, -world.bounds + 8, world.bounds - 8);
    }

    const model = createEnemyModel('boss');
    model.group.position.set(x, 0, z);
    scene.add(model.group);

    const flashMats: THREE.MeshStandardMaterial[] = [];
    model.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        flashMats.push(mesh.material as THREE.MeshStandardMaterial);
      }
    });

    const hp = Math.round((600 + st.wave * 150) * (1 + Math.max(0, st.wave - 5) * 0.03));
    enemies.current.push({
      id: spawnAttempt.current,
      model,
      pos: new THREE.Vector3(x, 0, z),
      home: new THREE.Vector3(x, 0, z),
      baseY: 0,
      hp,
      maxHp: hp,
      type: 'boss',
      speed: 2.5,
      attackTimer: 0,
      fireTimer: 0,
      bob: Math.random() * Math.PI * 2,
      phase: 0,
      wobble: Math.random() * Math.PI * 2,
      strafe: Math.random() > 0.5 ? 1 : -1,
      dead: false,
      deadT: 0,
      deathDir: 1,
      stagger: 0,
      engaged: true,
      flashT: 0,
      flashMats,
      ally: false,
      expiry: 0,
      slamCd: 2.8,
      slamT: 0,
      slamFired: false,
      volleyCd: 3.4,
      chargeCd: 5.5,
      chargeWind: 0,
      chargeT: 0,
      chargeX: 0,
      chargeZ: 0,
      contactCd: 0,
      bossStage: 0,
    });
    spawnAttempt.current++;
    st.setBoss({ active: true, name: 'THE WARDEN', hp, maxHp: hp, wave: st.wave, stage: 0 });
    spawnRing(new THREE.Vector3(x, 0.06, z), 5.5, 0xff8a4a);
    spawnRing(new THREE.Vector3(x, 0.08, z), 3.2, 0xffd479);
    sfx.bossRoar();
    shake.current = Math.min(1, shake.current + 0.8);
  }

  /* ---------------- run reset ---------------- */
  function resetCombat() {
    for (const e of enemies.current) {
      scene.remove(e.model.group);
      disposeObject(e.model.group);
    }
    enemies.current.length = 0;

    for (const p of projectiles.current) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    projectiles.current.length = 0;

    for (const fx of effects.current) {
      scene.remove(fx.obj);
      disposeEffect(fx);
    }
    effects.current.length = 0;

    pos.current.set(0, 0, 14);
    vel.current.set(0, 0, 0);
    vertVel.current = 0;
    grounded.current = true;
    airJumpsLeft.current = 1;
    landKick.current = 0;
    regenAcc.current = 0;
    guardianSeen.current = useGameStore.getState().guardianTick;
    classBuff.current = { dmg: 1, rate: 1, speed: 1, until: 0 };
    if (immortalWings.current) {
      player.torso.remove(immortalWings.current);
      immortalWings.current = null;
    }
    radarTimer.current = 0;
    nukeSeen.current = useGameStore.getState().nukeTick;
    yaw.current = 0;
    pitch.current = 0;
    lastYaw.current = 0;
    recoilPitch.current = 0;
    recoilYaw.current = 0;
    viewKick.current = 0;
    shake.current = 0;
    lookSway.current = 0;
    bob.current = 0;
    flashTimer.current = 0;
    reload.current.active = false;
    reload.current.t = 0;
    trigger.current.held = false;
    trigger.current.semi = false;
    nextShot.current = 0;
    raise.current = 1;
    wave.current = { index: 0, queue: 0, spawnTimer: 0, clearTimer: 0, cleared: false };
    for (const entry of activeVfx.current) {
      (entry.parent ?? scene).remove(entry.vfx.group);
      disposeSkillVfx(entry.vfx.group);
    }
    activeVfx.current = [];
    cast.current = null;
    swordCast.current = null;
    techniqueCast.current = null;
    dodge.current = null;
    for (const ghost of afterimages.current) {
      scene.remove(ghost.obj);
      ghost.mat.dispose();
    }
    afterimages.current = [];
    for (const marker of visionMarkers.current) {
      scene.remove(marker);
      (marker.material as THREE.Material).dispose();
      marker.geometry.dispose();
    }
    visionMarkers.current = [];
    for (const moon of moonMeshes.current) {
      scene.remove(moon);
      (moon.material as THREE.Material).dispose();
      moon.geometry.dispose();
    }
    moonMeshes.current = [];
    for (const spike of spikes.current) {
      scene.remove(spike.mesh);
      (spike.mesh.material as THREE.Material).dispose();
      spike.mesh.geometry.dispose();
    }
    spikes.current = [];
    blindUntil.current = 0;
    instinctVisionUntil.current = 0;
    bossSpawned.current = false;
    wave.current = { index: 0, queue: 0, spawnTimer: 0, clearTimer: 0, cleared: false };
    useGameStore.getState().setBoss({ active: false, name: '', hp: 0, maxHp: 0, wave: 0, stage: 0 });
    swordChain.current = { step: 0, lastAt: 0 };
    basicChain.current = { next: 1, lastAt: 0 };
    melee.current = { t: 99, dur: 0.36, combo: 1 };
  }

  /* ---------------- main loop ---------------- */
  useFrame((state, delta) => {
    const dt = Math.min(0.05, delta);
    const st = useGameStore.getState();
    if (st.runId !== lastRun.current) {
      lastRun.current = st.runId;
      resetCombat();
    }
    const playing = st.phase === 'playing';
    const w = getWeapon(st.equipped);
    const scoped = st.ads && w.optic === 'scope';
    const thirdActive = st.cameraMode === 'third' && !scoped;
    const maxHp = Math.round(100 + st.perks.hp * 10 + st.upgrades.maxHpBonus);
    const nowMs = performance.now();

    if (playing) {
      viewBlend.current = scoped
        ? 0
        : damp(viewBlend.current, thirdActive ? 1 : 0, 12, dt);
    } else {
      viewBlend.current = 0;
    }
    player.group.visible = playing;
    player.weaponRoot.visible = playing;
    player.body.visible = playing && !st.paused && viewBlend.current > 0.58;
    vm.root.visible = playing && !scoped && !st.paused && viewBlend.current < 0.12;
    if (!playing) {
      player.group.visible = false;
      player.body.visible = false;
      player.weaponRoot.visible = false;
    }

    if (!playing) {
      const t = state.clock.elapsedTime * 0.07;
      tmpV.set(Math.cos(t) * 33, 13.5, Math.sin(t) * 33);
      cam.position.lerp(tmpV, 1 - Math.exp(-dt * 1.6));
      cam.lookAt(0, 2.4, 0);
      if (Math.abs(cam.fov - 62) > 0.05) {
        cam.fov = damp(cam.fov, 62, 6, dt);
        cam.updateProjectionMatrix();
      }
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
      return;
    }

    if (st.paused) {
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
      return;
    }

    /* ---- skill cast timeline ---- */
    if (cast.current) {
      const elapsed = nowMs - cast.current.start;
      if (!cast.current.applied && elapsed >= 640) {
        cast.current.applied = true;
        applySkillImpact(cast.current.cls);
      }
      if (elapsed >= 3400) cast.current = null;
    }
    if (swordCast.current) {
      const elapsed = nowMs - swordCast.current.start;
      if (!swordCast.current.applied && elapsed >= swordCast.current.combo.cast) {
        swordCast.current.applied = true;
        applySwordImpact(swordCast.current);
      }
      if (elapsed >= swordCast.current.combo.cast + 620) swordCast.current = null;
    }
    if (techniqueCast.current) {
      const entry = techniqueCast.current;
      const elapsed = nowMs - entry.start;
      if (!entry.applied && elapsed >= TECH_IMPACT_MS[entry.kind]) {
        entry.applied = true;
        applyTechniqueImpact(entry);
      }
      if (elapsed >= TECH_CAST_MS[entry.kind] + 120) techniqueCast.current = null;
    }
    for (let i = afterimages.current.length - 1; i >= 0; i--) {
      const ghost = afterimages.current[i];
      ghost.life -= dt;
      ghost.mat.opacity = Math.max(0, ghost.life / ghost.max) * 0.28;
      ghost.obj.position.y += dt * 0.25;
      if (ghost.life <= 0) {
        scene.remove(ghost.obj);
        ghost.mat.dispose();
        afterimages.current.splice(i, 1);
      }
    }
    /* Red moons fade out. */
    for (let i = moonMeshes.current.length - 1; i >= 0; i--) {
      const moon = moonMeshes.current[i];
      moon.scale.setScalar(moon.scale.x + dt * 0.05);
      const mat = moon.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, mat.opacity - dt * 0.05);
      if (mat.opacity <= 0) {
        scene.remove(moon);
        mat.dispose();
        (moon.geometry as THREE.BufferGeometry).dispose();
        moonMeshes.current.splice(i, 1);
      }
    }
    /* Spikes rise and fade. */
    for (let i = spikes.current.length - 1; i >= 0; i--) {
      const spike = spikes.current[i];
      spike.life -= dt;
      spike.mesh.position.y += dt * 0.4;
      spike.mesh.rotation.y += dt * 4;
      (spike.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, spike.life / spike.max) * 0.9;
      if (spike.life <= 0) {
        scene.remove(spike.mesh);
        (spike.mesh.material as THREE.Material).dispose();
        spike.mesh.geometry.dispose();
        spikes.current.splice(i, 1);
      }
    }
    /* Instinct vision markers. */
    const visionActive = performance.now() < instinctVisionUntil.current;
    const visionTargets = visionActive
      ? enemies.current.filter((e) => !e.dead && !e.ally)
      : [];
    while (visionMarkers.current.length < visionTargets.length) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 8),
        new THREE.MeshBasicMaterial({
          color: 0x9fd8ff,
          transparent: true,
          opacity: 0.7,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      m.renderOrder = 999;
      scene.add(m);
      visionMarkers.current.push(m);
    }
    while (visionMarkers.current.length > visionTargets.length) {
      const m = visionMarkers.current.pop()!;
      scene.remove(m);
      (m.material as THREE.Material).dispose();
      m.geometry.dispose();
    }
    for (let i = 0; i < visionMarkers.current.length; i++) {
      const marker = visionMarkers.current[i];
      const e = visionTargets[i];
      marker.position.set(e.pos.x, e.baseY + 1.25, e.pos.z);
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 8 + i) * 0.25;
      marker.scale.setScalar(pulse);
      (marker.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(state.clock.elapsedTime * 6 + i) * 0.2;
    }
    const dodgeTick = st.instinctDodgeTick;
    if (dodgeTick !== dodgeSeen.current) {
      dodgeSeen.current = dodgeTick;
      spawnRing(new THREE.Vector3(pos.current.x, 0.65, pos.current.z), 2.4, 0x9fd8ff);
      sfx.perfectDodge();
      shake.current = Math.min(1, shake.current + 0.18);
    }
    for (let i = activeVfx.current.length - 1; i >= 0; i--) {
      const entry = activeVfx.current[i];
      const elapsed = nowMs - entry.start;
      if (elapsed < 0) {
        entry.vfx.group.visible = false;
        continue;
      }
      const p = Math.min(1, elapsed / entry.dur);
      entry.vfx.update(p, elapsed / 1000);
      if (p >= 1) {
        (entry.parent ?? scene).remove(entry.vfx.group);
        disposeSkillVfx(entry.vfx.group);
        activeVfx.current.splice(i, 1);
      }
    }

    /* ---- persistent V4 awakening (owner inspection) ---- */
    if (st.v4Awakening) {
      if (!persistentAura.current || persistentAura.current.cls !== st.classId) {
        if (persistentAura.current) {
          player.group.remove(persistentAura.current.vfx.group);
          disposeSkillVfx(persistentAura.current.vfx.group);
        }
        const cls = getPlayerClass(st.classId);
        const override = cls.id === 'ghoul' ? 0x1a0a0a : undefined;
        const aura = createClassAura(cls.skill.kind, cls.id, cls.color, override);
        if (cls.id === 'ghoul') {
          const darkSphere = new THREE.Mesh(
            new THREE.SphereGeometry(1.6, 18, 12),
            new THREE.MeshBasicMaterial({
              color: 0x1a0a0a,
              transparent: true,
              opacity: 0.35,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              side: THREE.BackSide,
            }),
          );
          aura.group.add(darkSphere);
        }
        player.group.add(aura.group);
        persistentAura.current = { vfx: aura, cls: st.classId };
      }
      persistentAura.current.vfx.update(0.5, nowMs / 1000);
    } else if (persistentAura.current) {
      player.group.remove(persistentAura.current.vfx.group);
      disposeSkillVfx(persistentAura.current.vfx.group);
      persistentAura.current = null;
    }

    /* ---- movement ---- */
    const forward = tmpV.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = tmpV2.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    const wish = tmpV3.set(0, 0, 0);
    if (keys.current.has('w')) wish.add(forward);
    if (keys.current.has('s')) wish.sub(forward);
    if (keys.current.has('d')) wish.add(right);
    if (keys.current.has('a')) wish.sub(right);
    const moving = wish.lengthSq() > 0.001;
    if (moving) wish.normalize();

    const cls = getPlayerClass(st.classId);
    const buffActive = performance.now() < classBuff.current.until;
    const classSpeed = cls.id === 'assassin' ? 1.12 : cls.id === 'berserk' ? 1.05 : 1;
    const classBuffSpeed = buffActive ? classBuff.current.speed : 1;
    const flying = st.flyMode;
    const sprinting =
      keys.current.has('shift') && moving && !st.ads && (flying || grounded.current);
    const speedBase =
      5.4 *
      st.upgrades.speed *
      (1 + st.perks.speed * 0.02) *
      classSpeed *
      classBuffSpeed *
      (st.ads ? 0.62 : 1);

    if (flying) {
      /* Owner flight: camera-relative 3D movement, Space up, C down, Shift
         boost. Noclip additionally releases the arena bounds. */
      const pitchCos = Math.cos(pitch.current);
      const fwdX = -Math.sin(yaw.current) * pitchCos;
      const fwdY = Math.sin(pitch.current);
      const fwdZ = -Math.cos(yaw.current) * pitchCos;
      let wishX = 0;
      let wishY = 0;
      let wishZ = 0;
      if (keys.current.has('w')) {
        wishX += fwdX;
        wishY += fwdY;
        wishZ += fwdZ;
      }
      if (keys.current.has('s')) {
        wishX -= fwdX;
        wishY -= fwdY;
        wishZ -= fwdZ;
      }
      if (keys.current.has('d')) {
        wishX += right.x;
        wishZ += right.z;
      }
      if (keys.current.has('a')) {
        wishX -= right.x;
        wishZ -= right.z;
      }
      const len = Math.hypot(wishX, wishY, wishZ);
      if (len > 0.001) {
        wishX /= len;
        wishY /= len;
        wishZ /= len;
      }
      let lift = 0;
      if (keys.current.has(' ')) lift += 1;
      if (keys.current.has('c')) lift -= 1;
      const flySpeed = speedBase * 2.25 * (sprinting ? 1.55 : 1);
      vel.current.x = damp(vel.current.x, wishX * flySpeed, 9, dt);
      vel.current.z = damp(vel.current.z, wishZ * flySpeed, 9, dt);
      pos.current.x += vel.current.x * dt;
      pos.current.z += vel.current.z * dt;
      pos.current.y = THREE.MathUtils.clamp(
        pos.current.y + (wishY * flySpeed + lift * flySpeed * 0.92) * dt,
        0,
        42,
      );
      if (!st.noclip) {
        resolveCollisions(pos.current, PLAYER_RADIUS, world.colliders, world.bounds, pos.current.y);
      }
      grounded.current = false;
      vertVel.current = 0;
    } else {
      const maxSpeed = speedBase * (sprinting ? 1.42 : 1);
      const accel = moving ? (grounded.current ? 28 : 9) : grounded.current ? 12 : 2.6;
      vel.current.x = damp(vel.current.x, wish.x * maxSpeed, accel, dt);
      vel.current.z = damp(vel.current.z, wish.z * maxSpeed, accel, dt);
      pos.current.x += vel.current.x * dt;
      pos.current.z += vel.current.z * dt;
      if (!st.noclip) {
        resolveCollisions(pos.current, PLAYER_RADIUS, world.colliders, world.bounds, pos.current.y);
      }

      /* ---- vertical physics ---- */
      const supportHeight = (feetX: number, feetZ: number, y: number) => {
        let top = 0;
        for (const b of world.colliders) {
          if (feetX < b.min.x - 0.3 || feetX > b.max.x + 0.3) continue;
          if (feetZ < b.min.z - 0.3 || feetZ > b.max.z + 0.3) continue;
          if (b.max.y > top && b.max.y <= y + 0.45) top = b.max.y;
        }
        return top;
      };
      if (!grounded.current) {
        vertVel.current -= GRAVITY * dt;
        if (st.classId === 'immortal' && keys.current.has(' ')) {
          vertVel.current = Math.min(6, vertVel.current + 18 * dt);
        }
        pos.current.y += vertVel.current * dt;
        const top = supportHeight(pos.current.x, pos.current.z, pos.current.y);
        if (vertVel.current <= 0 && top > 0 && pos.current.y <= top + 0.12) {
          pos.current.y = top;
          vertVel.current = 0;
          grounded.current = true;
          airJumpsLeft.current = st.upgrades.airJumps;
        }
        if (pos.current.y <= 0) {
          const impact = -vertVel.current;
          pos.current.y = 0;
          vertVel.current = 0;
          grounded.current = true;
          airJumpsLeft.current = st.upgrades.airJumps;
          if (impact > 4.4) {
            landKick.current = Math.min(0.16, impact * 0.012);
            sfx.land(Math.min(1, impact / 15));
            if (impact > 8)
              spawnRing(new THREE.Vector3(pos.current.x, 0.06, pos.current.z), 1.4);
          }
        }
      } else {
        const top = supportHeight(pos.current.x, pos.current.z, pos.current.y);
        if (top > 0) {
          pos.current.y = top;
        } else {
          pos.current.y = 0;
        }
        vertVel.current = 0;
        /* Walk off a box: start falling. */
        const stillSupported = supportHeight(pos.current.x, pos.current.z, pos.current.y + 0.1) > 0 || pos.current.y <= 0.05;
        if (!stillSupported) {
          grounded.current = false;
        }
      }
    }

    /* ---- instinct dash ---- */
    if (dodge.current) {
      const d = dodge.current;
      const progress = (nowMs - d.start) / d.dur;
      if (progress < 1) {
        const burst = Math.pow(1 - Math.max(0, progress), 1.35);
        pos.current.x += d.dir.x * 20 * burst * dt;
        pos.current.z += d.dir.z * 20 * burst * dt;
        if (!st.noclip) {
          resolveCollisions(pos.current, PLAYER_RADIUS, world.colliders, world.bounds, pos.current.y);
        }
        d.nextGhost -= dt * 1000;
        if (d.ghosts < 3 && d.nextGhost <= 0) {
          spawnAfterimage();
          d.ghosts++;
          d.nextGhost = 88;
        }
      } else {
        dodge.current = null;
      }
    }

    const speedNow = Math.hypot(vel.current.x, vel.current.z);
    if (speedNow > 0.4 && grounded.current) bob.current += dt * (sprinting ? 13 : 9);

    /* ---- divine survival pulse ---- */
    if (st.guardianTick !== guardianSeen.current) {
      guardianSeen.current = st.guardianTick;
      const center = new THREE.Vector3(pos.current.x, 0, pos.current.z);
      spawnRing(new THREE.Vector3(pos.current.x, 0.08, pos.current.z), 8, 0xffd479);
      sfx.guardian();
      shake.current = Math.min(1, shake.current + 0.9);
      for (const e of enemies.current) {
        if (e.dead || e.pos.distanceTo(center) > 8) continue;
        damageEnemy(
          e,
          90,
          false,
          new THREE.Vector3(e.pos.x, e.baseY + 1.2, e.pos.z),
          true,
        );
      }
    }

    /* ---- relic regeneration ---- */
    if (st.upgrades.regen > 0 && st.hp > 0 && st.hp < maxHp) {
      regenAcc.current += dt * st.upgrades.regen;
      if (regenAcc.current >= 1) {
        const amount = Math.floor(regenAcc.current);
        regenAcc.current -= amount;
        useGameStore.getState().healPlayer(amount);
      }
    } else {
      regenAcc.current = 0;
    }

    /* ---- weapon state ---- */
    if (reload.current.active) {
      reload.current.t += dt;
      if (reload.current.t >= reload.current.dur) {
        reload.current.active = false;
        const mag = Math.min(w.mag, st.ammo + st.reserve);
        const used = mag - st.ammo;
        st.setAmmo(mag, Math.max(0, st.reserve - used));
        st.setReloading(false);
      }
    }

    if (raise.current > 0) raise.current = Math.max(0, raise.current - dt * 2.6);

    /* ---- firing ---- */
    if (w.kind !== 'sword' && st.ammo <= 0 && !reload.current.active && st.reserve > 0) {
      startReload();
    }
    const wantFire =
      w.kind === 'sword'
        ? trigger.current.held || trigger.current.semi
        : w.auto
          ? trigger.current.held
          : trigger.current.semi;
    if (wantFire) {
      if (w.kind === 'sword') meleeAttack(performance.now());
      else fireShot(performance.now());
      if (!w.auto) trigger.current.semi = false;
    }

    /* ---- viewmodel ---- */
    const adsBlend = st.ads ? 1 : 0;
    const basePos = tmpV.copy(vm.hipPos).lerp(vm.adsPos, adsBlend);
    const baseRot = { x: THREE.MathUtils.lerp(vm.hipRot.x, vm.adsRot.x, adsBlend), y: THREE.MathUtils.lerp(vm.hipRot.y, vm.adsRot.y, adsBlend), z: THREE.MathUtils.lerp(vm.hipRot.z, vm.adsRot.z, adsBlend) };
    const bobAmt = grounded.current ? Math.min(1, speedNow / 5.4) : 0.18;
    const reloadT = reload.current.active ? reload.current.t / reload.current.dur : 0;
    const reloadDip = reload.current.active ? Math.sin(Math.min(1, reloadT) * Math.PI) : 0;

    const yawDelta = yaw.current - lastYaw.current;
    lastYaw.current = yaw.current;
    lookSway.current = damp(lookSway.current, THREE.MathUtils.clamp(-yawDelta * 8, -0.06, 0.06), 10, dt);

    vm.root.position.x = basePos.x + Math.cos(bob.current) * 0.006 * bobAmt + lookSway.current * 0.4 + (1 - adsBlend) * Math.sin(state.clock.elapsedTime * 1.4) * 0.003;
    vm.root.position.y = basePos.y + Math.abs(Math.sin(bob.current)) * 0.008 * bobAmt - viewKick.current * 0.012 - reloadDip * 0.09 - raise.current * 0.22 - landKick.current * 0.5;
    vm.root.position.z = basePos.z + viewKick.current * 0.05;
    vm.root.rotation.x = baseRot.x + viewKick.current * 0.16 + reloadDip * 0.5 + (1 - adsBlend) * Math.sin(bob.current) * 0.006;
    vm.root.rotation.y = baseRot.y + lookSway.current;
    vm.root.rotation.z = baseRot.z + Math.sin(bob.current * 0.5) * 0.012 * bobAmt + reloadDip * 0.35 + (1 - adsBlend) * Math.cos(state.clock.elapsedTime * 0.9) * 0.004;

    viewKick.current = damp(viewKick.current, 0, 14, dt);
    recoilPitch.current = damp(recoilPitch.current, 0, 7, dt);
    recoilYaw.current = damp(recoilYaw.current, 0, 7, dt);
    shake.current = damp(shake.current, 0, 9, dt);
    landKick.current = damp(landKick.current, 0, 10, dt);

    flashTimer.current = Math.max(0, flashTimer.current - dt);
    if (flashTimer.current > 0) {
      vm.flash.visible = true;
      vm.flash.rotation.z = Math.random() * Math.PI;
      const s = 0.8 + Math.random() * 0.6;
      vm.flash.scale.setScalar(s);
      vm.flashLight.intensity = 26;
    } else {
      vm.flash.visible = false;
      vm.flashLight.intensity = 0;
    }

    /* ---- third-person operator ---- */
    melee.current.t += dt;
    const castNow = cast.current;
    const castElapsed = castNow ? Math.max(0, (nowMs - castNow.start) / 1000) : 0;
    const techniqueNow = techniqueCast.current;
    const techniqueElapsed = techniqueNow ? Math.max(0, (nowMs - techniqueNow.start) / 1000) : 0;
    const dodgeNow = dodge.current;
    const dodgeElapsed = dodgeNow ? Math.max(0, (nowMs - dodgeNow.start) / 1000) : 0;
    player.group.position.copy(pos.current);
    player.group.rotation.y = yaw.current;
    /* Immortal wings. */
    if (st.classId === 'immortal') {
      if (!immortalWings.current) {
        const wings = new THREE.Group();
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0xd8c7a3,
          transparent: true,
          opacity: 0.62,
          side: THREE.DoubleSide,
          emissive: 0x8a7a5a,
          emissiveIntensity: 0.45,
        });
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2, 5, 5), wingMat);
          wing.position.set(side * 0.4, 1.3, 0.2);
          wing.rotation.y = side * 0.7;
          wing.rotation.x = 0.25;
          wing.rotation.z = side * -0.15;
          wings.add(wing);
        }
        player.torso.add(wings);
        immortalWings.current = wings;
      }
      const flap = Math.sin(state.clock.elapsedTime * 4) * 0.18;
      immortalWings.current.children.forEach((w, i) => {
        w.rotation.x = 0.25 + (i === 0 ? flap : -flap);
      });
    } else if (immortalWings.current) {
      player.torso.remove(immortalWings.current);
      immortalWings.current = null;
    }
    animatePlayer(player, {
      dt,
      time: state.clock.elapsedTime,
      speed: speedNow,
      grounded: grounded.current,
      ads: st.ads,
      reloading: reload.current.active,
      recoil: viewKick.current,
      meleeT: melee.current.t,
      meleeDur: melee.current.dur,
      meleeCombo: melee.current.combo,
      castT: castNow ? castElapsed : 0,
      castDur: 3.2,
      castKind: castNow ? castNow.cls.skill.kind : null,
      techniqueT: techniqueNow ? techniqueElapsed : 0,
      techniqueDur: techniqueNow ? TECH_CAST_MS[techniqueNow.kind] / 1000 : 0,
      techniqueKind: techniqueNow ? techniqueNow.kind : null,
      dodgeT: dodgeNow ? dodgeElapsed : 0,
      dodgeDur: dodgeNow ? dodgeNow.dur / 1000 : 0,
      dodgeSide: dodgeNow ? dodgeNow.side : 0,
      pitch: pitch.current,
    });

    /* ---- camera ---- */
    const shakeAmt = shake.current * 0.012;
    const bobY = Math.abs(Math.sin(bob.current)) * 0.022 * bobAmt;
    const eyeY = pos.current.y + EYE + bobY - landKick.current;
    const blend = viewBlend.current;
    const camDirX = -Math.sin(yaw.current) * Math.cos(pitch.current);
    const camDirY = Math.sin(pitch.current);
    const camDirZ = -Math.cos(yaw.current) * Math.cos(pitch.current);
    let orbitDist = THREE.MathUtils.lerp(5.15, 2.5, adsBlend) * blend;
    if (blend > 0.2) {
      const wall = rayWorld(
        world,
        tmpV.set(pos.current.x, eyeY, pos.current.z),
        tmpV2.set(-camDirX, -camDirY, -camDirZ),
      );
      orbitDist = Math.min(orbitDist, Math.max(0.5, wall - 0.3));
    }
    const shoulder = adsBlend * 0.52 * blend;
    cam.position.set(
      pos.current.x - camDirX * orbitDist + Math.cos(yaw.current) * shoulder + (Math.random() - 0.5) * shakeAmt,
      Math.max(
        0.34,
        eyeY - camDirY * orbitDist + 0.12 * blend + (Math.random() - 0.5) * shakeAmt,
      ),
      pos.current.z - camDirZ * orbitDist - Math.sin(yaw.current) * shoulder + (Math.random() - 0.5) * shakeAmt,
    );
    cam.rotation.order = 'YXZ';
    cam.rotation.y = yaw.current + recoilYaw.current;
    cam.rotation.x = pitch.current + recoilPitch.current + (Math.random() - 0.5) * shakeAmt;
    cam.rotation.z = (Math.random() - 0.5) * shakeAmt * 0.4;
    const firstFov = st.ads ? w.adsFov : sprinting ? 74 : 68;
    const thirdFov = st.ads ? Math.max(52, w.adsFov) : sprinting ? 74 : 68;
    const targetFov = THREE.MathUtils.lerp(firstFov, thirdFov, blend);
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov = damp(cam.fov, targetFov, 13, dt);
      cam.updateProjectionMatrix();
    }

    /* ---- wave control ---- */
    const wv = wave.current;
    if (wv.index !== st.wave) {
      wv.index = st.wave;
      const bossWave = st.wave % 5 === 0;
      wv.queue = bossWave ? Math.min(10, 1 + Math.floor(st.wave / 5)) : Math.min(26, 5 + st.wave * 2);
      wv.spawnTimer = 1.1;
      wv.cleared = false;
      wv.clearTimer = 0;
      bossSpawned.current = false;
      st.setEnemiesLeft(wv.queue + (bossWave ? 1 : 0));
    }
    if (st.wave % 5 === 0 && !bossSpawned.current) {
      bossSpawned.current = true;
      spawnBoss();
    }
    if (wv.queue > 0) {
      wv.spawnTimer -= dt;
      if (wv.spawnTimer <= 0) {
        spawnEnemy();
        wv.queue--;
        wv.spawnTimer = Math.max(0.4, 1.05 - st.wave * 0.03);
      }
    } else if (!wv.cleared) {
      const alive = enemies.current.some((e) => !e.dead && !e.ally);
      if (!alive) {
        wv.cleared = true;
        wv.clearTimer = 1.5;
        st.addEarned(45 + st.wave * 15);
        sfx.waveClear();
      }
    }
    if (wv.cleared) {
      wv.clearTimer -= dt;
      if (wv.clearTimer <= 0 && useGameStore.getState().phase === 'playing') {
        useGameStore.getState().prepareUpgrades();
      }
    }

    /* ---- enemies ---- */
    const now = state.clock.elapsedTime;
    const cloaked = performance.now() < cloakUntil.current;
    for (let i = enemies.current.length - 1; i >= 0; i--) {
      const e = enemies.current[i];
      if (e.dead) {
        e.deadT += dt;
        /* Body physics on death: a shove-driven topple with a short
           impact bounce, then the corpse settles and fades. */
        const fall = Math.min(1, e.deadT * 3.3);
        const bounce = Math.max(0, Math.sin(e.deadT * 12)) * Math.exp(-e.deadT * 5.5);
        e.model.group.rotation.x = THREE.MathUtils.lerp(0, Math.PI / 2, fall) * 0.75;
        e.model.group.rotation.z = -e.deathDir * THREE.MathUtils.lerp(0, Math.PI / 2, fall);
        e.model.group.position.x = e.pos.x + e.deathDir * fall * 0.18;
        e.model.group.position.y = -0.1 * fall + bounce * 0.07;
        e.model.group.position.z = e.pos.z;
        if (e.model.legL) {
          e.model.legL.rotation.x = fall * 0.35;
          e.model.legR.rotation.x = -fall * 0.25;
        }
        if (e.deadT > 2.2) {
          scene.remove(e.model.group);
          disposeObject(e.model.group);
          enemies.current.splice(i, 1);
        }
        continue;
      }

      e.stagger = Math.max(0, e.stagger - dt * 1.7);
      e.bob += dt * (e.type === 'drone' ? 2.6 : 7);
      e.phase += dt * speedNow * 0.2;
      e.wobble += dt * (e.engaged ? 0.7 : 0.38);

      const target = tmpV.set(pos.current.x - e.pos.x, 0, pos.current.z - e.pos.z);
      const dist = target.length();
      if (dist > 0.001) target.divideScalar(dist);
      /* Proximity aggro: patrols stay passive until the operator crosses
         their reaction radius. Damage still forces an immediate engage. */
      if (!e.engaged && !cloaked && dist < 8.5 && Math.abs(pos.current.y - e.baseY) < 5.5) {
        e.engaged = true;
        spawnRing(
          new THREE.Vector3(e.pos.x, e.baseY + 0.07, e.pos.z),
          1.55,
          0xff8a5c,
        );
        if (nowMs > aggroSoundAt.current) {
          sfx.alert();
          aggroSoundAt.current = nowMs + 280;
        }
      }
      const immortalStun = !e.ally && st.classId === 'immortal' && dist < 6;
      if (immortalStun) {
        e.engaged = false;
        e.stagger = Math.max(e.stagger, 1.35);
      }
      /* Cloak cuts their tracking entirely for as long as it lasts. */
      const blinded = !e.ally && performance.now() < blindUntil.current;
      if (blinded) {
        e.engaged = false;
        e.fireTimer = Math.max(e.fireTimer, 2);
      }
      const engage = e.engaged && !cloaked;
      let face = e.type === 'drone' ? Math.atan2(target.x, target.z) : e.model.group.rotation.y;

      let moveX = 0;
      let moveZ = 0;

      if (!engage) {
        /* Unaware patrol: slow drift around the spawn point so the arena
           still feels occupied without a conga line hunting the player. */
        const anchor = e.engaged ? e.pos : e.home;
        const radius = e.engaged ? 1.1 : 2.6;
        const wx = anchor.x + Math.cos(e.wobble) * radius;
        const wz = anchor.z + Math.sin(e.wobble * 0.77) * radius;
        const dx = wx - e.pos.x;
        const dz = wz - e.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.2) {
          moveX = (dx / d) * e.speed * 0.24;
          moveZ = (dz / d) * e.speed * 0.24;
          face = Math.atan2(dx, dz);
        }
        if (e.type === 'drone') {
          e.model.group.rotation.z = THREE.MathUtils.damp(e.model.group.rotation.z, 0, 3, dt);
        } else {
          face += Math.sin(e.wobble * 0.5) * 0.28;
        }
        e.fireTimer = Math.min(e.fireTimer, 1.4);
      } else if (e.type === 'grunt') {
        if (dist > 1.5) {
          moveX = target.x * e.speed;
          moveZ = target.z * e.speed;
        }
        face = Math.atan2(target.x, target.z);
        e.attackTimer -= dt;
        if (dist < 1.9 && e.attackTimer <= 0 && pos.current.y < 1.2) {
          e.attackTimer = 0.95;
          st.damagePlayer(11 + st.wave);
          shake.current = Math.min(1, shake.current + 0.5);
          sfx.hurt();
        }
      } else if (e.type === 'rifleman') {
        const preferred = 13;
        const radial = dist > preferred + 2 ? 1 : dist < preferred - 2 ? -1 : 0;
        moveX = target.x * e.speed * radial + -target.z * e.strafe * 0.9;
        moveZ = target.z * e.speed * radial + target.x * e.strafe * 0.9;
        face = Math.atan2(target.x, target.z);
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && dist < 34) {
          e.fireTimer = 2.1 + Math.random() * 1.3;
          spawnEnemyProjectile(e, 8 + st.wave);
        }
      } else if (e.type === 'boss') {
        face = Math.atan2(target.x, target.z);
        const enraged = e.bossStage > 0;
        e.contactCd = Math.max(0, e.contactCd - dt);

        if (e.slamT > 0) {
          /* Telegraph, then a full radial ground break. */
          e.slamT -= dt;
          if (e.slamT <= 0 && !e.slamFired) {
            e.slamFired = true;
            const ground = new THREE.Vector3(e.pos.x, 0.07, e.pos.z);
            spawnRing(ground, 5.6, 0xff9a4a);
            spawnRing(ground, 3.4, 0xffd479);
            spawnBlast(new THREE.Vector3(e.pos.x, 1.4, e.pos.z));
            if (dist < 6.2 && Math.abs(pos.current.y - e.baseY) < 2.4) {
              st.damagePlayer(24 + st.wave * 2);
              sfx.hurt();
            }
            shake.current = Math.min(1, shake.current + 0.95);
            sfx.bossSlam();
          }
        } else if (e.chargeWind > 0) {
          e.chargeWind -= dt;
          if (e.chargeWind <= 0) {
            e.chargeT = 0.62;
            e.chargeX = target.x;
            e.chargeZ = target.z;
            spawnRing(new THREE.Vector3(e.pos.x, 0.07, e.pos.z), 2.8, 0xff5b3d);
            sfx.alert();
          }
        } else if (e.chargeT > 0) {
          e.chargeT -= dt;
          moveX = e.chargeX * 15;
          moveZ = e.chargeZ * 15;
          if (dist < 3.1 && e.contactCd <= 0) {
            e.contactCd = 1.15;
            st.damagePlayer(18 + st.wave * 1.5);
            shake.current = Math.min(1, shake.current + 0.6);
            sfx.hurt();
            spawnBlast(new THREE.Vector3(pos.current.x, pos.current.y + 1.2, pos.current.z));
          }
        } else {
          e.slamCd -= dt;
          e.volleyCd -= dt;
          e.chargeCd -= dt;
          const radial = dist > 9.5 ? 1 : dist < 5 ? -1 : 0;
          moveX = target.x * e.speed * radial + -target.z * e.strafe * 1.2;
          moveZ = target.z * e.speed * radial + target.x * e.strafe * 1.2;

          if (e.slamCd <= 0 && dist < 7) {
            e.slamT = 0.72;
            e.slamFired = false;
            e.slamCd = (enraged ? 3.6 : 5.0) + Math.random() * 1.4;
            spawnRing(new THREE.Vector3(e.pos.x, 0.07, e.pos.z), 2.6, 0xffb066);
            sfx.bossRoar();
          } else if (e.chargeCd <= 0 && dist > 7.5) {
            e.chargeWind = 0.62;
            e.chargeCd = enraged ? 5.5 : 7.5;
            spawnRing(new THREE.Vector3(e.pos.x, 0.07, e.pos.z), 2.2, 0xff5b3d);
            sfx.alert();
          } else if (e.volleyCd <= 0 && dist < 32) {
            e.volleyCd = enraged ? 2.5 : 3.7;
            const shots = enraged ? 5 : 3;
            for (let shot = 0; shot < shots; shot++) {
              spawnEnemyProjectile(e, 8 + st.wave * 1.2, 0.02 + shot * 0.025);
            }
          }
        }
      } else if (e.ally) {
        /* Summoned shamblers hunt the nearest hostile. */
        let targetEnemy: EnemyInst | null = null;
        let best = 18 * 18;
        for (const other of enemies.current) {
          if (other === e || other.dead || other.ally) continue;
          const d = other.pos.distanceToSquared(e.pos);
          if (d < best) {
            best = d;
            targetEnemy = other;
          }
        }
        if (targetEnemy) {
          const dx = targetEnemy.pos.x - e.pos.x;
          const dz = targetEnemy.pos.z - e.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          if (d > 1.15) {
            moveX = (dx / d) * e.speed;
            moveZ = (dz / d) * e.speed;
          }
          face = Math.atan2(dx, dz);
          e.attackTimer -= dt;
          if (d < 1.35 && e.attackTimer <= 0) {
            e.attackTimer = 1.1;
            damageEnemy(
              targetEnemy,
              16,
              false,
              new THREE.Vector3(targetEnemy.pos.x, targetEnemy.baseY + 1.2, targetEnemy.pos.z),
            );
          }
        }
        if (performance.now() > e.expiry) {
          e.dead = true;
          e.deadT = 0;
          e.deathDir = 1;
        }
      } else {
        const preferred = 11;
        const radial = dist > preferred + 2 ? 1 : dist < preferred - 2 ? -1 : 0;
        moveX = target.x * e.speed * radial * 0.8 + -target.z * e.strafe * 1.3;
        moveZ = target.z * e.speed * radial * 0.8 + target.x * e.strafe * 1.3;
        face = Math.atan2(target.x, target.z);
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && dist < 30) {
          e.fireTimer = 2.6 + Math.random() * 1.2;
          spawnEnemyProjectile(e, 6 + st.wave);
          spawnEnemyProjectile(e, 6 + st.wave, 0.05);
        }
      }

      /* Stagger briefly kills their footwork after taking a hit. */
      const staggerMul = Math.max(0.18, 1 - e.stagger * 2.6);
      moveX *= staggerMul;
      moveZ *= staggerMul;

      // separation
      for (const other of enemies.current) {
        if (other === e || other.dead) continue;
        const dx = e.pos.x - other.pos.x;
        const dz = e.pos.z - other.pos.z;
        const d2 = dx * dx + dz * dz;
        const gap = e.type === 'boss' || other.type === 'boss' ? 3.1 : 1.6;
        if (d2 < gap * gap && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          moveX += (dx / d) * (e.type === 'boss' ? 2.2 : 1.3);
          moveZ += (dz / d) * (e.type === 'boss' ? 2.2 : 1.3);
        }
      }

      e.pos.x += moveX * dt;
      e.pos.z += moveZ * dt;
      resolveCollisions(e.pos, e.type === 'boss' ? 0.95 : 0.5, world.colliders, world.bounds);

      const bob = Math.sin(e.bob) * 0.03;
      const lean = Math.min(0.55, e.stagger * 1.8);
      const modelY = e.type === 'drone' ? e.baseY + Math.sin(e.bob) * 0.25 : bob;
      e.model.group.position.set(e.pos.x, modelY, e.pos.z);
      const faceDelta = Math.atan2(
        Math.sin(face - e.model.group.rotation.y),
        Math.cos(face - e.model.group.rotation.y),
      );
      e.model.group.rotation.y += faceDelta * Math.min(1, dt * 7);
      if (e.type === 'drone') {
        e.model.group.rotation.z = -target.x * 0.12;
        const ring = e.model.ring;
        if (ring) ring.rotation.z += dt * 2.2;
      } else if (e.type === 'boss') {
        const bob = Math.sin(e.bob) * 0.03;
        const modelY = bob;
        e.model.group.position.y = modelY;
        const enraged = e.bossStage > 0;
        const swing = Math.sin(e.bob) * 0.18 * Math.min(1, Math.hypot(moveX, moveZ) / 4);
        e.model.legL.rotation.x = THREE.MathUtils.damp(
          e.model.legL.rotation.x,
          swing + (e.chargeT > 0 ? 0.55 : 0),
          12,
          dt,
        );
        e.model.legR.rotation.x = THREE.MathUtils.damp(
          e.model.legR.rotation.x,
          -swing + (e.chargeT > 0 ? 0.55 : 0),
          12,
          dt,
        );
        const torsoPitch = e.slamT > 0 ? -0.34 * (1 - e.slamT / 0.72) : 0;
        e.model.torso.rotation.x = THREE.MathUtils.damp(e.model.torso.rotation.x, torsoPitch, 10, dt);
        e.model.torso.rotation.z = THREE.MathUtils.damp(
          e.model.torso.rotation.z,
          Math.sin(e.bob * 0.5) * 0.02 + (enraged ? Math.sin(state.clock.elapsedTime * 4) * 0.04 : 0),
          10,
          dt,
        );
        const armTarget = e.slamT > 0 ? -2.5 : e.chargeT > 0 ? 0.85 : -0.08 + Math.sin(e.bob * 0.5) * 0.05;
        if (e.model.armL) e.model.armL.rotation.x = THREE.MathUtils.damp(e.model.armL.rotation.x, armTarget, 14, dt);
        if (e.model.armR) e.model.armR.rotation.x = THREE.MathUtils.damp(e.model.armR.rotation.x, armTarget, 14, dt);
        if (e.model.armL) e.model.armL.rotation.z = THREE.MathUtils.damp(e.model.armL.rotation.z, -0.12, 10, dt);
        if (e.model.armR) e.model.armR.rotation.z = THREE.MathUtils.damp(e.model.armR.rotation.z, 0.12, 10, dt);
        if (e.model.weapon) {
          e.model.weapon.rotation.z = THREE.MathUtils.damp(
            e.model.weapon.rotation.z,
            -0.24 + Math.sin(e.bob * 0.7) * 0.05,
            9,
            dt,
          );
        }
        if (e.model.core) {
          const coreScale = 1 + Math.sin(state.clock.elapsedTime * (enraged ? 8 : 4)) * 0.12;
          e.model.core.scale.setScalar(coreScale);
          const mat = e.model.core.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.6 + Math.sin(state.clock.elapsedTime * 6) * 0.25 + (enraged ? 0.15 : 0);
          mat.color.setHex(enraged ? 0xff5b3d : 0xffb347);
        }
        if (e.model.cape) {
          e.model.cape.rotation.z = Math.sin(state.clock.elapsedTime * 2 + e.bob) * 0.08;
          e.model.cape.rotation.x = 0.08 + Math.sin(state.clock.elapsedTime * 1.4) * 0.06;
        }
        const ring = e.model.ring;
        if (ring) ring.rotation.z += dt * 1.4;
      } else {
        const swing = Math.sin(e.bob) * 0.5 * Math.min(1, Math.hypot(moveX, moveZ) / 3);
        e.model.legL.rotation.x = swing;
        e.model.legR.rotation.x = -swing;
        e.model.torso.rotation.z = Math.sin(e.bob * 0.5) * 0.02 + lean * -e.deathDir;
        e.model.torso.rotation.x = lean * 0.6 + (e.stagger > 0.8 ? 0.65 : 0);
      }
      e.flashT = Math.max(0, e.flashT - dt);
      const flashColor = e.flashT > 0 ? 0x7a2a15 : 0x000000;
      for (const mat of e.flashMats) mat.emissive.setHex(flashColor);
      void now;
    }

    /* ---- owner nuke ---- */
    const cheatState = useGameStore.getState();
    if (cheatState.nukeTick !== nukeSeen.current) {
      nukeSeen.current = cheatState.nukeTick;
      const origin = new THREE.Vector3(pos.current.x, 0.1, pos.current.z);
      spawnRing(origin, 22, 0xfff0b0);
      spawnBlast(new THREE.Vector3(pos.current.x, pos.current.y + 1.4, pos.current.z));
      sfx.shockwave();
      sfx.kill();
      shake.current = Math.min(1, shake.current + 1);
      for (const e of enemies.current) {
        if (e.dead) continue;
        if (e.ally) continue;
        e.engaged = true;
        damageEnemy(e, 9999, false, new THREE.Vector3(e.pos.x, e.baseY + 1.2, e.pos.z), true);
      }
    }

    /* ---- enemy scan feed ---- */
    radarTimer.current -= dt;
    if (radarTimer.current <= 0) {
      radarTimer.current = 0.12;
      useGameStore.getState().setRadar({
        x: pos.current.x,
        z: pos.current.z,
        yaw: yaw.current,
        bounds: world.bounds,
        blips: enemies.current
          .filter((e) => !e.dead && !e.ally)
          .map((e) => ({
            id: e.id,
            x: e.pos.x,
            z: e.pos.z,
            kind: e.type,
            engaged: e.engaged,
          })),
      });
    }

    /* ---- enemy projectiles ---- */
    for (let i = projectiles.current.length - 1; i >= 0; i--) {
      const p = projectiles.current[i];
      p.mesh.position.addScaledVector(p.vel, dt);
      p.life -= dt;
      const chest = tmpV.set(pos.current.x, pos.current.y + 1.2, pos.current.z);
      if (p.mesh.position.distanceTo(chest) < 0.62) {
        st.damagePlayer(p.dmg);
        shake.current = Math.min(1, shake.current + 0.35);
        sfx.hurt();
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        projectiles.current.splice(i, 1);
        continue;
      }
      let blocked = false;
      for (const b of world.colliders) {
        if (b.containsPoint(p.mesh.position)) {
          blocked = true;
          break;
        }
      }
      if (blocked) spawnSparks(p.mesh.position.clone(), false, 3);
      if (blocked || p.life <= 0 || p.mesh.position.y < 0.05) {
        if (!blocked) spawnSparks(p.mesh.position.clone(), false, 2);
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        projectiles.current.splice(i, 1);
      }
    }

    /* ---- effects ---- */
    for (let i = effects.current.length - 1; i >= 0; i--) {
      const fx = effects.current[i];
      fx.life -= dt;
      if (fx.kind === 'tracer') {
        const mat = (fx.obj as THREE.Line).material as THREE.LineBasicMaterial;
        mat.opacity = Math.max(0, fx.life / fx.max) * 0.75;
      } else if (fx.kind === 'spark' || fx.kind === 'casing') {
        const mesh = fx.obj as THREE.Mesh;
        if (fx.vel) {
          mesh.position.addScaledVector(fx.vel, dt);
          fx.vel.y += (fx.grav ?? -16) * dt;
          if (mesh.position.y < 0.03) {
            mesh.position.y = 0.03;
            fx.vel.y *= -0.35;
            fx.vel.x *= 0.7;
            fx.vel.z *= 0.7;
          }
        }
        if (fx.spin) mesh.rotation.x += fx.spin * dt;
        if (fx.kind === 'casing' && fx.life < 0.4) {
          (mesh.material as THREE.MeshStandardMaterial).transparent = true;
          (mesh.material as THREE.MeshStandardMaterial).opacity = fx.life / 0.4;
        }
      } else if (fx.kind === 'blast') {
        const mesh = fx.obj as THREE.Mesh;
        const k = 1 - fx.life / fx.max;
        mesh.scale.setScalar(0.5 + k * 2.4);
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      } else if (fx.kind === 'ring') {
        const mesh = fx.obj as THREE.Mesh;
        const k = 1 - fx.life / fx.max;
        const radius = fx.radius ?? 3;
        mesh.scale.setScalar(radius * (0.22 + k * 1.12));
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k) * (1 - k);
      }
      if (fx.life <= 0) {
        scene.remove(fx.obj);
        disposeEffect(fx);
        effects.current.splice(i, 1);
      }
    }
  });

  function spawnEnemyProjectile(e: EnemyInst, dmg: number, spread = 0) {
    const originY = e.model.group.position.y + (e.type === 'drone' ? 1.35 : e.type === 'boss' ? 2.55 : 1.35);
    const origin = new THREE.Vector3(e.pos.x, originY, e.pos.z);
    const target = new THREE.Vector3(pos.current.x, pos.current.y + 1.15, pos.current.z);
    const dir = target.sub(origin).normalize();
    if (spread > 0) {
      dir.x += (Math.random() - 0.5) * spread * 2;
      dir.z += (Math.random() - 0.5) * spread * 2;
      dir.normalize();
    }
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(e.type === 'boss' ? 0.16 : 0.11, 8, 6),
      new THREE.MeshBasicMaterial({ color: e.type === 'boss' ? 0xff9a4a : 0xff6a3d }),
    );
    mesh.position.copy(origin);
    scene.add(mesh);
    projectiles.current.push({ mesh, vel: dir.multiplyScalar(24), dmg, life: 3.2 });
  }

  return (
    <>
      <primitive object={world.group} />
      <primitive object={player.group} />
    </>
  );
}
