// Captures the loading posters from the live scene, so the poster and the
// first drawn frame match: node poster.mjs <site url> <public/scenes/noir-street>
// Needs playwright-core and a Chromium: set CHROMIUM to its executable, and
// CHROMIUM_ARGS to any extra flags it needs (space separated).
import { argv, env, stdout } from 'node:process';

import { chromium } from 'playwright-core';
import sharp from 'sharp';

const [site, to] = argv.slice(2);
const browser = await chromium.launch({
  executablePath: env['CHROMIUM'],
  args: ['--ignore-gpu-blocklist', ...(env['CHROMIUM_ARGS'] ?? '').split(' ').filter(Boolean)],
});
const views = [
  ['poster-wide', { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 }],
  ['poster-tall', { viewport: { width: 430, height: 932 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }],
];
for (const [name, options] of views) {
  const context = await browser.newContext({ ...options, reducedMotion: 'reduce' });
  // The High preset, with rain and glow, and the theme's gameplay on. Scripts
  // that run in the page are strings, since they run in the browser.
  const choices = {
    theme: 'call-of-duty',
    play: 'on',
    'call-of-duty:menu': 'machine',
    'call-of-duty:quality': 'high',
    'call-of-duty:effects': 'on',
  };
  await context.addInitScript(
    Object.entries(choices)
      .map(([key, value]) => `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});`)
      .join(''),
  );
  const page = await context.newPage();
  await page.goto(site);
  // The stage drops its loading mark once the street is drawn.
  await page.waitForFunction(
    "document.querySelector('.cod-menu-scene[data-scene=machine]:not([data-loading])') !== null",
    null,
    {
      timeout: 180_000,
    },
  );
  // Only the scene: no controls over it, no poster behind it, no fade in.
  await page.addStyleTag({
    content:
      '.cod-menu-bar, .cod-menu-switch, .cod-hud { visibility: hidden !important; } ' +
      '.cod-menu-scene { background-image: none !important; } ' +
      '.cod-menu-canvas { transition: none !important; opacity: 1 !important; }',
  });
  await page.waitForTimeout(3000);
  const shot = await page.locator('.cod-menu-canvas').screenshot();
  const info = await sharp(shot).webp({ quality: 80 }).toFile(`${to}/${name}.webp`);
  stdout.write(`${name} ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB\n`);
  await context.close();
}
await browser.close();
