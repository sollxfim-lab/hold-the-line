export type ClassSkillKind =
  | 'rally'
  | 'feast'
  | 'bloodveil'
  | 'frenzy'
  | 'undying'
  | 'hellfire'
  | 'shadowstep'
  | 'decree';

/** Secondary technique bound to E. Each class gets its own silhouette. */
export type ClassTechniqueKind =
  | 'breach'
  | 'carrion'
  | 'sanguine'
  | 'quake'
  | 'aegis'
  | 'inferno'
  | 'blinkstrike'
  | 'banner';

export interface PlayerClass {
  id: string;
  name: string;
  role: string;
  price: number;
  color: string;
  code: string;
  desc: string;
  passive: string;
  skill: {
    name: string;
    desc: string;
    cooldown: number;
    kind: ClassSkillKind;
  };
  technique: {
    name: string;
    desc: string;
    cooldown: number;
    kind: ClassTechniqueKind;
  };
}

export const PLAYER_CLASSES: PlayerClass[] = [
  {
    id: 'human',
    name: 'Human',
    role: 'Baseline operator',
    price: 0,
    color: '#9fb2a4',
    code: 'HUM',
    desc: 'Unaugmented, unequipped, underestimated. Discipline carries what mutation cannot.',
    passive: 'Disciplined: +5% damage and 10% faster reloads.',
    skill: {
      name: 'Rally Cry',
      desc: 'Instantly reloads the active weapon and grants 20% damage and 25% fire rate for 6 seconds.',
      cooldown: 24,
      kind: 'rally',
    },
    technique: {
      name: 'Breach & Clear',
      desc: 'A shoulder-first entry: 4 metres of committed momentum and a concussive sweep that staggers the room.',
      cooldown: 14,
      kind: 'breach',
    },
  },
  {
    id: 'ghoul',
    name: 'Ghoul',
    role: 'Carrion predator',
    price: 1200,
    color: '#8a9b5c',
    code: 'GHL',
    desc: 'A trench-born scavenger that treats the fallen as a field ration. Fast, ragged, relentless.',
    passive: 'Carrion Hunger: recover 5 integrity with every kill.',
    skill: {
      name: 'Feast',
      desc: 'Devours every hostile within 7 metres for 130 damage, restoring 15 integrity per victim.',
      cooldown: 18,
      kind: 'feast',
    },
    technique: {
      name: 'Carrion Rush',
      desc: 'A low, starving charge through the line. Every hostile cut by the rush feeds 9 integrity.',
      cooldown: 13,
      kind: 'carrion',
    },
  },
  {
    id: 'vampire',
    name: 'Vampire',
    role: 'Sanguine duelist',
    price: 2200,
    color: '#b45c6e',
    code: 'VMP',
    desc: 'An old bloodline wearing a modern plate carrier. Every wound paid for in someone else.',
    passive: 'Sanguine: recover 3 integrity with every confirmed hit.',
    skill: {
      name: 'Blood Veil',
      desc: 'Drains up to four hostiles within 11 metres for 150 damage and heals for half the total.',
      cooldown: 22,
      kind: 'bloodveil',
    },
    technique: {
      name: 'Crimson Waltz',
      desc: 'A full turning drain that draws blood from everything nearby, then lends the operator its speed.',
      cooldown: 18,
      kind: 'sanguine',
    },
  },
  {
    id: 'berserk',
    name: 'Berserk',
    role: 'Shock assault',
    price: 1800,
    color: '#d9663d',
    code: 'BSK',
    desc: 'Pain is fuel. The closer the line breaks, the harder this one swings back.',
    passive: 'Bloodlust: up to 35% bonus damage as integrity falls.',
    skill: {
      name: 'Frenzy',
      desc: 'Grants 50% damage and 35% movement speed for 7 seconds. No defensive bonus.',
      cooldown: 26,
      kind: 'frenzy',
    },
    technique: {
      name: 'Seismic Slam',
      desc: 'Raises both fists and breaks the ground. Heavy radial damage, hard stagger, and a long recoil.',
      cooldown: 16,
      kind: 'quake',
    },
  },
  {
    id: 'immortal',
    name: 'Immortal',
    role: 'Anomalous survivor',
    price: 3800,
    color: '#d8c58f',
    code: 'IMM',
    desc: 'Records claim this operator has died eleven times. The records are wrong; the operator is not.',
    passive: 'Undying Flesh: incoming damage reduced by 12%.',
    skill: {
      name: 'Undying',
      desc: 'Grants 6 seconds of invulnerability and restores 30 integrity.',
      cooldown: 40,
      kind: 'undying',
    },
    technique: {
      name: 'Aegis Dome',
      desc: 'Plants a golden ward for 4 seconds, restoring integrity and burning anything that presses the edge.',
      cooldown: 30,
      kind: 'aegis',
    },
  },
  {
    id: 'demon',
    name: 'Demon',
    role: 'Infernal breacher',
    price: 3200,
    color: '#d04f3a',
    code: 'DEM',
    desc: 'Something crossed the breach wearing a soldier. It kept the rifle and the discipline.',
    passive: 'Infernal Rounds: 16% chance for any round to detonate on impact.',
    skill: {
      name: 'Hellfire',
      desc: 'Incinerates every hostile within 9 metres for 200 damage.',
      cooldown: 30,
      kind: 'hellfire',
    },
    technique: {
      name: 'Infernal Column',
      desc: 'Stamps a burning lane into the floor: three chained detonations reaching twelve metres forward.',
      cooldown: 20,
      kind: 'inferno',
    },
  },
  {
    id: 'assassin',
    name: 'Assassin',
    role: 'Covert killer',
    price: 2600,
    color: '#7d8fa8',
    code: 'ASN',
    desc: 'Never on the manifest, never on the thermal scope. The sector is quieter when they work.',
    passive: 'Killer Instinct: +12% movement speed and +8% critical chance.',
    skill: {
      name: 'Shadowstep',
      desc: 'Blinks 7 metres forward and cloaks for 4 seconds. Hostiles lose their target.',
      cooldown: 16,
      kind: 'shadowstep',
    },
    technique: {
      name: 'Phantom Blink',
      desc: 'Steps behind the nearest hostile and drives a killing cut through the guard. No escape lane.',
      cooldown: 15,
      kind: 'blinkstrike',
    },
  },
  {
    id: 'heroking',
    name: 'Hero King',
    role: 'Mythic vanguard',
    price: 5000,
    color: '#e0b85c',
    code: 'HRK',
    desc: 'The last crown of the perimeter. A relic bloodline that holds the line by decree.',
    passive: 'Sovereign Aura: +8% damage and 8% incoming damage reduction.',
    skill: {
      name: 'Sovereign Decree',
      desc: 'Crushes every hostile within 14 metres for 300 damage and restores 40 integrity.',
      cooldown: 45,
      kind: 'decree',
    },
    technique: {
      name: 'Sovereign Banner',
      desc: 'Plants the crown banner for 4 seconds. It pulses judgement, mends the operator, and raises damage.',
      cooldown: 32,
      kind: 'banner',
    },
  },
];

export const getPlayerClass = (id: string): PlayerClass =>
  PLAYER_CLASSES.find((c) => c.id === id) ?? PLAYER_CLASSES[0];
