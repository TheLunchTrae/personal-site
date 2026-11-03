// Turns render.py's panoramas into the WebP files the site serves:
// node panoramas.mjs <render dir> <public/scenes/noir-street>
// The skyline comes in two widths, 4096 for the High preset and 2048 for the
// others; the sky and the reflection map are small already.
import { argv, stdout } from 'node:process';

import sharp from 'sharp';

const [from, to] = argv.slice(2);
const jobs = [
  ['backdrop.png', 'backdrop-4k.webp', 4096, 86],
  ['backdrop.png', 'backdrop-2k.webp', 2048, 82],
  ['sky.png', 'sky.webp', 512, 90],
  ['environment.png', 'environment.webp', 1024, 80],
];
for (const [input, output, width, quality] of jobs) {
  const info = await sharp(`${from}/${input}`)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toFile(`${to}/${output}`);
  stdout.write(`${output} ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB\n`);
}
