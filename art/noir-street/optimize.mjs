// Compresses the exported street for the web: node optimize.mjs in.glb out.glb maxTexture quality
// Unlit meshes (baked atlases, neon, lamp glass) drop their normals; geometry is
// meshopt-compressed and textures become WebP, resized to maxTexture.
import { argv, stdout } from 'node:process';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [input, output, max, quality] = argv.slice(2);
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(input);

const unlit = (name) => name.startsWith('Baked_') || name.startsWith('Neon_') || name.startsWith('LampGlass');
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const name = prim.getMaterial()?.getName() ?? '';
    if (unlit(name) || unlit(mesh.getName())) {
      prim.setAttribute('NORMAL', null);
      if (!name.startsWith('Baked_')) {
        prim.setAttribute('TEXCOORD_0', null);
      }
    }
  }
}

await doc.transform(
  dedup(),
  weld(),
  textureCompress({
    encoder: sharp,
    targetFormat: 'webp',
    quality: Number(quality),
    resize: [Number(max), Number(max)],
  }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  prune(),
);
await io.write(output, doc);
for (const tex of doc.getRoot().listTextures()) {
  stdout.write(`${tex.getName()} ${tex.getMimeType()} ${Math.round((tex.getImage()?.byteLength ?? 0) / 1024)} KB\n`);
}
