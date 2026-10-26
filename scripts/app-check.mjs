// Course app check in real Chromium: every route at phone and desktop width,
// no horizontal overflow, no console errors, plus a walk through one lesson.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const DIST = 'dist', OUT = process.env.OUT ?? 'shots/app';
mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].replace(/^\/hanzi-trainer/, ''));
  if (p.endsWith('/')) p += 'index.html';
  try { const b = readFileSync(join(DIST, p)); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(4175);

const CUT = { '3346cc4d': 'earth', '640b239a': 'venus', '3d559490': 'mars' };
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
const routes = ['', 'course', 'lesson/starter-1/1', 'lesson/starter-1/2', 'lesson/starter-1/3', 'lesson/starter-1/4', 'lesson/starter-1/5', 'lesson/starter-1/6', 'lesson/starter-1/7', 'lesson/starter-1/8', 'lesson/jc1a-8/1', 'lesson/jc1a-8/6', 'lesson/jc1a-15/7', 'cards', 'pinyin', 'tones', 'grammar', 'hanzi', 'hanzi/好', 'settings'];
const only = process.env.ONLY;
let fail = 0;
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: process.env.LOCALE ?? 'ru-RU' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('https://d8j0ntlcm91z4.cloudfront.net/**', (r) => {
    const k = Object.keys(CUT).find((x) => r.request().url().includes(x));
    return k ? r.fulfill({ path: `scripts/fixtures/cut-${CUT[k]}.png` }) : r.fulfill({ status: 404 });
  });
  for (const r of routes) {
    if (only && !r.includes(only)) continue;
    await page.goto(`http://localhost:4175/hanzi-trainer/app/#/${r}`);
    await page.waitForTimeout(r.startsWith('hanzi/') || r.endsWith('/1') ? 1800 : 700);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    const name = (r || 'home').replace(/\//g, '_');
    await page.screenshot({ path: `${OUT}/${w}-${name}.png`, fullPage: true });
    const probs = [];
    if (m.sw > m.cw) probs.push(`overflow ${m.sw}>${m.cw}`);
    if (errors.length) probs.push('errors: ' + errors.splice(0).join(' | '));
    if (probs.length) { fail++; console.log(w, r || 'home', 'FAIL', probs.join('; ')); }
  }
  await ctx.close();
}
await b.close(); server.close();
console.log(fail ? `${fail} problems` : 'all ok');
process.exit(fail ? 1 : 0);
