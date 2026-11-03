import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://localhost:4310';
const routes = [
  '/',
  '/influences/minecraft/',
  '/influences/geometry-dash/',
  '/influences/geometry-dash/levels/',
  '/influences/call-of-duty/',
  '/credits/minecraft/',
  '/credits/geometry-dash/',
  '/credits/call-of-duty/',
];
const states = [
  { name: 'default', theme: 'default', play: 'off' },
  { name: 'minecraft-off', theme: 'minecraft', play: 'off' },
  { name: 'minecraft-on', theme: 'minecraft', play: 'on' },
  { name: 'geometry-dash-off', theme: 'geometry-dash', play: 'off' },
  { name: 'geometry-dash-on', theme: 'geometry-dash', play: 'on' },
  { name: 'cod-off', theme: 'call-of-duty', play: 'off' },
  { name: 'cod-screens-on', theme: 'call-of-duty', play: 'on', menu: 'screens' },
  { name: 'cod-globe-on', theme: 'call-of-duty', play: 'on', menu: 'globe' },
  { name: 'cod-machine-on', theme: 'call-of-duty', play: 'on', menu: 'machine', quality: 'low' },
];
const viewports = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true },
};
const only = process.env.ONLY;
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const result = {};
for (const [vpName, vp] of Object.entries(viewports)) {
  for (const s of states) {
    if (only && !s.name.startsWith(only)) continue;
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    });
    await ctx.addInitScript((s) => {
      localStorage.setItem('theme', s.theme);
      localStorage.setItem('play', s.play);
      if (s.menu) localStorage.setItem('call-of-duty:menu', s.menu);
      if (s.quality) localStorage.setItem('call-of-duty:quality', s.quality);
    }, s);
    const page = await ctx.newPage();
    const key = `${vpName}/${s.name}`;
    result[key] = {};
    for (const r of routes) {
      await page.goto(base + r, { waitUntil: 'load' });
      await page.waitForTimeout(s.play === 'on' ? 2500 : 600);
      const links = await page.evaluate(() => {
        const out = new Set();
        for (const a of document.querySelectorAll('a[href]')) {
          const url = new URL(a.href, location.href);
          if (url.origin !== location.origin || url.pathname.endsWith('.pdf')) continue;
          if (!a.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
          const rect = a.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) continue;
          a.scrollIntoView({ block: 'center' });
          const r2 = a.getBoundingClientRect();
          const x = r2.left + r2.width / 2,
            y = r2.top + r2.height / 2;
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) {
            out.add(url.pathname + ' (offscreen)');
            continue;
          }
          const hit = document.elementFromPoint(x, y);
          if (hit !== a && !a.contains(hit)) {
            out.add(url.pathname + ' (covered)');
            continue;
          }
          out.add(url.pathname);
        }
        window.scrollTo(0, 0);
        return [...out].sort();
      });
      // keyboard
      const tabbed = new Set();
      await page.evaluate(() => {
        document.activeElement?.blur();
      });
      for (let i = 0; i < 50; i++) {
        await page.keyboard.press('Tab');
        const h = await page.evaluate(() => {
          const a = document.activeElement;
          return a && a.tagName === 'A' ? new URL(a.href).pathname : null;
        });
        if (h) tabbed.add(h);
      }
      const notice = await page.locator('.game-notice').count();
      result[key][r] = { links, keyboard: [...tabbed].filter((h) => !h.endsWith('.pdf')).sort(), notice };
    }
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify(result, null, 1));
