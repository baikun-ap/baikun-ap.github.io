// Scroll-animation visibility regression check: visible cards must never remain faded.
import { chromium } from 'playwright';
import { chromePath } from './chrome.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const DIST = 'dist';
const PORT = 4177;
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const server = createServer((req, res) => {
  let path = decodeURIComponent(req.url.split('?')[0].replace(/^\/hanzi-trainer/, ''));
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = readFileSync(join(DIST, path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT);

const browser = await chromium.launch({ executablePath: chromePath() });
const selectors = '.stat, .panel, .world, .lesson-card, .mt-part';
const failures = [];

for (const [width, height] of [[1440, 900], [390, 844]]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: 'ru-RU', isMobile: width < 500, hasTouch: width < 500 });
  const page = await context.newPage();
  for (const route of ['', 'micro']) {
    await page.goto(`http://localhost:${PORT}/hanzi-trainer/app/#/${route}`);
    await page.waitForSelector('.x-main');
    await page.waitForTimeout(850);

    const check = async (step) => {
      const problems = await page.evaluate((targetSelector) => {
        const limit = window.innerHeight * 0.8;
        return [...document.querySelectorAll(targetSelector)]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { element, rect, opacity: Number.parseFloat(getComputedStyle(element).opacity) };
          })
          .filter(({ element, rect, opacity }) => {
            const style = getComputedStyle(element);
            return !element.classList.contains('micro-off') && style.display !== 'none' && style.visibility !== 'hidden' && rect.top < limit && opacity <= 0.95;
          })
          .map(({ element, rect, opacity }) => ({
            className: element.className,
            top: Math.round(rect.top),
            opacity: Number(opacity.toFixed(3)),
          }));
      }, selectors);
      for (const problem of problems) failures.push(`${width}x${height} /${route} / ${step}: ${JSON.stringify(problem)}`);
    };

    await check('load');
    const maxScroll = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
    let previous = -1;
    let step = 0;
    while (true) {
      const current = await page.evaluate(() => window.scrollY);
      if (current === previous || current >= maxScroll) break;
      previous = current;
      await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
      await page.waitForTimeout(180);
      await check(`scroll-${++step}`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(180);
    await check('reset');
  }
  await context.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.error(`${failures.length} opacity failures`);
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}
console.log('scroll check ok');
