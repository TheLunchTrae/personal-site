import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const [state, pages] of Object.entries(data)) {
  const routes = Object.keys(pages);
  const bad = [];
  for (const mode of ['links', 'keyboard']) {
    const adj = Object.fromEntries(routes.map((r) => [r, pages[r][mode].filter((l) => routes.includes(l))]));
    for (const start of routes) {
      const seen = new Set([start]);
      const q = [start];
      while (q.length) {
        for (const n of adj[q.shift()])
          if (!seen.has(n)) {
            seen.add(n);
            q.push(n);
          }
      }
      const miss = routes.filter((r) => !seen.has(r));
      if (miss.length) bad.push(`${mode} from ${start} misses ${miss.join(', ')}`);
    }
  }
  const notices = routes.filter((r) => pages[r].notice).length;
  console.log(
    `\n## ${state}${notices ? ` (gameplay notice on ${notices} pages)` : ''}: ${bad.length ? 'TRAPS' : 'ok'}`,
  );
  for (const r of routes)
    console.log(`  ${r} -> click: ${pages[r].links.join(' ') || '-'} | tab: ${pages[r].keyboard.join(' ') || '-'}`);
  if (bad.length) console.log('  ' + bad.slice(0, 6).join('\n  '));
}
