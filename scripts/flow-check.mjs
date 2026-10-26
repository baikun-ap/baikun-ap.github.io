// Walks a lesson like a learner: answers quizzes, builds sentences, reviews
// cards, then reloads and checks the progress survived.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const DIST = 'dist', OUT = 'shots/flow';
mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].replace(/^\/hanzi-trainer/, ''));
  if (p.endsWith('/')) p += 'index.html';
  try { const b = readFileSync(join(DIST, p)); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(4176);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('https://d8j0ntlcm91z4.cloudfront.net/**', (r) => r.fulfill({ status: 404 }));
const url = (r) => `http://localhost:4176/hanzi-trainer/app/#/${r}`;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(ok ? 'ok  ' : 'FAIL', msg); };

async function runQuiz(tag) {
  for (let n = 0; n < 30; n++) {
    if (await page.locator('.result .btn.primary').count()) { await page.screenshot({ path: `${OUT}/${tag}-result.png` }); await page.locator('.result .btn.primary').first().click(); await page.waitForTimeout(400); return true; }
    const tiles = page.locator('.build-bank .tile:not([disabled])');
    if (await tiles.count()) {
      while (await tiles.count()) await tiles.first().click();
      await page.click('.quiz-foot .btn.primary');
    } else {
      if (!(await page.locator('.opt').count())) { await page.screenshot({ path: `${OUT}/stuck-${tag}.png` }); console.log('stuck', tag, page.url(), await page.locator('.q-prompt, .quiz').first().innerText().catch(()=>'-')); return false; }
      await page.locator('.opt').first().click();
    }
    if (n === 0) await page.screenshot({ path: `${OUT}/${tag}-feedback.png` });
    await page.click('.quiz-foot .btn.primary');
  }
  return false;
}

await page.goto(url('lesson/starter-1/1'));
await page.waitForTimeout(800);
for (let k = 0; k < 20 && !(await page.locator('text=Готово').count()); k++) await page.click('text=Дальше →');
await page.click('text=Готово');
await page.waitForTimeout(300);
check(page.url().endsWith('/2'), 'step 1 → step 2');
check(await runQuiz('pinyin'), 'pinyin quiz finishes');
await page.waitForTimeout(300);
check(page.url().endsWith('/3'), 'step 2 → step 3');
check(await runQuiz('tones'), 'tone quiz finishes');
check(await runQuiz('listen'), 'listening quiz finishes');
await page.waitForTimeout(300);
check(page.url().endsWith('/5'), 'reached speaking');
await page.screenshot({ path: `${OUT}/speak.png` });
for (let k = 0; k < 8 && page.url().endsWith('/5'); k++) await page.click('text=Пропустить');
await page.waitForTimeout(300);
check(page.url().endsWith('/6'), 'speaking → grammar');
await page.click('text=Практика: собери фразы →');
check(await runQuiz('build'), 'sentence building finishes');
await page.waitForTimeout(300);
check(page.url().endsWith('/7'), 'grammar → test');
await runQuiz('test');
await page.screenshot({ path: `${OUT}/test-after.png` });
if (await page.locator('text=Всё равно дальше').count()) await page.click('text=Всё равно дальше');
await page.waitForTimeout(300);
check(page.url().endsWith('/8'), 'test → cards');
await page.waitForTimeout(500);
for (let k = 0; k < 40 && (await page.locator('text=Показать ответ').count()); k++) {
  await page.click('text=Показать ответ');
  if (k === 0) await page.screenshot({ path: `${OUT}/card-back.png` });
  await page.locator('.grade.g4').click();
}
await page.screenshot({ path: `${OUT}/cards-done.png` });
await page.waitForTimeout(800);
await page.goto(url(''));
await page.reload();
await page.waitForTimeout(800);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('xinghan-course-v1') || 'null'));
check(saved && saved.lessons['starter-1']?.steps.length === 8 && saved.lessons['starter-1'].doneAt, `progress saved: steps ${JSON.stringify(saved?.lessons['starter-1']?.steps)}`);
check(saved && Object.keys(saved.cards).length === 14, `14 cards in deck: ${saved && Object.keys(saved.cards).length}`);
await page.screenshot({ path: `${OUT}/home-after.png`, fullPage: true });
await page.goto(url('pinyin'));
await page.waitForTimeout(500);
await page.click('.chart td button >> text=hao');
await page.screenshot({ path: `${OUT}/pinyin-hao.png` });
check(await page.locator('.tone-btn:not(.empty)').count() >= 2, 'hao has tones with audio');
check(!errors.length, 'no page errors ' + errors.join(' | '));
await b.close(); server.close();
console.log(fails.length ? `${fails.length} FAILED` : 'flow ok');
process.exit(fails.length ? 1 : 0);
