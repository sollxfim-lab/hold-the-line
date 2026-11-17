export interface Upgrades {
  damage: number;
  fireRate: number;
  reload: number;
  speed: number;
  armor: number;
  pierce: number;
  pellets: number;
  lifesteal: number;
  crit: number;
  maxHpBonus: number;
  explosive: boolean;
  scavenger: boolean;
  /* Air control and mythic mobility. */
  airJumps: number;
  jumpPower: number;
  /* Divine and mythic combat effects. */
  chain: number;
  refund: number;
  regen: number;
  shockwave: boolean;
  guardian: boolean;
}

export const DEFAULT_UPGRADES: Upgrades = {
  damage: 1,
  fireRate: 1,
  reload: 1,
  speed: 1,
  armor: 0,
  pierce: 0,
  pellets: 0,
  lifesteal: 0,
  crit: 0,
  maxHpBonus: 0,
  explosive: false,
  scavenger: false,
  airJumps: 1,
  jumpPower: 1,
  chain: 0,
  refund: 0,
  regen: 0,
  shockwave: false,
  guardian: false,
};

export type UpgradeRarity = 'common' | 'rare' | 'epic' | 'mythic' | 'divine';

export interface UpgradeCard {
  id: string;
  name: string;
  desc: string;
  rarity: UpgradeRarity;
  apply: (u: Upgrades) => void;
}

export const UPGRADE_RARITY_LABEL: Record<UpgradeRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  mythic: 'Mythic',
  divine: 'Divine',
};

const RARITY_INDEX: Record<UpgradeRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  mythic: 3,
  divine: 4,
};

export const UPGRADE_POOL: UpgradeCard[] = [
  {
    id: 'jacket',
    name: 'Full Metal Jacket',
    desc: 'Weapon damage increased by 18%.',
    rarity: 'rare',
    apply: (u) => {
      u.damage *= 1.18;
    },
  },
  {
    id: 'trigger',
    name: 'Competition Trigger',
    desc: 'Fire interval reduced by 12%.',
    rarity: 'common',
    apply: (u) => {
      u.fireRate = Math.max(0.42, u.fireRate * 0.88);
    },
  },
  {
    id: 'hands',
    name: 'Fast Hands',
    desc: 'Reload time reduced by 20%.',
    rarity: 'common',
    apply: (u) => {
      u.reload = Math.max(0.4, u.reload * 0.8);
    },
  },
  {
    id: 'plate',
    name: 'Field Plate',
    desc: 'Maximum health increased by 20 and restored by 20.',
    rarity: 'common',
    apply: (u) => {
      u.maxHpBonus += 20;
    },
  },
  {
    id: 'boots',
    name: 'Light Boots',
    desc: 'Movement speed increased by 9%.',
    rarity: 'common',
    apply: (u) => {
      u.speed *= 1.09;
    },
  },
  {
    id: 'ceramic',
    name: 'Ceramic Inserts',
    desc: 'Incoming damage reduced by 15%.',
    rarity: 'rare',
    apply: (u) => {
      u.armor = Math.min(0.6, u.armor + 0.15);
    },
  },
  {
    id: 'overpen',
    name: 'Overpenetration',
    desc: 'Rounds pass through one additional target.',
    rarity: 'rare',
    apply: (u) => {
      u.pierce += 1;
    },
  },
  {
    id: 'split',
    name: 'Split Shot',
    desc: 'Every shot fires one additional projectile.',
    rarity: 'epic',
    apply: (u) => {
      u.pellets += 1;
    },
  },
  {
    id: 'bloodrite',
    name: 'Bloodrite',
    desc: 'Recover 4 health with every kill.',
    rarity: 'rare',
    apply: (u) => {
      u.lifesteal += 4;
    },
  },
  {
    id: 'weakpoint',
    name: 'Weak Point',
    desc: 'Critical chance increased by 15%. Critical hits deal 2.5x damage.',
    rarity: 'epic',
    apply: (u) => {
      u.crit = Math.min(0.6, u.crit + 0.15);
    },
  },
  {
    id: 'he',
    name: 'High Explosive',
    desc: 'Rounds detonate on impact for 40% damage in a small radius.',
    rarity: 'epic',
    apply: (u) => {
      u.explosive = true;
    },
  },
  {
    id: 'scavenger',
    name: 'Scavenger',
    desc: 'Gain 5 reserve ammunition with every kill.',
    rarity: 'common',
    apply: (u) => {
      u.scavenger = true;
    },
  },
  {
    id: 'ascension',
    name: 'Ascendant Step',
    desc: 'Gain an additional mid-air jump and 12% greater jump height.',
    rarity: 'mythic',
    apply: (u) => {
      u.airJumps += 1;
      u.jumpPower *= 1.12;
    },
  },
  {
    id: 'stormcaller',
    name: 'Stormcaller',
    desc: 'Rounds arc lightning to up to two nearby hostiles for 45% damage.',
    rarity: 'mythic',
    apply: (u) => {
      u.chain += 2;
    },
  },
  {
    id: 'warden',
    name: 'Warden Rounds',
    desc: '22% chance to return a round to the magazine on a confirmed hit.',
    rarity: 'mythic',
    apply: (u) => {
      u.refund = Math.min(0.66, u.refund + 0.22);
    },
  },
  {
    id: 'aegis',
    name: 'Aegis Protocol',
    desc: 'Once per deployment, lethal damage leaves you at 40% integrity and repels the assault.',
    rarity: 'divine',
    apply: (u) => {
      u.guardian = true;
    },
  },
  {
    id: 'cataclysm',
    name: 'Cataclysm',
    desc: 'Eliminations release a shockwave that tears through nearby hostiles.',
    rarity: 'divine',
    apply: (u) => {
      u.shockwave = true;
    },
  },
  {
    id: 'radiance',
    name: 'Radiant Core',
    desc: 'Regenerate 3 integrity per second for the rest of the run.',
    rarity: 'divine',
    apply: (u) => {
      u.regen += 3;
    },
  },
];

export const upgradesById = (id: string) => UPGRADE_POOL.find((u) => u.id === id);

/* One-shot cards disappear once taken; stat cards may be offered again and stack. */
const UNIQUE_UPGRADES = new Set([
  'overpen',
  'split',
  'he',
  'scavenger',
  'stormcaller',
  'aegis',
  'cataclysm',
]);

function rarityWeights(wave: number): Record<UpgradeRarity, number> {
  const w = Math.max(1, wave);
  return {
    common: Math.max(10, 52 - w * 3.2),
    rare: 30,
    epic: 12 + w * 0.9,
    mythic: 3 + w * 1.4,
    divine: 0.7 + w * 1.1,
  };
}

function weightedRarity(wave: number, minimum: UpgradeRarity = 'common'): UpgradeRarity {
  const weights = rarityWeights(wave);
  const minIndex = RARITY_INDEX[minimum];
  const entries = (Object.keys(weights) as UpgradeRarity[]).filter(
    (rarity) => RARITY_INDEX[rarity] >= minIndex,
  );
  const total = entries.reduce((sum, rarity) => sum + weights[rarity], 0);
  let roll = Math.random() * total;
  for (const rarity of entries) {
    roll -= weights[rarity];
    if (roll <= 0) return rarity;
  }
  return entries[entries.length - 1];
}

/**
 * Weighted requisition roll. Wave one is mostly common and rare; epic, mythic
 * and divine cards climb steadily as the sector escalates. Every fifth wave
 * guarantees at least one mythic or divine card.
 */
export function rollUpgrades(taken: string[], wave = 1, count = 3): UpgradeCard[] {
  const available = UPGRADE_POOL.filter((u) => !(UNIQUE_UPGRADES.has(u.id) && taken.includes(u.id)));
  const picks: UpgradeCard[] = [];
  const used = new Set<string>();

  for (let slot = 0; slot < count; slot++) {
    let minimum: UpgradeRarity = 'common';
    if (slot === 0 && wave >= 5 && wave % 5 === 0) minimum = 'mythic';
    else if (slot === 0 && wave >= 3) minimum = 'rare';

    const rarity = weightedRarity(wave, minimum);
    let candidates = available.filter((u) => !used.has(u.id) && u.rarity === rarity);
    if (candidates.length === 0) {
      candidates = available.filter(
        (u) => !used.has(u.id) && RARITY_INDEX[u.rarity] >= RARITY_INDEX[minimum],
      );
    }
    if (candidates.length === 0) candidates = available.filter((u) => !used.has(u.id));
    if (candidates.length === 0) break;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    picks.push(pick);
    used.add(pick.id);
  }

  return picks;
}
