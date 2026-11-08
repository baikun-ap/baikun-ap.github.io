// Landing-page check in real Chromium: the flower-valley landing at phone,
// tablet and desktop size. No page errors, no sideways scroll, the valley
// canvas mounts, and after scrolling through every block the content that is
// on screen is fully visible (scroll-scrubbed motion never leaves it faded).
import { chromium } from 'playwright';
import { chromePath } from './chrome.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const DIST = 'dist', OUT = process.env.OUT ?? 'shots/hero';
mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  try { const b = readFileSync(join(DIST, p)); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(4174);

const b = await chromium.launch({ executablePath: chromePath(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fail++; };

for (const [w, h, locale] of [[390, 844, 'ru-RU'], [820, 1180, 'en-US'], [1440, 900, 'ru-RU']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale, isMobile: w < 500, hasTouch: w < 900 });
  const page = await ctx.newPage();
  // Block web fonts: the check must not depend on the network.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|fonts\.g/.test(m.text())) errors.push(m.text()); });
  await page.goto('http://localhost:4174/');
  await page.waitForTimeout(3000);
  const tag = `${w}x${h}`;
  ok(await page.locator('#loader.gone').count() === 1, `${tag} loader goes away`);
  ok(await page.locator('.js-canvas-container canvas').count() === 1, `${tag} valley canvas mounted`);
  ok(await page.locator('#hero-title').isVisible(), `${tag} hero title visible`);
  const title = (await page.locator('#hero-title').innerText()).replace(/\s+/g, ' ').trim();
  ok(locale.startsWith('en') ? /Grown/.test(title) : /Выращивай/.test(title), `${tag} hero title in ${locale.slice(0, 2)}: “${title}”`);
  await page.screenshot({ path: `${OUT}/${tag}-top.png` });

  const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const faded = new Set();
  for (let y = 0; y <= H; y += Math.round(h / 3)) {
    await page.evaluate((v) => scrollTo(0, v), y);
    await page.waitForTimeout(250);
    // Settled blocks: anything whose top is in the upper 55% of the screen must be fully shown.
    const bad = await page.evaluate((vh) => [...document.querySelectorAll('.world, .exam, .num, .h2, .final .pill')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.top > 0 && r.top < vh * 0.55 && r.height > 0; })
      .filter((e) => { let o = 1; for (let n = e; n && n !== document.body; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o < 0.95; })
      .map((e) => e.className.split(' ')[0]), h);
    bad.forEach((x) => faded.add(x));
  }
  await page.evaluate((v) => scrollTo(0, v), H);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${tag}-end.png` });
  ok(faded.size === 0, `${tag} settled blocks fully visible${faded.size ? ': ' + [...faded].join(', ') : ''}`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tag} no sideways scroll`);
  ok(await page.locator('a[href="app/#/"]').count() >= 2, `${tag} start links lead into the course`);
  ok(errors.length === 0, `${tag} no page errors ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

// Language switch persists and flips the copy.
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ru-RU' });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('http://localhost:4174/');
  await page.waitForTimeout(1500);
  await Promise.all([page.waitForNavigation(), page.click('#lang')]);
  await page.waitForTimeout(1500);
  ok(/Grown/.test(await page.locator('#hero-title').innerText()), 'EN switch turns the page English');
  ok(await page.evaluate(() => localStorage.getItem('baikun-lang')) === 'en', 'EN choice is shared with the course');
  await ctx.close();
}

await b.close(); server.close();
console.log(fail ? `landing FAIL ${fail}` : 'landing ok');
process.exit(fail ? 1 : 0);
