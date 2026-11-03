/**
 * The run is authored as text, one character per block, and repeats as a
 * loop. Each section gets an obstacle pattern followed by a portal that sits
 * at jump height: run under it to keep going, jump through it to open that
 * page.
 *
 *   .  empty        ^  spike         #  block (one high, can be stood on)
 *   *  jump pad     C  checkpoint    @  portal for the next section
 */
export type Obstacle =
  | { readonly kind: 'spike'; readonly x: number }
  | { readonly kind: 'block'; readonly x: number }
  | { readonly kind: 'pad'; readonly x: number };

export interface Portal {
  readonly x: number;
  readonly section: number;
}

export interface Level {
  readonly length: number;
  readonly obstacles: readonly Obstacle[];
  /** Obstacles indexed by column, for collision lookups. */
  readonly columns: readonly (readonly Obstacle[])[];
  readonly portals: readonly Portal[];
  readonly checkpoints: readonly number[];
}

/** Patterns rotate per section. Every one is cleared by the assist bot in tests. */
export const patterns: readonly string[] = [
  '......^.........^..........^^.......',
  '......#.......#^.........*.^^^......',
  '.....##......^.^........####^.......',
  '......^^.........*.^^^........^.....',
  '.....#..#.......^^........#^........',
];

const runIn = 'C.......';
const portalApproach = '.........@.........';

export function levelSource(sectionCount: number): string {
  let source = runIn;
  for (let section = 0; section < sectionCount; section += 1) {
    source += `C${patterns[section % patterns.length] ?? ''}${portalApproach}`;
  }
  return source;
}

export function parseLevel(source: string): Level {
  const obstacles: Obstacle[] = [];
  const portals: Portal[] = [];
  const checkpoints: number[] = [];
  const columns: Obstacle[][] = Array.from({ length: source.length }, () => []);

  for (let x = 0; x < source.length; x += 1) {
    const character = source.charAt(x);
    const column = columns[x];
    const add = (obstacle: Obstacle) => {
      obstacles.push(obstacle);
      column?.push(obstacle);
    };
    switch (character) {
      case '^':
        add({ kind: 'spike', x });
        break;
      case '#':
        add({ kind: 'block', x });
        break;
      case '*':
        add({ kind: 'pad', x });
        break;
      case '@':
        portals.push({ x, section: portals.length });
        break;
      case 'C':
        checkpoints.push(x);
        break;
      case '.':
        break;
      default:
        throw new Error(`Unknown level character "${character}" at column ${x}`);
    }
  }

  return { length: source.length, obstacles, columns, portals, checkpoints };
}
