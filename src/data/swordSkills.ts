import type { Weapon } from './weapons';

export type SwordComboKind = 'dash' | 'wave' | 'nova';

export interface SwordComboSkill {
  /** Keyboard glyph shown in the HUD. */
  key: 'Z' | 'X' | 'C';
  name: string;
  desc: string;
  cooldown: number;
  /** Damage multiplier applied to the blade's base damage. */
  power: number;
  /** Effective reach in metres. */
  range: number;
  /** Radius used by radial or line strikes. */
  radius: number;
  kind: SwordComboKind;
  /** Impact delay in milliseconds, measured from the key press. */
  cast: number;
  /** Dash distance for blink cuts. */
  distance?: number;
}

const KUROGANE: SwordComboSkill[] = [
  {
    key: 'Z',
    name: 'Void Draw',
    desc: 'A blink-cut through the first rank. Leaves a seam of violet light in the air.',
    cooldown: 7,
    power: 1.55,
    range: 7.2,
    radius: 1.7,
    kind: 'dash',
    cast: 130,
    distance: 4.6,
  },
  {
    key: 'X',
    name: 'Moon Fang',
    desc: 'A crescent of compressed night air, launched forward to open armour and formation.',
    cooldown: 10,
    power: 2.2,
    range: 10.5,
    radius: 3.6,
    kind: 'wave',
    cast: 220,
  },
  {
    key: 'C',
    name: 'Cursed Eclipse',
    desc: 'A full turning cut that draws a black eclipse around the operator. Heavy, final, absolute.',
    cooldown: 16,
    power: 3.6,
    range: 7,
    radius: 6.6,
    kind: 'nova',
    cast: 380,
  },
];

const RAIJIN: SwordComboSkill[] = [
  {
    key: 'Z',
    name: 'Storm Rush',
    desc: 'Ride the thunderhead through the line and let the wake do the cutting.',
    cooldown: 6.5,
    power: 1.45,
    range: 7.8,
    radius: 1.8,
    kind: 'dash',
    cast: 120,
    distance: 5,
  },
  {
    key: 'X',
    name: 'Thunder Cross',
    desc: 'Two storm arcs cross in front of the blade, scouring everything in the lane.',
    cooldown: 9.5,
    power: 2.35,
    range: 11.5,
    radius: 4.2,
    kind: 'wave',
    cast: 210,
  },
  {
    key: 'C',
    name: "Raijin's Judgment",
    desc: 'Plant the cleaver and call the storm down. A full arena of thunder answers.',
    cooldown: 15,
    power: 3.9,
    range: 8,
    radius: 7.4,
    kind: 'nova',
    cast: 360,
  },
];

const FALLBACK: SwordComboSkill[] = [
  {
    key: 'Z',
    name: 'Draw Cut',
    desc: 'A fast forward cut that closes the distance and opens the guard.',
    cooldown: 7,
    power: 1.5,
    range: 7,
    radius: 1.6,
    kind: 'dash',
    cast: 130,
    distance: 4.4,
  },
  {
    key: 'X',
    name: 'Crescent Wave',
    desc: 'A wide crescent of blade force, thrown down the lane.',
    cooldown: 10,
    power: 2.1,
    range: 10,
    radius: 3.4,
    kind: 'wave',
    cast: 220,
  },
  {
    key: 'C',
    name: 'Heaven Splitter',
    desc: 'A committed overhead finisher that cracks the ground and staggers everything nearby.',
    cooldown: 16,
    power: 3.4,
    range: 7,
    radius: 6.2,
    kind: 'nova',
    cast: 380,
  },
];

export function getSwordCombo(weaponOrId: Weapon | string): SwordComboSkill[] {
  const id = typeof weaponOrId === 'string' ? weaponOrId : weaponOrId.id;
  if (id === 'raijin') return RAIJIN;
  if (id === 'kurogane') return KUROGANE;
  return FALLBACK;
}
