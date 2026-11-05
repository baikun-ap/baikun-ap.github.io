// Listening midterm check in real Chromium: every part runs to its result,
// options are the book's, transcripts show after answering, the dictation
// asks pinyin then characters, the gap text accepts characters or pinyin.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const OUT = 'shots/listening';
mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  try { const body = readFileSync(join('dist', p)); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(4179);

const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' })).newPage();
// A Chinese voice that records what it is asked to say (the test browser has none of its own).
await page.addInitScript(() => {
  window.__spoken = [];
  const v = { voiceURI: 'zh-test', name: 'Tingting', lang: 'zh-CN', localService: true, default: true };
  Object.defineProperty(window, 'speechSynthesis', { value: {
    getVoices: () => [v], cancel() {}, pause() {}, resume() {}, speaking: false, pending: false,
    addEventListener() {}, removeEventListener() {},
    speak(u) { window.__spoken.push(u.text); setTimeout(() => { u.onstart?.(); u.onend?.(); }, 5); },
  } });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
});
const spoken = () => page.evaluate(() => window.__spoken.slice());
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.route('https://**', (r) => r.fulfill({ status: 404 }));
const fails = [];
const check = (ok, msg) => { console.log(ok ? 'ok  ' : 'FAIL', msg); if (!ok) fails.push(msg); };
const go = async (h) => { await page.goto(`http://localhost:4179/app/#/${h}`); await page.waitForTimeout(700); };
const resultShown = async () => (await page.locator('.result-num').count()) > 0;

await go('midterm');
check((await page.locator('a[href="#/midterm/listen"]').count()) === 1, 'the midterm page links to the listening midterm');
await go('midterm/listen');
await page.screenshot({ path: `${OUT}/hub.png`, fullPage: true });
check((await page.locator('.paper-sec').count()) === 4, 'four listening parts');
check(await page.locator('text=· 30').isVisible() && await page.locator('text=· 28').isVisible() && await page.locator('text=· 44').isVisible(), 'counts: 30 replies, 28 dialogues, 44 dictation words');

// 一 choose the reply: the play button reads the question aloud.
await go('midterm/listen/reply');
await page.evaluate(() => { window.__spoken.length = 0; });
await page.click('.ls-play');
await page.waitForTimeout(200);
const said = await spoken();
check(said.length === 1 && /[？?！!。]$/.test(said[0]), `“Play the question” speaks the question (${said.join(' / ')})`);
// Always the first option; the right one is marked, the script appears.
let n = 0, right = 0;
while (!(await resultShown()) && n++ < 40) {
  await page.locator('.ls-opts .opt').first().click();
  if (n === 1) {
    check((await page.locator('.ls-opts .opt.ok').count()) >= 1 && (await page.locator('.ls-script').count()) === 1, 'after answering the right option is marked and the question is shown');
    await page.screenshot({ path: `${OUT}/reply.png`, fullPage: true });
  }
  if (await page.locator('.quiz-foot .verdict.ok').count()) right++;
  await page.click('.quiz-foot .btn.primary');
}
check(n === 30 && await page.locator(`text=Верно: ${right} из 30`).isVisible(), `replies ran all 30 to the result (${right} right by always picking A)`);

// 二 dialogues: the script shows both speakers and the question.
await go('midterm/listen/talk');
await page.locator('.ls-opts .opt').nth(1).click();
await page.evaluate(() => { window.__spoken.length = 0; });
await page.click('.ls-play');
await page.waitForTimeout(200);
const lines = await spoken();
check(lines.length >= 2 && lines[lines.length - 1].startsWith('问：'), `“Play the dialogue” speaks every line, then the question (${lines.length} parts)`);
check((await page.locator('.ls-script b', { hasText: '问' }).count()) === 1 && (await page.locator('.ls-script b', { hasText: /男|女/ }).count()) >= 1, 'a dialogue script shows 男/女 lines and the question');
await page.screenshot({ path: `${OUT}/talk.png`, fullPage: true });
n = 1;
await page.click('.quiz-foot .btn.primary');
while (!(await resultShown()) && n++ < 40) { await page.locator('.ls-opts .opt').first().click(); await page.click('.quiz-foot .btn.primary'); }
check(n === 28, `dialogues ran all 28 (${n})`);

// 三 dictation: a play button and no text to read, pinyin first, then characters.
await go('midterm/listen/write');
check((await page.locator('.q-audio button').count()) === 1 && (await page.locator('.q-ru').count()) === 0, 'dictation shows only a play button');
check((await page.locator('.mt-py input').count()) === 1, 'dictation asks pinyin first');
await page.screenshot({ path: `${OUT}/write.png`, fullPage: true });
await page.click('text=Не знаю');
await page.click('text=✍ Свободно');
await page.click('text=Проверить иероглифы');
check((await page.locator('.mt-reveal .muted').count()) >= 1, 'after checking the word and its meaning are shown');
await page.click('text=Ошибся');
await page.click('.quiz-foot .btn.primary');
check(await page.locator('.quiz-top').innerText().then((s) => s.startsWith('2 /')), 'dictation goes on to the next word');

// 四 the gap text: characters or pinyin with tone numbers both count.
await go('midterm/listen/fill');
const ins = await page.locator('.ls-gap input').all();
check(ins.length === 6, `six gaps on p. 26 (${ins.length})`);
const ANS = ['哥哥', 'mang2', '难', 'you2ju2', '也', 'qian2'];
for (let k = 0; k < ins.length; k++) await ins[k].pressSequentially(ANS[k]);
check((await ins[1].inputValue()) === 'máng', 'tone numbers become marks in the gaps');
await page.click('.quiz-foot .btn.primary');
check(await page.locator('text=Верно 6 из 6').isVisible(), 'gap text: characters and pinyin both accepted, 6 of 6');
await page.screenshot({ path: `${OUT}/fill.png`, fullPage: true });

// Lesson filter.
await go('midterm/listen');
await page.click('.mt-lessons .chip:text-is("6")');
await page.click('.mt-lessons .chip:text-is("7")');
check(await page.locator('text=· 10').first().isVisible(), 'lesson 8 alone has 10 replies');

check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
await b.close(); server.close();
if (fails.length) { console.log(`${fails.length} failed`); process.exit(1); }
console.log('listening ok');
