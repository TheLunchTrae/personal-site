import type { GameSectionId } from '@/site/sections';
import { mulberry32, T } from './textures';

export const B = {
  air: 0,
  grass: 1,
  dirt: 2,
  stone: 3,
  fieldstone: 4,
  log: 5,
  planks: 6,
  leaves: 7,
  sand: 8,
  water: 9,
  shelf: 10,
  gravel: 11,
  crystal: 12,
  paver: 13,
  lantern: 14,
  glass: 15,
  bedrock: 16,
  roof: 17,
  terminal: 18,
  codeOre: 19,
  metal: 20,
} as const;

export type BlockId = (typeof B)[keyof typeof B];

interface BlockInfo {
  // Tiles for the top, sides, and bottom faces.
  tiles: readonly [number, number, number];
  solid: boolean;
  // Hides the neighbouring face it touches.
  opaque: boolean;
  // Drawn in the blended pass.
  translucent: boolean;
  glows: boolean;
}

function info(tiles: readonly [number, number, number], extra: Partial<BlockInfo> = {}): BlockInfo {
  return { tiles, solid: true, opaque: true, translucent: false, glows: false, ...extra };
}

function same(tile: number): readonly [number, number, number] {
  return [tile, tile, tile];
}

export const BLOCKS: Record<BlockId, BlockInfo> = {
  [B.air]: info(same(0), { solid: false, opaque: false }),
  [B.grass]: info([T.grassTop, T.grassSide, T.dirt]),
  [B.dirt]: info(same(T.dirt)),
  [B.stone]: info(same(T.stone)),
  [B.fieldstone]: info(same(T.fieldstone)),
  [B.log]: info([T.logTop, T.logSide, T.logTop]),
  [B.planks]: info(same(T.planks)),
  [B.leaves]: info(same(T.leaves), { opaque: false }),
  [B.sand]: info(same(T.sand)),
  [B.water]: info(same(T.water), { solid: false, opaque: false, translucent: true }),
  [B.shelf]: info([T.planks, T.shelf, T.planks]),
  [B.gravel]: info(same(T.gravel)),
  [B.crystal]: info(same(T.crystal), { glows: true }),
  [B.paver]: info(same(T.paver)),
  [B.lantern]: info(same(T.lantern), { glows: true }),
  [B.glass]: info(same(T.glass), { opaque: false, translucent: true }),
  [B.bedrock]: info(same(T.bedrock)),
  [B.roof]: info(same(T.roof)),
  [B.terminal]: info([T.metal, T.terminal, T.metal], { glows: true }),
  [B.codeOre]: info(same(T.codeOre)),
  [B.metal]: info(same(T.metal)),
};

const BLOCK_IDS: ReadonlySet<number> = new Set(Object.values(B));

function toBlockId(value: number | undefined): BlockId {
  // eslint-disable-next-line typescript/no-unsafe-type-assertion -- the set holds exactly the BlockId values
  return value !== undefined && BLOCK_IDS.has(value) ? (value as BlockId) : B.air;
}

export const SIZE_X = 64;
export const SIZE_Z = 64;
export const SIZE_Y = 32;
export const SEA_LEVEL = 6;
export const GROUND = 9;

const CENTER = { x: 32, z: 32 };

export interface Landmark {
  section: GameSectionId;
  // Where the player stands to enter, one block in front of the doorway.
  door: { x: number; z: number };
  // A point on the path toward the plaza, used to route walks.
  approach: { x: number; z: number };
  // Where the floating sign sits.
  sign: { x: number; y: number; z: number };
}

export const LANDMARKS: readonly Landmark[] = [
  {
    section: 'home',
    door: { x: 32.5, z: 34.5 },
    approach: { x: 32.5, z: 34.5 },
    sign: { x: 32.5, y: GROUND + 5.5, z: 32.5 },
  },
  {
    section: 'story',
    door: { x: 21.5, z: 32.5 },
    approach: { x: 26.5, z: 32.5 },
    sign: { x: 16.5, y: GROUND + 10, z: 32.5 },
  },
];

export const SPAWN = { x: 32.5, y: GROUND + 1, z: 36.5 };

export interface World {
  get: (x: number, y: number, z: number) => BlockId;
  set: (x: number, y: number, z: number, block: BlockId) => void;
  isSolid: (x: number, y: number, z: number) => boolean;
  surfaceY: (x: number, z: number) => number;
}

function hash2(x: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fz = z / scale;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = fx - x0;
  const tz = fz - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

// Areas kept flat at GROUND: the plaza, each building's lot, and the paths.
function flatWeight(x: number, z: number): number {
  const lots = [
    { x: 32, z: 32, r: 5 },
    { x: 32, z: 16, r: 7 },
    { x: 48, z: 32, r: 7 },
    { x: 32, z: 48, r: 7 },
    { x: 16, z: 32, r: 7 },
  ];
  let weight = 0;
  for (const lot of lots) {
    const distance = Math.max(Math.abs(x - lot.x), Math.abs(z - lot.z));
    weight = Math.max(weight, 1 - Math.max(0, distance - lot.r) / 4);
  }
  const pathDistance = Math.min(Math.abs(x - 32), Math.abs(z - 32));
  const onCross = Math.abs(x - 32) <= 16 && Math.abs(z - 32) <= 16;
  if (onCross) {
    weight = Math.max(weight, 1 - Math.max(0, pathDistance - 2) / 3);
  }
  return Math.max(0, Math.min(1, weight));
}

function isPath(x: number, z: number): boolean {
  const alongX = Math.abs(z - 32) <= 1 && Math.abs(x - 32) <= 12;
  const alongZ = Math.abs(x - 32) <= 1 && Math.abs(z - 32) <= 12;
  return alongX || alongZ;
}

export function createWorld(seed = 7): World {
  const data = new Uint8Array(SIZE_X * SIZE_Y * SIZE_Z);
  const inBounds = (x: number, y: number, z: number) =>
    x >= 0 && x < SIZE_X && z >= 0 && z < SIZE_Z && y >= 0 && y < SIZE_Y;
  const index = (x: number, y: number, z: number) => x + z * SIZE_X + y * SIZE_X * SIZE_Z;

  const world: World = {
    get: (x, y, z) => (inBounds(x, y, z) ? toBlockId(data[index(x, y, z)]) : B.air),
    set: (x, y, z, block) => {
      if (inBounds(x, y, z)) {
        data[index(x, y, z)] = block;
      }
    },
    isSolid: (x, y, z) => {
      // The island edge and the floor are walls; the sky is open.
      if (x < 0 || x >= SIZE_X || z < 0 || z >= SIZE_Z || y < 0) {
        return true;
      }
      return BLOCKS[world.get(x, y, z)].solid;
    },
    surfaceY: (x, z) => {
      for (let y = SIZE_Y - 1; y >= 0; y -= 1) {
        if (BLOCKS[world.get(x, y, z)].solid) {
          return y + 1;
        }
      }
      return 0;
    },
  };

  const fill = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, block: BlockId) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) {
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += 1) {
          world.set(x, y, z, block);
        }
      }
    }
  };

  // Terrain: an island that falls off into water toward the edges.
  for (let x = 0; x < SIZE_X; x += 1) {
    for (let z = 0; z < SIZE_Z; z += 1) {
      const distance = Math.hypot(x - CENTER.x, z - CENTER.z) / 29;
      const falloff = 1 - distance ** 3;
      const hills = valueNoise(x, z, 9, seed) * 4 + valueNoise(x, z, 4, seed + 1) * 1.5 - 1.5;
      const natural = SEA_LEVEL - 3 + falloff * (GROUND - SEA_LEVEL + 3 + hills);
      const flat = flatWeight(x, z);
      const height = Math.round(natural * (1 - flat) + GROUND * flat);
      world.set(x, 0, z, B.bedrock);
      for (let y = 1; y <= height; y += 1) {
        let block: BlockId = B.stone;
        if (y === height) {
          block = height <= SEA_LEVEL + 1 ? B.sand : B.grass;
        } else if (y >= height - 3) {
          block = height <= SEA_LEVEL + 1 ? B.sand : B.dirt;
        }
        world.set(x, y, z, block);
      }
      for (let y = height + 1; y <= SEA_LEVEL; y += 1) {
        world.set(x, y, z, B.water);
      }
      if (isPath(x, z) && height === GROUND) {
        world.set(x, GROUND, z, B.gravel);
      }
    }
  }

  // Plaza (Home): pavers with a lantern set into the floor and at each corner.
  fill(28, GROUND, 28, 36, GROUND, 36, B.paver);
  world.set(32, GROUND, 32, B.lantern);
  for (const [x, z] of [
    [28, 28],
    [36, 28],
    [28, 36],
    [36, 36],
  ] as const) {
    world.set(x, GROUND + 1, z, B.lantern);
  }

  // A log cabin north of the plaza, door facing south.
  fill(29, GROUND, 14, 35, GROUND, 20, B.planks);
  fill(29, GROUND + 1, 14, 35, GROUND + 4, 20, B.planks);
  fill(30, GROUND + 1, 15, 34, GROUND + 4, 19, B.air);
  for (const [x, z] of [
    [29, 14],
    [35, 14],
    [29, 20],
    [35, 20],
  ] as const) {
    fill(x, GROUND + 1, z, x, GROUND + 4, z, B.log);
  }
  for (let layer = 0; layer < 4; layer += 1) {
    fill(28 + layer, GROUND + 5 + layer, 13 + layer, 36 - layer, GROUND + 5 + layer, 21 - layer, B.roof);
    if (layer < 3) {
      fill(29 + layer, GROUND + 5 + layer, 14 + layer, 35 - layer, GROUND + 5 + layer, 20 - layer, B.air);
    }
  }
  fill(32, GROUND + 1, 20, 32, GROUND + 2, 20, B.air);
  fill(30, GROUND + 2, 20, 30, GROUND + 3, 20, B.glass);
  fill(34, GROUND + 2, 20, 34, GROUND + 3, 20, B.glass);
  fill(29, GROUND + 2, 17, 29, GROUND + 3, 17, B.glass);
  fill(35, GROUND + 2, 17, 35, GROUND + 3, 17, B.glass);
  world.set(32, GROUND + 4, 17, B.lantern);

  // A stone library tower east of the plaza, door facing west.
  fill(45, GROUND + 1, 29, 51, GROUND + 7, 35, B.fieldstone);
  fill(46, GROUND + 1, 30, 50, GROUND + 6, 34, B.air);
  fill(45, GROUND + 3, 29, 51, GROUND + 3, 35, B.shelf);
  fill(46, GROUND + 3, 30, 50, GROUND + 3, 34, B.air);
  fill(44, GROUND + 8, 28, 52, GROUND + 8, 36, B.fieldstone);
  fill(45, GROUND + 8, 29, 51, GROUND + 8, 35, B.air);
  for (let x = 44; x <= 52; x += 2) {
    world.set(x, GROUND + 9, 28, B.fieldstone);
    world.set(x, GROUND + 9, 36, B.fieldstone);
  }
  for (let z = 28; z <= 36; z += 2) {
    world.set(44, GROUND + 9, z, B.fieldstone);
    world.set(52, GROUND + 9, z, B.fieldstone);
  }
  fill(45, GROUND + 1, 32, 45, GROUND + 2, 32, B.air);
  fill(50, GROUND + 1, 30, 50, GROUND + 4, 34, B.shelf);
  world.set(48, GROUND + 6, 32, B.lantern);

  // An open-front workshop south of the plaza.
  fill(28, GROUND + 1, 45, 36, GROUND + 5, 51, B.metal);
  fill(29, GROUND + 1, 45, 35, GROUND + 4, 50, B.air);
  fill(27, GROUND + 6, 44, 37, GROUND + 6, 52, B.planks);
  fill(29, GROUND + 2, 51, 35, GROUND + 3, 51, B.terminal);
  fill(30, GROUND + 1, 49, 34, GROUND + 1, 49, B.planks);
  world.set(29, GROUND + 4, 47, B.lantern);
  world.set(35, GROUND + 4, 47, B.lantern);

  // The Minecraft page: an arch of code ore and crystal west of the plaza.
  fill(14, GROUND + 1, 29, 18, GROUND + 7, 29, B.codeOre);
  fill(14, GROUND + 1, 35, 18, GROUND + 7, 35, B.codeOre);
  fill(14, GROUND + 7, 29, 18, GROUND + 8, 35, B.codeOre);
  fill(15, GROUND + 7, 30, 17, GROUND + 7, 34, B.air);
  fill(16, GROUND + 9, 31, 16, GROUND + 11, 33, B.crystal);
  fill(15, GROUND + 1, 31, 17, GROUND + 1, 33, B.crystal);
  fill(12, GROUND + 1, 30, 12, GROUND + 4, 34, B.codeOre);
  fill(12, GROUND + 2, 31, 12, GROUND + 3, 33, B.crystal);

  // Trees on open grass away from the lots and paths.
  const rng = mulberry32(seed * 31);
  let planted = 0;
  for (let attempt = 0; attempt < 400 && planted < 28; attempt += 1) {
    const x = 4 + Math.floor(rng() * (SIZE_X - 8));
    const z = 4 + Math.floor(rng() * (SIZE_Z - 8));
    const ground = world.surfaceY(x, z) - 1;
    if (world.get(x, ground, z) !== B.grass || flatWeight(x, z) > 0.05) {
      continue;
    }
    const trunk = 4 + Math.floor(rng() * 2);
    fill(x, ground + 1, z, x, ground + trunk, z, B.log);
    for (let dy = -1; dy <= 2; dy += 1) {
      const radius = dy >= 1 ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          const corner = Math.abs(dx) === radius && Math.abs(dz) === radius;
          if (corner && rng() < 0.6) {
            continue;
          }
          const y = ground + trunk + dy;
          if (world.get(x + dx, y, z + dz) === B.air) {
            world.set(x + dx, y, z + dz, B.leaves);
          }
        }
      }
    }
    planted += 1;
  }

  return world;
}
