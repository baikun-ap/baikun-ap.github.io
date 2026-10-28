// Midterm page check in real Chromium: the hub, every part played to its
// result screen (writing on paper and on screen, reading, building, answering),
// the practice midterm, no page errors. Screens go to shots/midterm/.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const OUT = 'shots/midterm';
mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  try { const body = readFileSync(join('dist', p)); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(4176);

const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.route('https://**', (r) => r.fulfill({ status: 404 }));

const fails = [];
const check = (ok, msg) => { console.log(ok ? 'ok  ' : 'FAIL', msg); if (!ok) fails.push(msg); };
const go = async (h) => { await page.goto(`http://localhost:4176/app/#/${h}`); await page.waitForTimeout(700); };
const resultShown = async () => (await page.locator('.result-num').count()) > 0;

await go('midterm');
await page.screenshot({ path: `${OUT}/hub.png`, fullPage: true });
check((await page.locator('.mt-part').count()) === 3, 'hub shows three parts');
check(await page.locator('text=Все 153 слов').isVisible(), 'writing covers all 153 words of lessons 1–7');
check((await page.locator('.x-tabs a[href="#/midterm"]').count()) === 1, 'midterm has its own tab');

// Narrow to lesson 1 (12 words) to keep the walk short.
for (const n of [2, 3, 4, 5, 6, 7]) await page.click(`.mt-lessons .chip:text-is("${n}")`);
check(await page.locator('text=Все 12 слов').isVisible(), 'lesson filter narrows the words');

// 1. Writing on paper: a wrong pinyin, then "wrote it right" — every word ends up a miss.
await go('midterm/write');
await page.click('text=📝 На бумаге');
let n = 0;
while (!(await resultShown()) && n++ < 20) {
  await page.fill('.mt-py input', 'zz1');
  await page.click('.mt-py button');
  await page.click('text=Написал(а) на бумаге — показать ответ');
  if (n === 1) await page.screenshot({ path: `${OUT}/write-paper.png`, fullPage: true });
  await page.click('text=Написал(а) верно');
  await page.click('.quiz-foot .btn.primary');
}
check(n === 12 && await page.locator('text=Верно: 0 из 12').isVisible(), `paper writing ran 12 words to the result (${n})`);
await page.click('text=Повторить ошибки');
check((await page.locator('.quiz-top').count()) === 1, 'redo mistakes restarts');

// 1. Writing on screen, from the top of lesson 1 again.
await go('midterm');
await go('midterm/write');
await page.click('text=✍ На экране');
await page.waitForTimeout(900);
check((await page.locator('.stroke-grid svg').count()) > 0, 'stroke quiz is drawn');
await page.screenshot({ path: `${OUT}/write-screen.png`, fullPage: true });
// Book order: lesson 1 starts with 八 bā. Tone numbers turn into marks and a right answer is taken at once.
check((await page.locator('.q-ru').innerText()).trim() === 'восемь', 'book order starts with 八 «восемь»');
await page.locator('.mt-py input').pressSequentially('ba');
await page.click('.tone-key.t1');
check(await page.locator('text=Пиньинь верно!').isVisible(), 'tone button marks the syllable and the answer is accepted instantly');
check((await page.inputValue('.mt-py input')) === 'bā', 'input shows bā');
await page.click('text=Не помню — показать');
await page.click('.quiz-foot .btn.primary');
const second = (await page.locator('.q-ru').innerText()).trim();
await page.locator('.mt-py input').pressSequentially('bai2');
check((await page.inputValue('.mt-py input')) === 'bái' && await page.locator('text=Пиньинь верно!').isVisible(), `typing bai2 becomes bái and is accepted (${second})`);
// Leaving and coming back resumes at the same word.
await go('midterm');
await go('midterm/write');
check((await page.locator('.q-ru').innerText()).trim() === second && await page.locator('text=Продолжаем с 2-го задания').isVisible(), 'coming back resumes at the same word');
// A re-render from a saved answer must not change the task on screen.
await go('midterm/read');
await page.locator('.mt-opts .opt').first().click();
const sentence = await page.locator('.mt-sentence').innerText();
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForTimeout(400);
check((await page.locator('.mt-sentence').innerText()) === sentence, 'the sentence stays put after answering');
await page.click('.quiz-foot .btn.primary');

// 2. Reading: always pick the first option.
check(await resultShown(), 'reading reached the result for lesson 1');

// 3. Building and answering need lessons 2+; widen to all lessons.
await go('midterm');
await page.click('.mt-lessons .chip:text-is("Все")');
await go('midterm/build');
n = 0;
while (!(await resultShown()) && n++ < 40) {
  for (const t of await page.locator('.build-bank .tile').all()) await t.click();
  if (n === 1) await page.screenshot({ path: `${OUT}/build.png`, fullPage: true });
  await page.click('.quiz-foot .btn.primary'); await page.click('.quiz-foot .btn.primary');
}
check(n === 24 && await resultShown(), `building ran all 24 sentences (${n})`);

await go('midterm/answer');
n = 0;
while (!(await resultShown()) && n++ < 40) {
  if (n === 1) { await page.click('text=Подсказка: перевод'); await page.screenshot({ path: `${OUT}/answer.png`, fullPage: true }); }
  for (const t of await page.locator('.build-bank .tile').all()) await t.click();
  await page.click('.quiz-foot .btn.primary'); await page.click('.quiz-foot .btn.primary');
}
check(n === 21 && await resultShown(), `answering ran all 21 questions (${n})`);

// Practice midterm: 10 + 10 + 5 + 5.
await go('midterm/exam');
await page.click('text=📝 На бумаге');
let steps = 0;
while (!(await resultShown()) && steps++ < 60) {
  if (await page.locator('.mt-py input:not([disabled])').count()) {
    await page.fill('.mt-py input', 'zz1'); await page.click('.mt-py button');
    await page.click('text=Написал(а) на бумаге — показать ответ'); await page.click('text=Ошибся');
  } else if (await page.locator('.mt-opts').count()) {
    await page.locator('.mt-opts .opt').first().click();
  } else {
    for (const t of await page.locator('.build-bank .tile').all()) await t.click();
    await page.click('.quiz-foot .btn.primary');
  }
  await page.click('.quiz-foot .btn.primary');
}
check(steps === 30 && (await page.locator('.mt-score li').count()) === 4, `practice midterm ran 30 tasks in 4 parts (${steps})`);
await page.screenshot({ path: `${OUT}/exam-result.png`, fullPage: true });

check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
await b.close(); server.close();
if (fails.length) { console.log(`${fails.length} failed`); process.exit(1); }
console.log('midterm ok');
