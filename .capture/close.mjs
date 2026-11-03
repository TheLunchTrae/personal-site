// Temporary: measure the Minecraft gameplay close button against the open page on phones.
import { chromium } from 'playwright';

const targets = { before: 'http://localhost:4311', after: 'http://localhost:4310' };
const widths = [360, 390, 430];
const routes = ['/credits/minecraft/', '/influences/minecraft/'];
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const [label, base] of Object.entries(targets)) {
  for (const width of widths) {
    for (const route of routes) {
      const ctx = await browser.newContext({
        viewport: { width, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      });
      await ctx.addInitScript(() => {
        localStorage.setItem('theme', 'minecraft');
        localStorage.setItem('play', 'on');
      });
      const page = await ctx.newPage();
      await page.goto(base + route, { waitUntil: 'load' });
      await page.waitForTimeout(6000);
      const slug = `${label}-${width}-${route.split('/').filter(Boolean).join('-')}`;
      await page.screenshot({ path: `out/shots/${slug}-top.png` });
      const m = await page.evaluate(() => {
        const r = (sel) => {
          const el = document.querySelector(sel);
          if (!el) {
            return null;
          }
          const b = el.getBoundingClientRect();
          return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) };
        };
        const panel = document.querySelector('.prose-page');
        panel.scrollTop = panel.scrollHeight;
        const links = [...panel.querySelectorAll('a')];
        const last = links.at(-1);
        let lastOk = null;
        if (last) {
          const b = last.getBoundingClientRect();
          const hit = document.elementFromPoint(b.left + 4, b.top + b.height / 2);
          lastOk = hit !== null && last.contains(hit);
        }
        return { close: r('.blocks-close'), panel: r('.prose-page'), hotbar: r('.blocks-hotbar'), lines: getComputedStyle(document.querySelector('.blocks-close')).height, lastLinkClickable: lastOk };
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `out/shots/${slug}-bottom.png` });
      const overlapPanel = m.close && m.panel ? m.close.top < m.panel.bottom : null;
      const overlapHotbar = m.close && m.hotbar ? m.close.bottom > m.hotbar.top : null;
      console.log(`${slug}: close ${JSON.stringify(m.close)} h=${m.lines} panel ${JSON.stringify(m.panel)} hotbar ${JSON.stringify(m.hotbar)} coversPanel=${overlapPanel} coversHotbar=${overlapHotbar} lastLinkClickable=${m.lastLinkClickable}`);
      await ctx.close();
    }
  }
}
await browser.close();
