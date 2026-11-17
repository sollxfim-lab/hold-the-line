export interface Coat {
  id: string;
  name: string;
  role: string;
  price: number;
  color: number;
  lining: number;
  accent: number;
  desc: string;
}

/**
 * Field coats are silhouette pieces, not armour. Each one is built from the
 * same tailored shell in the player rig but swaps cloth, lining, and trim.
 */
export const COATS: Coat[] = [
  {
    id: 'field',
    name: 'Field Coat',
    role: 'Standard issue',
    price: 0,
    color: 0x4a4d3d,
    lining: 0x2c2d24,
    accent: 0x9d8e67,
    desc: 'Waxed canvas, reinforced shoulders, and the quiet weight of a long deployment.',
  },
  {
    id: 'ghost',
    name: 'Ghost Hunter Coat',
    role: 'Cold-weather long coat',
    price: 900,
    color: 0x343b42,
    lining: 0x1d2125,
    accent: 0x9aabb2,
    desc: 'A storm-grey hunter cut with silver piping and a high storm collar.',
  },
  {
    id: 'dark',
    name: 'Dark Coat',
    role: 'Void-dyed long coat',
    price: 1600,
    color: 0x17181b,
    lining: 0x4d1d25,
    accent: 0xa37a5f,
    desc: 'Blacker than the trench night. Crimson lining, brass buckles, and a hem that refuses the wind.',
  },
  {
    id: 'crimson',
    name: 'Crimson Admiral Coat',
    role: 'Relic command coat',
    price: 3200,
    color: 0x571f22,
    lining: 0x221213,
    accent: 0xd7b369,
    desc: 'A command coat from a fleet that no longer exists. Gold epaulettes, deep burgundy wool, and a captain\'s weight.',
  },
];

export const getCoat = (id: string): Coat => COATS.find((c) => c.id === id) ?? COATS[0];
