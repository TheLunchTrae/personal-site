import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://localhost:4310';
const shots = [
  ['01-default-home', 'default', 'off', '/'],
  ['02-default-gd-story', 'default', 'off', '/influences/geometry-dash/'],
  ['03-minecraft-off-story', 'minecraft', 'off', '/influences/minecraft/'],
  ['04-minecraft-on-home', 'minecraft', 'on', '/'],
  ['05-minecraft-on-credits', 'minecraft', 'on', '/credits/minecraft/'],
  ['06-gd-off-levels', 'geometry-dash', 'off', '/influences/geometry-dash/levels/'],
  ['07-gd-on-story', 'geometry-dash', 'on', '/influences/geometry-dash/'],
  ['08-gd-on-levels', 'geometry-dash', 'on', '/influences/geometry-dash/levels/'],
  ['09-cod-off-credits', 'call-of-duty', 'off', '/credits/call-of-duty/'],
  ['10-cod-tv-wall-on-home', 'call-of-duty', 'on', '/', 'screens'],
  ['11-cod-globe-on-story', 'call-of-duty', 'on', '/influences/call-of-duty/', 'globe'],
  ['12-cod-gumball-on-credits', 'call-of-duty', 'on', '/credits/call-of-duty/', 'machine'],
];
const viewports = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const [vpName, vp] of Object.entries(viewports)) {
  for (const [name, theme, play, route, menu] of shots) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      deviceScaleFactor: vp.deviceScaleFactor ?? 1,
    });
    await ctx.addInitScript(
      ([theme, play, menu]) => {
        localStorage.setItem('theme', theme);
        localStorage.setItem('play', play);
        localStorage.setItem('call-of-duty:quality', 'low');
        if (menu) localStorage.setItem('call-of-duty:menu', menu);
      },
      [theme, play, menu],
    );
    const page = await ctx.newPage();
    await page.goto(base + route, { waitUntil: 'load' });
    await page.waitForTimeout(play === 'on' ? 6000 : 1200);
    await page.screenshot({ path: `out/shots/${vpName}-${name}.png` });
    await ctx.close();
  }
}
// Keyboard walk on the phone-free desktop: Tab from the top in Geometry Dash with gameplay on.
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: 'out/video', size: { width: 1280, height: 800 } },
});
await ctx.addInitScript(() => {
  localStorage.setItem('theme', 'geometry-dash');
  localStorage.setItem('play', 'on');
});
const page = await ctx.newPage();
await page.goto(base + '/influences/geometry-dash/levels/');
await page.waitForTimeout(2500);
for (const label of ['Home', 'Geometry Dash', 'Credits', 'Favorite levels']) {
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: label, exact: true }).click();
  await page.waitForTimeout(2200);
}
await page.evaluate(() => localStorage.setItem('play', 'off'));
await page.getByRole('button', { name: /Gameplay/ }).click();
await page.waitForTimeout(800);
for (const label of ['Home', 'Credits', 'Geometry Dash']) {
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: label, exact: true }).click();
  await page.waitForTimeout(1500);
}
await ctx.close();
await browser.close();
