import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

type Palette = Map<string, string>;

const css = await readFile(new URL('globals.css', import.meta.url), 'utf8');
const design = await readFile(new URL('../../DESIGN.md', import.meta.url), 'utf8');

// Reads `name: value` pairs from a pattern's capture groups, lowercasing the hex.
function readPalette(text: string, pattern: RegExp, valueGroup: number): Palette {
  const palette: Palette = new Map();
  for (const match of text.matchAll(pattern)) {
    const name = match[1];
    const value = match[valueGroup];
    assert.ok(name !== undefined && value !== undefined, `pattern captures a name and value in ${match[0]}`);
    palette.set(name, value.toLowerCase());
  }
  return palette;
}

function blockAfter(opener: string): Palette {
  const start = css.indexOf(opener);
  assert.notEqual(start, -1, `globals.css has ${opener}`);
  return readPalette(css.slice(start, css.indexOf('}', start)), /(--[\w-]+):\s*(#[\da-f]{6});/gi, 2);
}

const light = blockAfter(':root {');
const dark = blockAfter(":root[data-color-mode='dark'] {");
const systemDark = blockAfter(":root[data-color-mode='system'] {");

// WCAG 2.2 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const linear = (index: number): number => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

function contrast(palette: Palette, front: string, back: string): number {
  const color = (name: string): string => {
    const value = palette.get(name);
    assert.ok(value !== undefined, `globals.css defines ${name}`);
    return value;
  };
  const one = luminance(color(front));
  const other = luminance(color(back));
  return (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05);
}

// Text pairs need 4.5:1 (1.4.3); control outlines and focus need 3:1 (1.4.11).
const pairs: [front: string, back: string, minimum: number][] = [
  ['--foreground', '--background', 4.5],
  ['--foreground', '--surface', 4.5],
  ['--foreground', '--tint', 4.5],
  ['--muted', '--background', 4.5],
  ['--muted', '--surface', 4.5],
  ['--muted', '--sky-top', 4.5],
  ['--link', '--background', 4.5],
  ['--on-primary', '--primary', 4.5],
  ['--on-primary', '--primary-hover', 4.5],
  ['--control-border', '--background', 3],
  ['--control-border', '--surface', 3],
  ['--focus', '--background', 3],
];

await test('text and control colors meet WCAG AA in both color modes', () => {
  for (const [mode, palette] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    for (const [front, back, minimum] of pairs) {
      const ratio = contrast(palette, front, back);
      assert.ok(ratio >= minimum, `${mode}: ${front} on ${back} is ${ratio.toFixed(2)}:1, under ${minimum}:1`);
    }
  }
});

await test('the system dark palette matches the chosen dark palette', () => {
  assert.deepEqual(systemDark, dark);
});

// DESIGN.md gives each token's value next to its role; this keeps the table
// and the CSS from drifting apart.
await test("DESIGN.md's color table matches globals.css", () => {
  const row = /^\| `(--[\w-]+)`\s*\| `(#[\da-f]{6})`\s*\| `(#[\da-f]{6})`/gim;
  assert.deepEqual(readPalette(design, row, 2), light);
  assert.deepEqual(readPalette(design, row, 3), dark);
});
