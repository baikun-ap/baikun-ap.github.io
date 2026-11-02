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
check(await page.locator('text=Все 178 слов').isVisible(), 'writing covers all 178 words of lessons 1–8');
check((await page.locator('.x-tabs a[href="#/midterm"]').count()) === 1, 'midterm has its own tab');

// Narrow to lesson 1 (12 words) to keep the walk short.
for (const n of [2, 3, 4, 5, 6, 7, 8]) await page.click(`.mt-lessons .chip:text-is("${n}")`);
check(await page.locator('text=Все 12 слов').isVisible(), 'lesson filter narrows the words');

// 1. Writing on paper: a wrong pinyin, then "wrote it right" — every word ends up a miss.
await go('midterm/write');
await page.click('text=📝 Бумага');
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
await page.click('text=🎯 Черты');
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
check(n === 27 && await resultShown(), `building ran all 27 sentences (${n})`);

await go('midterm/answer');
n = 0;
while (!(await resultShown()) && n++ < 40) {
  if (n === 1) { await page.click('text=Подсказка: перевод'); await page.screenshot({ path: `${OUT}/answer.png`, fullPage: true }); }
  for (const t of await page.locator('.build-bank .tile').all()) await t.click();
  await page.click('.quiz-foot .btn.primary'); await page.click('.quiz-foot .btn.primary');
}
check(n === 24 && await resultShown(), `answering ran all 24 questions (${n})`);

// Practice midterm: 10 + 10 + 5 + 5.
await go('midterm/exam');
await page.click('text=📝 Бумага');
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

// Writing page: freehand on a blank grid, no hints, the right character laid over yours.
await go('write');
await page.screenshot({ path: `${OUT}/write-page.png`, fullPage: true });
check((await page.locator('.x-tabs a[href="#/write"]').count()) === 1, 'writing has its own tab');
check(await page.locator('text=Выбрано: 178 слов').isVisible(), 'writing defaults to lessons 1–8 (178 words)');
await page.click('text=Начать писать');
await page.waitForTimeout(500);
await page.click('text=✍ Свободно');
await page.click('.mt-modes input[type=checkbox]');   // characters only
check((await page.locator('.mt-py').count()) === 0, 'pinyin can be switched off');
check((await page.locator('.fc canvas').count()) === 1 && (await page.locator('.stroke-grid').count()) === 0, 'freehand shows a blank box and no stroke hints');
const fc = await page.locator('.fc canvas').boundingBox();
await page.mouse.move(fc.x + fc.width * 0.2, fc.y + fc.height * 0.3); await page.mouse.down();
await page.mouse.move(fc.x + fc.width * 0.8, fc.y + fc.height * 0.3, { steps: 10 }); await page.mouse.up();
const inked = await page.evaluate(() => { const c = document.querySelector('.fc canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k]) n++; return n; });
check(inked > 200, `a drawn stroke leaves ink (${inked} px)`);
await page.screenshot({ path: `${OUT}/write-free.png`, fullPage: true });
await page.click('text=Проверить иероглифы');
check((await page.locator('.fc-ghost').innerText()) === '八', 'the right character appears over the drawing');
await page.screenshot({ path: `${OUT}/write-free-check.png`, fullPage: true });
await page.click('text=Написал(а) верно');
check(await page.locator('.mt-reveal .nt-row').first().innerText().then((s) => s.includes('八')), 'the answer shows how to remember 八');
check(await page.locator('.quiz-foot .verdict.ok').isVisible(), 'self-check “wrote it right” counts as correct');
await page.click('.quiz-foot .btn.primary');
check((await page.locator('.q-ru').innerText()).trim() === 'белый', 'next word follows the book');
await page.click('.mt-modes input[type=checkbox]');   // pinyin back on for other checks

// Parts: every character of lessons 1–15 has a note, the overview, a character page, notes in lessons.
await go('parts');
await page.screenshot({ path: `${OUT}/parts.png`, fullPage: true });
check((await page.locator('.nt-card').count()) === 11, 'lesson 1 lists its 11 new characters');
let total = 0;
for (let n = 1; n <= 15; n++) { await page.click(`.nt-lessons .chip:text-is("${n}")`); total += await page.locator('.nt-card').count(); }
check(total === 312, `lessons 1–15 cover all 312 characters (${total})`);
check((await page.locator('.nt-part').count()) >= 40, 'the main parts are listed');
await go('parts/好');
await page.screenshot({ path: `${OUT}/parts-hao.png`, fullPage: true });
check((await page.locator('.nt-piece').count()) === 2 && (await page.locator('.nt-story').innerText()).includes('женщина'), '好 shows 女 + 子 and its story');
await go('lesson/jc1a-2/1');
await page.waitForTimeout(800);
check((await page.locator('.hz-step .nt-row').count()) >= 1, 'lesson step 1 shows how to remember the word');
await go('hanzi/好');
check((await page.locator('.nt-row').count()) === 1, 'the dictionary page shows the note');

// The teacher's test: every section in its paper format, right answers score full marks.
await go('midterm/paper');
await page.screenshot({ path: `${OUT}/paper.png`, fullPage: true });
check((await page.locator('.paper-sec').count()) === 5, 'the test lists its five sections');
await go('midterm/paper/pinyin');
const PY = ['qu3 qian2', 'shen1ti3', 'ju2zi', 'zhe4xie1', 'yin2hang2', 'jin1tian1', 'zai4jian4', 'he1 cha2', 'qing3 jin4', 'mei4mei'];
const boxes = await page.locator('.paper-py input').all();
for (let k = 0; k < boxes.length; k++) await boxes[k].pressSequentially(PY[k]);
check((await boxes[0].inputValue()) === 'qǔ qián', 'tone numbers turn into marks in the pinyin task');
await page.click('.quiz-foot .btn.primary');
check(await page.locator('text=Верно 10 из 10').isVisible(), 'pinyin task: 10 of 10');
await page.screenshot({ path: `${OUT}/paper-pinyin.png`, fullPage: true });
await go('midterm/paper/fill');
const KEY = ['C', 'E', 'B', 'D', 'A', 'H', 'J', 'I', 'G', 'F'];
const sels = await page.locator('.paper-sel').all();
for (let k = 0; k < sels.length; k++) await sels[k].selectOption(KEY[k]);
await page.click('.quiz-foot .btn.primary');
check(await page.locator('text=Верно 10 из 10').isVisible(), 'word box task: 10 of 10 with the answer key');
await go('midterm/paper/dialog');
const ANS = ['我很忙', '汉语不太难', '我去银行取钱', '今天星期六', '我姓王', '你叫什么名字', '我吃米饭', '苹果多少钱一斤', '你要什么汤', '你吃馒头吗', '你是日本人吗', '你呢', '便宜一点儿吧', '他是我的朋友', '这是我的汉语书'];
const ins = await page.locator('.pd-blank input').all();
check(ins.length === 15, `dialogues have 15 blanks (${ins.length})`);
for (let k = 0; k < ins.length; k++) await ins[k].fill(ANS[k]);
await page.click('.quiz-foot .btn.primary');
check(await page.locator('text=Верно 15 из 15').isVisible(), 'dialogues: sample answers are all accepted');
await page.screenshot({ path: `${OUT}/paper-dialog.png`, fullPage: true });
await go('midterm/paper/measure');
const MW = ['碗', '本', '支', '杯', '碗', '盘', '杯', '瓶', '斤', '本'];
const ms = await page.locator('.paper-sel').all();
for (let k = 0; k < ms.length; k++) await ms[k].selectOption(MW[k]);
await page.click('.quiz-foot .btn.primary');
check(await page.locator('text=Верно 10 из 10').isVisible(), 'measure words: 10 of 10');
await go('midterm/paper/listen');
for (const li of await page.locator('.paper-rows > li').all()) await li.locator('.opt').first().click();
await page.click('.quiz-foot .btn.primary');
check(await page.locator('.quiz-foot .verdict').isVisible(), 'listening section checks');
await page.click('.quiz-foot .btn.primary');
check(await page.locator('.result-num').innerText().then((s) => /\/20$/.test(s)), 'listening scores out of 20');
await go('midterm/slide');
check((await page.locator('.q-ru .py').innerText()).replace(/\s/g, '').toLowerCase() === 'hànyǔ' && (await page.locator('.mt-py').count()) === 0, 'the slide shows pinyin and asks for characters only');
await page.screenshot({ path: `${OUT}/slide.png`, fullPage: true });

// 18 words for the exam, in the teacher's five question types.
await go('midterm/words18');
await page.screenshot({ path: `${OUT}/words18.png`, fullPage: true });
check((await page.locator('.ex-word').count()) === 18 && (await page.locator('.ex-type').count()) === 5, 'the 18 words and 5 task types are listed');
await go('midterm/words18/pinyin');
const P18 = ['han4yu3', 'you2ju2', 'shen1ti3', 'gui4xing4', 'man2tou', 'yu3fa3', 'ying1yu3', 'yin2hang2', 'gong1zuo4', 'mi3fan4', 'pi2jiu3', 'fa1yin1', 'ming2zi', 'bao1zi', 'qing3 jin4', 'yao4', 'chi1', 'shen2me'];
const b18 = await page.locator('.paper-py input').all();
for (let k = 0; k < b18.length; k++) await b18[k].pressSequentially(P18[k]);
await page.click('.quiz-foot .btn.primary');
check(await page.locator('text=Верно 18 из 18').isVisible(), 'pinyin from characters: 18 of 18');
await go('midterm/words18/answer');
const SAMPLES = ['我学习汉语', '我去邮局', '对我去银行取钱', '我姓王', '我叫马丁', '我身体很好谢谢', '我工作很忙', '我吃米饭', '我不吃馒头我吃米饭', '我不喝啤酒', '我要三个包子', '汉语语法不太难', '汉语发音很难', '我不学英语我学汉语', '我要一碗米饭'];
const ai = await page.locator('.pd-blank input').all();
check(ai.length === 15, `15 questions (${ai.length})`);
for (let k = 0; k < ai.length; k++) await ai[k].fill(SAMPLES[k]);
await page.click('.quiz-foot .btn.primary');
check(await page.locator('text=Верно 15 из 15').isVisible(), 'answer the questions: sample answers accepted');
await go('midterm/words18/make');
const mk = await page.locator('.paper-rows input').all();
const MK = ['我学习汉语', '我去邮局寄信', '我身体很好', '请问您贵姓', '我要两个馒头', '汉语语法不太难', '我妹妹学英语', '我去银行取钱', '我爸爸工作很忙', '我要一碗米饭', '我不喝啤酒', '汉语发音很难', '你叫什么名字', '我要三个包子', '老师请进', '我要一碗汤', '我吃饺子', '你学习什么'];
for (let k = 0; k < mk.length; k++) await mk[k].fill(MK[k]);
await page.click('.quiz-foot .btn.primary');
check(await page.locator('text=Верно 18 из 18').isVisible(), 'make sentences: sentences with the word count');
await go('midterm/words18/measure');
const M18 = ['碗', '个', '个', '瓶', '本', '碗', '斤', '杯', '支', '盘'];
const ms18 = await page.locator('.paper-sel').all();
for (let k = 0; k < ms18.length; k++) await ms18[k].selectOption(M18[k]);
await page.click('.quiz-foot .btn.primary');
check(await page.locator('text=Верно 10 из 10').isVisible(), 'measure words for the 18: 10 of 10');
await go('midterm/words18/hanzi');
check((await page.locator('.q-ru .py').innerText()).replace(/\s/g, '').toLowerCase() === 'hànyǔ' && (await page.locator('.fc canvas, .stroke-grid').count()) > 0, 'characters from pinyin starts with hànyǔ and a writing box');

check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
await b.close(); server.close();
if (fails.length) { console.log(`${fails.length} failed`); process.exit(1); }
console.log('midterm ok');
