// Landing-page check in real Chromium: layout at many sizes, no horizontal
// overflow, planet switching reversible, entrance cleans up after itself.
// CDN assets are replaced with local stand-ins of the same geometry.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const DIST = 'dist', OUT = process.env.OUT ?? 'shots/hero';
mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].replace(/^\/hanzi-trainer/, ''));
  if (p.endsWith('/')) p += 'index.html';
  try { const b = readFileSync(join(DIST, p)); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(4174);

const CUT = { '3346cc4d': 'earth', '640b239a': 'venus', '3d559490': 'mars' };
const STILL = { '508c64b8': 'earth', 'cf55d1d8': 'venus', '0ba6de7c': 'mars' };
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
const sizes = [[320, 568], [375, 667], [390, 844], [430, 932], [480, 800], [540, 720], [768, 1024], [820, 1180], [1024, 768], [1280, 800], [1353, 1163], [1440, 900], [1920, 1080], [2560, 1440], [844, 390]];
let fail = 0;
for (const [w, h] of sizes) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route('https://d8j0ntlcm91z4.cloudfront.net/**', (r) => {
    const u = r.request().url();
    const cut = Object.keys(CUT).find((k) => u.includes(k)), still = Object.keys(STILL).find((k) => u.includes(k));
    if (cut) return r.fulfill({ path: `scripts/fixtures/cut-${CUT[cut]}.png` });
    if (still) return r.fulfill({ path: `scripts/fixtures/still-${STILL[still]}.png` });
    return r.fulfill({ status: 404 });
  });
  await page.route('https://fonts.*/**', (r) => r.continue());
  await page.goto('http://localhost:4174/hanzi-trainer/');
  await page.waitForTimeout(2600);
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    cls: document.documentElement.className,
    shown: [...document.querySelectorAll('.planet')].map((p) => p.querySelector('img.is-shown')?.dataset.planet),
    srcs: [...document.querySelectorAll('.sky video')].filter((v) => v.getAttribute('src')).map((v) => v.dataset.planet),
    title: document.querySelector('h1.title').textContent,
  }));
  const problems = [];
  if (m.sw > m.cw) problems.push(`overflow ${m.sw}>${m.cw}`);
  if (m.cls.includes('anim') || m.cls.includes('play')) problems.push('entrance classes left: ' + m.cls);
  if (m.shown.join() !== 'venus,mars' || m.title !== '地球') problems.push('initial state ' + JSON.stringify(m));
  await page.screenshot({ path: `${OUT}/${w}x${h}.png` });
  if (w === 1440) {
    await page.click('.planet-l'); await page.click('.planet-r'); await page.click('.planet-l');
    const after = await page.evaluate(() => [document.querySelector('h1.title').textContent, ...[...document.querySelectorAll('.planet img.is-shown')].map((i) => i.dataset.planet)].join());
    // earth→venus (L) ; now L=earth R=mars → click R = mars ; now L=earth R=venus → click L = earth
    if (after !== '地球,venus,mars') problems.push('rotation not reversible: ' + after);
  }
  console.log(`${w}x${h}`, problems.length ? 'FAIL ' + problems.join('; ') : 'ok');
  fail += problems.length;
  await ctx.close();
}
await b.close(); server.close();
process.exit(fail ? 1 : 0);
