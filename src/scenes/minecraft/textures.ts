// Every texture in the Minecraft theme is painted here from seeded noise, so the
// theme ships no image assets. Tiles are 16x16 and packed into one atlas.

export const TILE = 16;
export const ATLAS_COLUMNS = 8;
export const ATLAS_ROWS = 4;

export const T = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  fieldstone: 4,
  logSide: 5,
  logTop: 6,
  planks: 7,
  leaves: 8,
  sand: 9,
  water: 10,
  shelf: 11,
  gravel: 12,
  crystal: 13,
  paver: 14,
  lantern: 15,
  glass: 16,
  bedrock: 17,
  roof: 18,
  terminal: 19,
  codeOre: 20,
  metal: 21,
} as const;

type Painter = (px: Pixels, rng: () => number) => void;

interface Pixels {
  set: (x: number, y: number, color: string) => void;
  clear: (x: number, y: number) => void;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(palette: readonly string[], rng: () => number): string {
  return palette[Math.floor(rng() * palette.length)] ?? palette[0] ?? '#ff00ff';
}

function speckle(px: Pixels, rng: () => number, palette: readonly string[]): void {
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      px.set(x, y, pick(palette, rng));
    }
  }
}

const GREENS = ['#5f9a37', '#6aa83e', '#548a30', '#76b347', '#4f8a2c'];
const DIRT = ['#7a5233', '#6b472b', '#86603d', '#5d3d24', '#73502f'];
const STONE = ['#7d7f84', '#76787d', '#85888d', '#6e7075'];
const PLANK = ['#b0834f', '#a87b49', '#b98c57'];
const BARK = ['#6b4a2b', '#5a3c22', '#77522f'];

const PAINTERS: Record<number, Painter> = {
  [T.grassTop]: (px, rng) => speckle(px, rng, GREENS),
  [T.grassSide]: (px, rng) => {
    speckle(px, rng, DIRT);
    for (let x = 0; x < TILE; x += 1) {
      const depth = 3 + Math.floor(rng() * 3);
      for (let y = 0; y < depth; y += 1) {
        px.set(x, y, pick(GREENS, rng));
      }
    }
  },
  [T.dirt]: (px, rng) => speckle(px, rng, DIRT),
  [T.stone]: (px, rng) => {
    speckle(px, rng, STONE);
    for (let i = 0; i < 5; i += 1) {
      const x = Math.floor(rng() * 13);
      const y = Math.floor(rng() * 15);
      for (let k = 0; k < 3; k += 1) {
        px.set(x + k, y, '#606267');
      }
    }
  },
  [T.fieldstone]: (px, rng) => {
    // Rows of uneven stones with dark mortar between them.
    speckle(px, rng, ['#4d4f53']);
    for (let row = 0; row < 4; row += 1) {
      let x = row % 2 === 0 ? 0 : -2;
      while (x < TILE) {
        const width = 3 + Math.floor(rng() * 3);
        const shade = pick(['#8d9096', '#7f8288', '#999ca1', '#868990'], rng);
        for (let dx = 0; dx < width - 1; dx += 1) {
          for (let dy = 0; dy < 3; dy += 1) {
            const sx = x + dx;
            if (sx >= 0 && sx < TILE) {
              px.set(sx, row * 4 + dy, dy === 0 ? '#a3a6ab' : shade);
            }
          }
        }
        x += width;
      }
    }
  },
  [T.logSide]: (px, rng) => {
    for (let x = 0; x < TILE; x += 1) {
      const base = pick(BARK, rng);
      for (let y = 0; y < TILE; y += 1) {
        px.set(x, y, rng() < 0.15 ? pick(BARK, rng) : base);
      }
    }
  },
  [T.logTop]: (px, rng) => {
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        const ring = Math.floor(Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)));
        if (ring >= 7) {
          px.set(x, y, pick(BARK, rng));
        } else {
          px.set(x, y, ring % 2 === 0 ? '#c49a62' : '#a97f4c');
        }
      }
    }
  },
  [T.planks]: (px, rng) => {
    for (let board = 0; board < 4; board += 1) {
      const tone = pick(PLANK, rng);
      const seam = Math.floor(rng() * 12) + 2;
      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < TILE; x += 1) {
          const edge = y === 3 || x === seam;
          px.set(x, board * 4 + y, edge ? '#7c5631' : rng() < 0.12 ? '#9c7041' : tone);
        }
      }
    }
  },
  [T.leaves]: (px, rng) => {
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        if (rng() < 0.18) {
          px.clear(x, y);
        } else {
          px.set(x, y, pick(['#3f7a2a', '#356b23', '#4a8a31', '#2e5f1f'], rng));
        }
      }
    }
  },
  [T.sand]: (px, rng) => speckle(px, rng, ['#dccb8f', '#d3c084', '#e4d59f', '#cfbb7c']),
  [T.water]: (px, rng) => speckle(px, rng, ['#3d6fb8cc', '#3567adcc', '#4a7fc6cc', '#4378bfcc']),
  [T.shelf]: (px, rng) => {
    speckle(px, rng, ['#8e6538']);
    const spines = ['#a63d3d', '#3d5ea6', '#3d8a5a', '#c99a2e', '#6d3d8a', '#d9d2c3'];
    for (const top of [2, 9]) {
      let x = 1;
      while (x < 15) {
        const color = pick(spines, rng);
        const height = 4 + Math.floor(rng() * 2);
        for (let y = top + (5 - height); y < top + 5; y += 1) {
          px.set(x, y, color);
        }
        x += 1 + (rng() < 0.3 ? 1 : 0);
      }
    }
  },
  [T.gravel]: (px, rng) => speckle(px, rng, ['#8a8580', '#77726c', '#9a948d', '#6b6660', '#a29b92']),
  [T.crystal]: (px, rng) => {
    speckle(px, rng, ['#2fc4b2', '#3ad8c4', '#29ad9e']);
    for (let i = 0; i < TILE; i += 1) {
      px.set(i, i, '#b8fff3');
      px.set(TILE - 1 - i, (i + 5) % TILE, '#7cf5e2');
    }
  },
  [T.paver]: (px, rng) => {
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        const grout = x % 8 === 0 || y % 8 === 0;
        px.set(x, y, grout ? '#4a4f5c' : pick(['#7c8597', '#737c8e', '#848da0'], rng));
      }
    }
  },
  [T.lantern]: (px, rng) => {
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        const frame = x < 2 || y < 2 || x > 13 || y > 13 || x === 7 || x === 8;
        px.set(x, y, frame ? '#3b3226' : pick(['#ffd36b', '#f2c14e', '#ffe08f'], rng));
      }
    }
  },
  [T.glass]: (px) => {
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        const frame = x === 0 || y === 0 || x === 15 || y === 15;
        if (frame) {
          px.set(x, y, '#d8e9f2');
        } else if (x - y === 4 || x - y === 6) {
          px.set(x, y, '#ffffff88');
        } else {
          px.clear(x, y);
        }
      }
    }
  },
  [T.bedrock]: (px, rng) => speckle(px, rng, ['#2a2a2e', '#3a3a3f', '#1f1f22']),
  [T.roof]: (px, rng) => {
    for (let row = 0; row < 4; row += 1) {
      const offset = row % 2 === 0 ? 0 : 2;
      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < TILE; x += 1) {
          const edge = y === 3 || (x + offset) % 4 === 0;
          px.set(x, row * 4 + y, edge ? '#2b3445' : pick(['#45536b', '#4c5b75', '#3f4c62'], rng));
        }
      }
    }
  },
  [T.terminal]: (px, rng) => {
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        const frame = x < 1 || y < 1 || x > 14 || y > 14;
        px.set(x, y, frame ? '#9aa1aa' : '#11161c');
      }
    }
    for (let line = 0; line < 5; line += 1) {
      const indent = 2 + Math.floor(rng() * 3);
      const length = 3 + Math.floor(rng() * 8);
      const color = line === 0 ? '#f2c14e' : '#7ee07e';
      for (let x = indent; x < Math.min(indent + length, 14); x += 1) {
        px.set(x, 3 + line * 2, color);
      }
    }
  },
  [T.codeOre]: (px, rng) => {
    speckle(px, rng, STONE);
    // Circuit traces with solder pads: ore for people who write code.
    const traces: [number, number, number, number][] = [
      [2, 3, 9, 3],
      [9, 3, 9, 10],
      [4, 12, 13, 12],
      [4, 7, 4, 12],
    ];
    for (const [x0, y0, x1, y1] of traces) {
      for (let x = x0; x <= x1; x += 1) {
        for (let y = y0; y <= y1; y += 1) {
          px.set(x, y, '#45c96b');
        }
      }
    }
    for (const [x, y] of [
      [2, 3],
      [9, 10],
      [13, 12],
      [4, 7],
    ] as const) {
      px.set(x, y, '#f2c14e');
      px.set(x + 1, y, '#f2c14e');
    }
  },
  [T.metal]: (px, rng) => {
    for (let y = 0; y < TILE; y += 1) {
      const tone = pick(['#a9b0b8', '#9ea5ad', '#b3bac2'], rng);
      for (let x = 0; x < TILE; x += 1) {
        const rivet = (x === 2 || x === 13) && (y === 2 || y === 13);
        px.set(x, y, rivet ? '#6c737b' : tone);
      }
    }
  },
};

export function paintAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * ATLAS_COLUMNS;
  canvas.height = TILE * ATLAS_ROWS;
  const context = canvas.getContext('2d');
  if (context === null) {
    return canvas;
  }
  for (const [key, painter] of Object.entries(PAINTERS)) {
    const index = Number(key);
    const originX = (index % ATLAS_COLUMNS) * TILE;
    const originY = Math.floor(index / ATLAS_COLUMNS) * TILE;
    painter(
      {
        set: (x, y, color) => {
          context.fillStyle = color;
          context.fillRect(originX + x, originY + y, 1, 1);
        },
        clear: (x, y) => context.clearRect(originX + x, originY + y, 1, 1),
      },
      mulberry32(1009 * (index + 1)),
    );
  }
  return canvas;
}

// Draws a small isometric block from atlas tiles, for hotbar icons.
export function paintBlockIcon(atlas: HTMLCanvasElement, top: number, side: number): string {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context === null) {
    return '';
  }
  context.imageSmoothingEnabled = false;
  const source = (tile: number): [number, number] => [
    (tile % ATLAS_COLUMNS) * TILE,
    Math.floor(tile / ATLAS_COLUMNS) * TILE,
  ];
  const faces: { tile: number; shade: number; transform: [number, number, number, number, number, number] }[] = [
    { tile: top, shade: 0, transform: [1.5, 0.75, -1.5, 0.75, 24, 0] },
    { tile: side, shade: 0.25, transform: [1.5, 0.75, 0, 1.5, 0, 12] },
    { tile: side, shade: 0.4, transform: [1.5, -0.75, 0, 1.5, 24, 24] },
  ];
  for (const face of faces) {
    const [sx, sy] = source(face.tile);
    context.setTransform(...face.transform);
    context.drawImage(atlas, sx, sy, TILE, TILE, 0, 0, TILE, TILE);
    context.fillStyle = `rgba(0, 0, 0, ${face.shade})`;
    context.fillRect(0, 0, TILE, TILE);
  }
  return canvas.toDataURL();
}
