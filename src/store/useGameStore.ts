import { create } from 'zustand';
import { getPlayerClass, PLAYER_CLASSES } from '../data/classes';
import { COATS } from '../data/cosmetics';
import {
  DEFAULT_UPGRADES,
  rollUpgrades,
  upgradesById,
  type UpgradeCard,
  type Upgrades,
} from '../data/upgrades';
import { getWeapon, WEAPONS } from '../data/weapons';

export type Phase = 'title' | 'playing' | 'upgrade' | 'armory' | 'gameover';
export type CameraMode = 'first' | 'third';
export type SwordReady = [number, number, number];

export interface FeedItem {
  id: number;
  name: string;
  victim: string;
}

export interface Perks {
  hp: number;
  speed: number;
  damage: number;
  armor: number;
}

export type RadarKind = 'grunt' | 'rifleman' | 'drone' | 'boss' | 'zombie';

export interface BossState {
  active: boolean;
  name: string;
  hp: number;
  maxHp: number;
  wave: number;
  stage: number;
}

export interface RadarBlip {
  id: number;
  x: number;
  z: number;
  kind: RadarKind;
  engaged: boolean;
}

export interface RadarData {
  x: number;
  z: number;
  yaw: number;
  bounds: number;
  blips: RadarBlip[];
}

interface Persisted {
  bank: number;
  owned: string[];
  equipped: string;
  ownedClasses: string[];
  classId: string;
  perks: Perks;
  medkits: number;
  bestWave: number;
  ownedCoats: string[];
  coatId: string;
}

const STORAGE_KEY = 'holdtheline.save.v2';

const defaultPersisted = (): Persisted => ({
  bank: 0,
  owned: ['m9', 'marauder'],
  equipped: 'marauder',
  ownedClasses: ['human'],
  classId: 'human',
  perks: { hp: 0, speed: 0, damage: 0, armor: 0 },
  medkits: 1,
  bestWave: 0,
  ownedCoats: ['field'],
  coatId: 'field',
});

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPersisted();
    const data = JSON.parse(raw) as Partial<Persisted>;
    const base = defaultPersisted();
    const owned = Array.isArray(data.owned)
      ? data.owned.filter((id) => WEAPONS.some((w) => w.id === id))
      : base.owned;
    const ownedClasses = Array.isArray(data.ownedClasses)
      ? data.ownedClasses.filter((id) => PLAYER_CLASSES.some((c) => c.id === id))
      : base.ownedClasses;
    const ownedCoats = Array.isArray(data.ownedCoats)
      ? data.ownedCoats.filter((id) => COATS.some((c) => c.id === id))
      : base.ownedCoats;
    return {
      bank: typeof data.bank === 'number' ? data.bank : base.bank,
      owned: owned.length ? owned : base.owned,
      equipped:
        typeof data.equipped === 'string' && owned.includes(data.equipped)
          ? data.equipped
          : owned[0],
      ownedClasses: ownedClasses.length ? ownedClasses : base.ownedClasses,
      classId:
        typeof data.classId === 'string' && ownedClasses.includes(data.classId)
          ? data.classId
          : ownedClasses[0] ?? 'human',
      perks: { ...base.perks, ...(data.perks ?? {}) },
      medkits: typeof data.medkits === 'number' ? Math.min(3, Math.max(0, data.medkits)) : base.medkits,
      bestWave: typeof data.bestWave === 'number' ? data.bestWave : 0,
      ownedCoats: ownedCoats.length ? ownedCoats : base.ownedCoats,
      coatId:
        typeof data.coatId === 'string' && ownedCoats.includes(data.coatId)
          ? data.coatId
          : ownedCoats[0] ?? 'field',
    };
  } catch {
    return defaultPersisted();
  }
}

function savePersisted(p: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

const snapshot = (s: Persisted): Persisted => ({
  bank: s.bank,
  owned: s.owned,
  equipped: s.equipped,
  ownedClasses: s.ownedClasses,
  classId: s.classId,
  perks: s.perks,
  medkits: s.medkits,
  bestWave: s.bestWave,
  ownedCoats: s.ownedCoats,
  coatId: s.coatId,
});

interface Session {
  phase: Phase;
  paused: boolean;
  runId: number;
  hp: number;
  wave: number;
  kills: number;
  earned: number;
  enemiesLeft: number;
  ammo: number;
  reserve: number;
  reloading: boolean;
  ads: boolean;
  medkits: number;
  upgrades: Upgrades;
  taken: string[];
  choices: UpgradeCard[];
  guardianUsed: boolean;
  guardianTick: number;
  skillReadyAt: number;
  skillTick: number;
  invulnerableUntil: number;
  skillCastUntil: number;
  techniqueReadyAt: number;
  techniqueTick: number;
  techniqueCastUntil: number;
  instinctReadyAt: number;
  instinctUntil: number;
  instinctTick: number;
  instinctDodgeTick: number;
  boss: BossState;
  swordReadyAt: SwordReady;
  swordTick: number;
  swordCastUntil: number;
  swordCastIndex: number;
  cameraMode: CameraMode;
  radar: RadarData;
  hitTick: number;
  headshotTick: number;
  damageTick: number;
  killTick: number;
  shotTick: number;
  feed: FeedItem[];
}

interface Cheats {
  cheatsOpen: boolean;
  godMode: boolean;
  infiniteAmmo: boolean;
  oneHitKill: boolean;
  flyMode: boolean;
  noclip: boolean;
  v4Awakening: boolean;
  nukeTick: number;
}

type CheatToggle = 'godMode' | 'infiniteAmmo' | 'oneHitKill' | 'flyMode' | 'noclip' | 'v4Awakening';

interface Store extends Session, Persisted, Cheats {
  setPhase: (phase: Phase) => void;
  setPaused: (paused: boolean) => void;
  startRun: () => void;
  abandonRun: () => void;
  damagePlayer: (amount: number) => void;
  healPlayer: (amount: number) => void;
  registerKill: (reward: number, victim: string) => void;
  addEarned: (amount: number) => void;
  setAmmo: (ammo: number, reserve: number) => void;
  setReloading: (value: boolean) => void;
  setAds: (value: boolean) => void;
  setEnemiesLeft: (value: number) => void;
  setRadar: (radar: RadarData) => void;
  reportShot: () => void;
  reportHit: (headshot: boolean) => void;
  prepareUpgrades: () => void;
  takeUpgrade: (id: string) => void;
  nextWave: () => void;
  buyWeapon: (id: string) => void;
  equipWeapon: (id: string) => void;
  buyClass: (id: string) => void;
  equipClass: (id: string) => void;
  buyCoat: (id: string) => void;
  equipCoat: (id: string) => void;
  toggleCamera: () => void;
  buyPerk: (key: keyof Perks, cost: number) => void;
  buyMedkit: () => void;
  useMedkit: () => void;
  getMaxHp: () => number;
  setEquipped: (id: string) => void;
  triggerSkill: (cooldownMs: number) => boolean;
  triggerTechnique: (cooldownMs: number, castMs: number) => boolean;
  triggerInstinct: (cooldownMs: number, durationMs: number) => boolean;
  registerInstinctDodge: () => void;
  triggerSwordSkill: (index: number, cooldownMs: number, castMs: number) => boolean;
  setInvulnerable: (until: number) => void;
  setBoss: (boss: BossState) => void;
  setCheatsOpen: (open: boolean) => void;
  toggleCheat: (key: CheatToggle) => void;
  cheatAddCredits: () => void;
  cheatUnlockAll: () => void;
  cheatGrantSuite: () => void;
  cheatHeal: () => void;
  cheatNuke: () => void;
}

const baseSession = (): Session => ({
  phase: 'title',
  paused: false,
  runId: 0,
  hp: 100,
  wave: 1,
  kills: 0,
  earned: 0,
  enemiesLeft: 0,
  ammo: 30,
  reserve: 180,
  reloading: false,
  ads: false,
  medkits: 1,
  upgrades: { ...DEFAULT_UPGRADES },
  taken: [],
  choices: [],
  guardianUsed: false,
  guardianTick: 0,
  skillReadyAt: 0,
  skillTick: 0,
  skillCastUntil: 0,
  techniqueReadyAt: 0,
  techniqueTick: 0,
  techniqueCastUntil: 0,
  instinctReadyAt: 0,
  instinctUntil: 0,
  instinctTick: 0,
  instinctDodgeTick: 0,
  boss: { active: false, name: '', hp: 0, maxHp: 0, wave: 0, stage: 0 },
  swordReadyAt: [0, 0, 0],
  swordTick: 0,
  swordCastUntil: 0,
  swordCastIndex: -1,
  invulnerableUntil: 0,
  cameraMode: 'first',
  radar: { x: 0, z: 14, yaw: 0, bounds: 54, blips: [] },
  hitTick: 0,
  headshotTick: 0,
  damageTick: 0,
  killTick: 0,
  shotTick: 0,
  feed: [],
});

const persisted = loadPersisted();
let feedId = 1;

const initialCheats = (): Cheats => ({
  cheatsOpen: false,
  godMode: false,
  infiniteAmmo: false,
  oneHitKill: false,
  flyMode: false,
  noclip: false,
  v4Awakening: false,
  nukeTick: 0,
});

export const useGameStore = create<Store>((set, get) => ({
  ...persisted,
  ...baseSession(),
  ...initialCheats(),

  setPhase: (phase) => set({ phase, paused: false, ads: false, reloading: false }),

  setPaused: (paused) => set({ paused, ads: false }),

  getMaxHp: () => {
    const s = get();
    return Math.round(100 + s.perks.hp * 10 + s.upgrades.maxHpBonus);
  },

  startRun: () => {
    const s = get();
    const equippedId = s.owned.includes(s.equipped) ? s.equipped : 'm9';
    const weapon = getWeapon(equippedId);
    const maxHp = Math.round(100 + s.perks.hp * 10);
    set({
      ...baseSession(),
      phase: 'playing',
      runId: s.runId + 1,
      equipped: equippedId,
      hp: maxHp,
      medkits: s.medkits,
      cameraMode: s.cameraMode,
      ammo: weapon.mag,
      reserve: weapon.reserve,
    });
  },

  abandonRun: () => {
    const s = get();
    /* A death already banked the run's earnings; do not pay them twice. */
    const bank = s.phase === 'gameover' ? s.bank : s.bank + s.earned;
    const bestWave = Math.max(s.bestWave, s.wave);
    savePersisted({ ...snapshot(s), bank, bestWave });
    set({
      phase: 'title',
      paused: false,
      bank,
      bestWave,
      feed: [],
      reloading: false,
      ads: false,
    });
  },

  damagePlayer: (amount) => {
    const s = get();
    if (s.phase !== 'playing' || s.paused) return;
    if (s.godMode) return;
    const now = performance.now();
    if (now < s.invulnerableUntil) return;
    if (now < s.instinctUntil) {
      set({ instinctDodgeTick: s.instinctDodgeTick + 1 });
      return;
    }
    const cls = getPlayerClass(s.classId);
    const classArmor = cls.id === 'immortal' ? 0.12 : cls.id === 'heroking' ? 0.08 : 0;
    const armor = Math.min(0.75, s.upgrades.armor + s.perks.armor * 0.03 + classArmor);
    const mitigated = Math.max(1, Math.round(amount * (1 - armor)));
    const hp = Math.max(0, s.hp - mitigated);
    if (hp <= 0) {
      /* Divine intervention: Aegis Protocol turns one lethal hit per run into
         a rally, leaving the operator at 40% integrity. */
      if (s.upgrades.guardian && !s.guardianUsed) {
        const max = get().getMaxHp();
        set({
          hp: Math.max(1, Math.round(max * 0.4)),
          guardianUsed: true,
          guardianTick: s.guardianTick + 1,
          damageTick: s.damageTick + 1,
        });
        return;
      }
      const bank = s.bank + s.earned;
      const bestWave = Math.max(s.bestWave, s.wave);
      savePersisted({ ...snapshot(s), bank, bestWave });
      set({
        hp: 0,
        phase: 'gameover',
        paused: false,
        damageTick: s.damageTick + 1,
        bank,
        bestWave,
        reloading: false,
        ads: false,
      });
      return;
    }
    set({ hp, damageTick: s.damageTick + 1 });
  },

  healPlayer: (amount) => {
    const s = get();
    set({ hp: Math.min(get().getMaxHp(), s.hp + amount) });
  },

  registerKill: (reward, victim) => {
    const s = get();
    const feed: FeedItem[] = [
      { id: feedId++, name: getWeapon(s.equipped).name, victim },
      ...s.feed,
    ].slice(0, 4);
    const max = get().getMaxHp();
    set({
      kills: s.kills + 1,
      earned: s.earned + reward,
      killTick: s.killTick + 1,
      feed,
      hp: Math.min(
        max,
        s.hp +
          Math.round(s.upgrades.lifesteal) +
          (s.classId === 'ghoul' ? 5 : 0),
      ),
      enemiesLeft: Math.max(0, s.enemiesLeft - 1),
    });
  },

  setAmmo: (ammo, reserve) => set({ ammo, reserve }),
  setReloading: (value) => set({ reloading: value }),
  setAds: (value) => set({ ads: value }),
  setEnemiesLeft: (value) => set({ enemiesLeft: value }),
  setRadar: (radar) => set({ radar }),
  reportShot: () => set((s) => ({ shotTick: s.shotTick + 1 })),

  addEarned: (amount) => set((s) => ({ earned: s.earned + amount })),

  reportHit: (headshot) => {
    const s = get();
    set({
      hitTick: s.hitTick + 1,
      headshotTick: headshot ? s.headshotTick + 1 : s.headshotTick,
    });
  },

  prepareUpgrades: () => {
    const s = get();
    set({
      choices: rollUpgrades(s.taken, s.wave),
      phase: 'upgrade',
      paused: false,
      ads: false,
      reloading: false,
    });
  },

  takeUpgrade: (id) => {
    const s = get();
    const card = upgradesById(id);
    const next: Upgrades = { ...s.upgrades };
    if (card) card.apply(next);
    const bonusHp = id === 'plate' ? 20 : 0;
    /* Higher tiers also patch the operator up between waves. */
    const rally =
      card?.rarity === 'divine' ? 40 : card?.rarity === 'mythic' ? 24 : card?.rarity === 'epic' ? 14 : 10;
    const max = Math.round(100 + s.perks.hp * 10 + next.maxHpBonus);
    /* Selecting a card also launches the next wave. */
    set({
      upgrades: next,
      taken: [...s.taken, id],
      hp: Math.min(max, s.hp + bonusHp + rally),
      wave: s.wave + 1,
      reserve: Math.min(999, s.reserve + 20),
      choices: [],
      phase: 'playing',
      paused: false,
      ads: false,
      reloading: false,
    });
  },

  nextWave: () => {
    const s = get();
    const max = get().getMaxHp();
    set({
      wave: s.wave + 1,
      phase: 'playing',
      reserve: Math.min(999, s.reserve + 20),
      hp: Math.min(max, s.hp + 10),
    });
  },

  buyWeapon: (id) => {
    const s = get();
    const weapon = WEAPONS.find((w) => w.id === id);
    if (!weapon || s.owned.includes(id) || s.bank < weapon.price) return;
    const bank = s.bank - weapon.price;
    const owned = [...s.owned, id];
    savePersisted({ ...snapshot(s), bank, owned, equipped: id });
    set({ bank, owned, equipped: id });
  },

  equipWeapon: (id) => {
    const s = get();
    if (!s.owned.includes(id)) return;
    savePersisted({ ...snapshot(s), equipped: id });
    set({ equipped: id });
  },

  buyClass: (id) => {
    const s = get();
    const cls = PLAYER_CLASSES.find((c) => c.id === id);
    if (!cls || s.ownedClasses.includes(id) || s.bank < cls.price) return;
    const bank = s.bank - cls.price;
    const ownedClasses = [...s.ownedClasses, id];
    savePersisted({ ...snapshot(s), bank, ownedClasses, classId: id });
    set({ bank, ownedClasses, classId: id });
  },

  equipClass: (id) => {
    const s = get();
    if (!s.ownedClasses.includes(id)) return;
    savePersisted({ ...snapshot(s), classId: id });
    set({ classId: id });
  },

  buyCoat: (id) => {
    const s = get();
    const coat = COATS.find((c) => c.id === id);
    if (!coat || s.ownedCoats.includes(id) || s.bank < coat.price) return;
    const bank = s.bank - coat.price;
    const ownedCoats = [...s.ownedCoats, id];
    savePersisted({ ...snapshot(s), bank, ownedCoats, coatId: id });
    set({ bank, ownedCoats, coatId: id });
  },

  equipCoat: (id) => {
    const s = get();
    if (!s.ownedCoats.includes(id)) return;
    savePersisted({ ...snapshot(s), coatId: id });
    set({ coatId: id });
  },

  toggleCamera: () => {
    const s = get();
    set({ cameraMode: s.cameraMode === 'first' ? 'third' : 'first' });
  },

  setEquipped: (id) => {
    const s = get();
    if (!s.owned.includes(id)) return;
    const weapon = getWeapon(id);
    savePersisted({ ...snapshot(s), equipped: id });
    set({
      equipped: id,
      ammo: weapon.mag,
      /* Each platform draws from its own reserve ceiling: no LMG belt
         carrying a sniper rifle. */
      reserve: Math.min(weapon.reserve, Math.max(weapon.mag, s.reserve)),
      reloading: false,
    });
  },

  buyPerk: (key, cost) => {
    const s = get();
    if (s.bank < cost) return;
    const perks: Perks = { ...s.perks, [key]: s.perks[key] + 1 };
    savePersisted({ ...snapshot(s), bank: s.bank - cost, perks });
    set({ bank: s.bank - cost, perks });
  },

  buyMedkit: () => {
    const s = get();
    if (s.bank < 120 || s.medkits >= 3) return;
    savePersisted({ ...snapshot(s), bank: s.bank - 120, medkits: s.medkits + 1 });
    set({ bank: s.bank - 120, medkits: s.medkits + 1 });
  },

  useMedkit: () => {
    const s = get();
    if (s.medkits <= 0 || s.phase !== 'playing') return;
    const max = get().getMaxHp();
    if (s.hp >= max) return;
    savePersisted({ ...snapshot(s), medkits: s.medkits - 1 });
    set({ medkits: s.medkits - 1, hp: Math.min(max, s.hp + 45) });
  },

  triggerSkill: (cooldownMs) => {
    const s = get();
    if (s.phase !== 'playing' || s.paused) return false;
    const now = performance.now();
    if (now < s.skillReadyAt) return false;
    set({
      skillReadyAt: now + cooldownMs,
      skillTick: s.skillTick + 1,
      skillCastUntil: now + 2200,
    });
    return true;
  },

  triggerTechnique: (cooldownMs, castMs) => {
    const s = get();
    if (s.phase !== 'playing' || s.paused) return false;
    const now = performance.now();
    if (now < s.techniqueReadyAt) return false;
    set({
      techniqueReadyAt: now + cooldownMs,
      techniqueTick: s.techniqueTick + 1,
      techniqueCastUntil: now + castMs,
    });
    return true;
  },

  triggerInstinct: (cooldownMs, durationMs) => {
    const s = get();
    if (s.phase !== 'playing' || s.paused) return false;
    const now = performance.now();
    if (now < s.instinctReadyAt) return false;
    set({
      instinctReadyAt: now + cooldownMs,
      instinctUntil: now + durationMs,
      instinctTick: s.instinctTick + 1,
    });
    return true;
  },

  registerInstinctDodge: () =>
    set((s) => ({ instinctDodgeTick: s.instinctDodgeTick + 1 })),

  triggerSwordSkill: (index, cooldownMs, castMs) => {
    const s = get();
    if (s.phase !== 'playing' || s.paused) return false;
    const slot = Math.max(0, Math.min(2, Math.floor(index)));
    const now = performance.now();
    if (now < s.swordReadyAt[slot]) return false;
    const ready: SwordReady = [...s.swordReadyAt];
    ready[slot] = now + cooldownMs;
    set({
      swordReadyAt: ready,
      swordTick: s.swordTick + 1,
      swordCastIndex: slot,
      swordCastUntil: now + castMs,
    });
    return true;
  },

  setInvulnerable: (until) => set({ invulnerableUntil: until }),

  setBoss: (boss) => set({ boss }),

  setCheatsOpen: (open) => set({ cheatsOpen: open }),

  toggleCheat: (key) => {
    const s = get();
    set({ [key]: !s[key] } as Pick<Cheats, typeof key>);
  },

  cheatAddCredits: () => {
    const s = get();
    const bank = s.bank + 25000;
    savePersisted({ ...snapshot(s), bank });
    set({ bank });
  },

  cheatUnlockAll: () => {
    const s = get();
    const owned = WEAPONS.map((w) => w.id);
    const ownedClasses = PLAYER_CLASSES.map((c) => c.id);
    const ownedCoats = COATS.map((c) => c.id);
    savePersisted({ ...snapshot(s), owned, ownedClasses, ownedCoats });
    set({ owned, ownedClasses, ownedCoats });
  },

  cheatGrantSuite: () => {
    const s = get();
    const upgrades: Upgrades = {
      ...s.upgrades,
      damage: Math.max(2.2, s.upgrades.damage * 2),
      fireRate: Math.min(0.5, s.upgrades.fireRate * 0.7),
      reload: Math.min(0.5, s.upgrades.reload * 0.7),
      armor: Math.max(0.45, s.upgrades.armor),
      pierce: Math.max(3, s.upgrades.pierce),
      crit: Math.max(0.45, s.upgrades.crit),
      lifesteal: Math.max(8, s.upgrades.lifesteal),
      maxHpBonus: s.upgrades.maxHpBonus + 100,
      explosive: true,
      scavenger: true,
      airJumps: Math.max(4, s.upgrades.airJumps),
      jumpPower: Math.max(1.25, s.upgrades.jumpPower),
      chain: Math.max(2, s.upgrades.chain),
      refund: Math.max(0.35, s.upgrades.refund),
      regen: Math.max(6, s.upgrades.regen),
      shockwave: true,
      guardian: true,
    };
    const max = Math.round(100 + s.perks.hp * 10 + upgrades.maxHpBonus);
    set({ upgrades, hp: max, guardianUsed: false });
  },

  cheatHeal: () => {
    const max = get().getMaxHp();
    const s = get();
    savePersisted({ ...snapshot(s), medkits: 3 });
    set({ hp: max, medkits: 3 });
  },

  cheatNuke: () => set((s) => ({ nukeTick: s.nukeTick + 1 })),
}));
