import { ATLAS_COLUMNS, ATLAS_ROWS } from './textures';
import { B, BLOCKS, SIZE_X, SIZE_Y, SIZE_Z, type World } from './world';

export interface MeshArrays {
  positions: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

type Vec3 = readonly [number, number, number];

interface Face {
  normal: Vec3;
  // Corners in bottom-left, top-left, top-right, bottom-right order as seen
  // from outside the block, so side textures stay upright.
  corners: readonly [Vec3, Vec3, Vec3, Vec3];
  tileSlot: 0 | 1 | 2;
  shade: number;
}

const FACES: readonly Face[] = [
  {
    normal: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 1, 1],
      [1, 1, 0],
      [1, 0, 0],
    ],
    tileSlot: 1,
    shade: 0.8,
  },
  {
    normal: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ],
    tileSlot: 1,
    shade: 0.8,
  },
  {
    normal: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [0, 1, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    tileSlot: 0,
    shade: 1,
  },
  {
    normal: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
      [1, 0, 0],
    ],
    tileSlot: 2,
    shade: 0.55,
  },
  {
    normal: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
      [1, 0, 1],
    ],
    tileSlot: 1,
    shade: 0.9,
  },
  {
    normal: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 0],
    ],
    tileSlot: 1,
    shade: 0.7,
  },
];

const UV_CORNERS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, 1],
  [1, 1],
  [1, 0],
];

class Builder {
  positions: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

  finish(): MeshArrays {
    return {
      positions: new Float32Array(this.positions),
      uvs: new Float32Array(this.uvs),
      colors: new Float32Array(this.colors),
      indices: new Uint32Array(this.indices),
    };
  }
}

// Builds one opaque and one translucent mesh for the whole world. Faces next
// to an opaque block are skipped, and corner shading darkens creases.
export function meshWorld(world: World): { opaque: MeshArrays; translucent: MeshArrays } {
  const opaque = new Builder();
  const translucent = new Builder();
  const occludes = (x: number, y: number, z: number) => {
    const block = world.get(x, y, z);
    return block !== B.air && BLOCKS[block].opaque;
  };

  for (let y = 0; y < SIZE_Y; y += 1) {
    for (let z = 0; z < SIZE_Z; z += 1) {
      for (let x = 0; x < SIZE_X; x += 1) {
        const block = world.get(x, y, z);
        if (block === B.air) {
          continue;
        }
        const definition = BLOCKS[block];
        const target = definition.translucent ? translucent : opaque;
        for (const face of FACES) {
          const [nx, ny, nz] = face.normal;
          const neighbour = world.get(x + nx, y + ny, z + nz);
          if (neighbour !== B.air && (BLOCKS[neighbour].opaque || neighbour === block)) {
            continue;
          }
          const tile = definition.tiles[face.tileSlot];
          const u0 = (tile % ATLAS_COLUMNS) / ATLAS_COLUMNS;
          const v1 = 1 - Math.floor(tile / ATLAS_COLUMNS) / ATLAS_ROWS;
          const v0 = v1 - 1 / ATLAS_ROWS;
          const tangents = [0, 1, 2].filter((axis) => face.normal[axis] === 0);
          const base = target.positions.length / 3;
          const light: number[] = [];

          face.corners.forEach((corner, cornerIndex) => {
            target.positions.push(x + corner[0], y + corner[1], z + corner[2]);
            const [cu, cv] = UV_CORNERS[cornerIndex] ?? [0, 0];
            target.uvs.push(u0 + cu / ATLAS_COLUMNS, v0 + cv / ATLAS_ROWS);

            let level = 3;
            if (!definition.glows && !definition.translucent) {
              const front: [number, number, number] = [x + nx, y + ny, z + nz];
              const side = (axis: number) => {
                const offset: [number, number, number] = [...front];
                offset[axis] = (offset[axis] ?? 0) + ((corner[axis] ?? 0) === 1 ? 1 : -1);
                return offset;
              };
              const [a = 0, b = 0] = tangents;
              const s1 = side(a);
              const s2 = side(b);
              const diagonal: [number, number, number] = [...s1];
              diagonal[b] = s2[b] ?? 0;
              const o1 = occludes(...s1) ? 1 : 0;
              const o2 = occludes(...s2) ? 1 : 0;
              const o3 = occludes(...diagonal) ? 1 : 0;
              level = o1 === 1 && o2 === 1 ? 0 : 3 - (o1 + o2 + o3);
            }
            light.push(level);
            const brightness = definition.glows ? 1 : face.shade * (0.5 + level / 6);
            target.colors.push(brightness, brightness, brightness);
          });

          // Split the quad along the brighter diagonal so shading stays smooth.
          const [l0 = 3, l1 = 3, l2 = 3, l3 = 3] = light;
          if (l0 + l2 >= l1 + l3) {
            target.indices.push(base, base + 3, base + 2, base, base + 2, base + 1);
          } else {
            target.indices.push(base + 1, base, base + 3, base + 1, base + 3, base + 2);
          }
        }
      }
    }
  }

  return { opaque: opaque.finish(), translucent: translucent.finish() };
}
