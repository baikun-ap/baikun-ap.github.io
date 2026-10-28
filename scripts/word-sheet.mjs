// Printable word list for a book's lessons: characters, pinyin coloured by
// tone, the meaning and a character-by-character breakdown, then "test
// yourself" sheets with empty boxes for writing. Rendered to PDF in Chromium.
//
// Run: node scripts/word-sheet.mjs jc1a 1 7   →   public/files/jc1a-1-7.pdf
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [book = 'jc1a', from = '1', to = '7'] = process.argv.slice(2);
const ROOT = process.cwd();
execSync('npx rolldown src/course/data.ts --format esm --platform node --file .cache/data.mjs', { stdio: 'ignore' });
const { BOOKS } = await import(`${path.join(ROOT, '.cache/data.mjs')}?${Date.now()}`);
const B = BOOKS.find((b) => b.id === book);
const lessons = B.lessons.filter((l) => l.n >= +from && l.n <= +to);
const charsFile = `scripts/books/${book}-chars.tsv`;
const GLOSS = new Map(fs.existsSync(charsFile)
  ? fs.readFileSync(charsFile, 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'))
  : []);

const FONT = path.join(ROOT, '.cache/NotoSansSC-var.ttf');
if (!fs.existsSync(FONT)) throw new Error('Run "npm run font" first: it downloads the Noto Sans SC face into .cache/.');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const HAN = /\p{Script=Han}/u;
const NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];

/* Pinyin split into syllables, each coloured by its tone. */
const V = 'aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const SYL = new RegExp(`(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[${V}]+(ng(?![${V}])|n(?![${V}])|r(?![${V}]))?`, 'giu');
const toneOf = (s) => { for (const ch of s.normalize('NFD')) { const t = { '̄': 1, '́': 2, '̌': 3, '̀': 4 }[ch]; if (t) return t; } return 5; };
const py = (text) => esc(text).replace(SYL, (m) => `<span class="t${toneOf(m)}">${m}</span>`);

const breakdown = (zh) => {
  const cs = [...zh].filter((c) => HAN.test(c));
  if (cs.length < 2) return '';
  return cs.map((c) => `<span class="zh">${c}</span> ${esc(GLOSS.get(c) ?? '')}`).join(' + ');
};

const total = lessons.reduce((n, l) => n + l.words.length, 0);
const list = lessons.map((l) => `
  <section class="lesson">
    <h2><span class="zh">第${NUM[l.n]}课</span> Урок ${l.n} · <span class="zh">${l.titleZh}</span> <span class="pyh">${py(l.titlePy)}</span> · ${esc(l.title)}</h2>
    <table>
      <thead><tr><th>№</th><th>汉字</th><th>Пиньинь</th><th>Перевод</th></tr></thead>
      <tbody>${l.words.map((w, k) => `
        <tr><td class="n">${k + 1}</td><td class="zh big">${esc(w.zh)}</td><td class="py">${py(w.py)}</td>
          <td>${esc(w.ru)}${breakdown(w.zh) ? `<div class="bd">${breakdown(w.zh)}</div>` : ''}</td></tr>`).join('')}
      </tbody>
    </table>
  </section>`).join('');

const boxes = (zh) => [...zh].filter((c) => HAN.test(c)).map(() => '<span class="box"></span>').join('');
const test = lessons.map((l) => `
  <section class="lesson">
    <h2>Проверь себя · Урок ${l.n} · <span class="zh">${l.titleZh}</span></h2>
    <table class="test">
      <thead><tr><th>№</th><th>Перевод</th><th>Пиньинь</th><th>汉字</th></tr></thead>
      <tbody>${l.words.map((w, k) => `
        <tr><td class="n">${k + 1}</td><td>${esc(w.ru)}</td><td class="line"></td><td class="boxes">${boxes(w.zh)}</td></tr>`).join('')}
      </tbody>
    </table>
  </section>`).join('');

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>bai.kun · 汉语教程 1A · уроки ${from}–${to}</title><style>
@font-face { font-family: 'Noto Sans SC'; src: url('file://${FONT}'); font-weight: 100 900; }
@page { size: A4; margin: 14mm 12mm 16mm; }
* { box-sizing: border-box; }
body { font-family: 'Noto Sans SC', sans-serif; color: #1d1d1f; font-size: 11pt; margin: 0; }
.zh { font-family: 'Noto Sans SC', sans-serif; }
header { border-bottom: 2px solid #0071e3; padding-bottom: 8px; margin-bottom: 10px; }
header .brand { color: #0071e3; font-weight: 700; letter-spacing: .02em; }
header h1 { font-size: 22pt; margin: 4px 0 2px; font-weight: 700; }
header p { margin: 2px 0; color: #555; }
.tips { background: #f5f5f7; border-radius: 10px; padding: 8px 12px; margin: 8px 0 14px; font-size: 10pt; }
.tips ol { margin: 4px 0 0 18px; padding: 0; }
.legend span { margin-right: 10px; font-weight: 600; }
h2 { font-size: 13pt; margin: 14px 0 6px; padding: 6px 10px; background: #eaf2fd; border-radius: 8px; break-after: avoid; }
h2 .pyh { font-weight: 400; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 9pt; color: #86868b; font-weight: 500; padding: 3px 6px; border-bottom: 1px solid #d2d2d7; }
td { padding: 5px 6px; border-bottom: 1px solid #ececf0; vertical-align: middle; }
tr { break-inside: avoid; }
td.n { width: 26px; color: #86868b; font-size: 9pt; }
td.big { font-size: 22pt; width: 120px; white-space: nowrap; }
td.py { font-size: 13pt; width: 150px; }
.bd { font-size: 8.5pt; color: #6e6e73; margin-top: 2px; }
.bd .zh { color: #1d1d1f; font-size: 10pt; }
.t1 { color: #2f6fd1; } .t2 { color: #188a50; } .t3 { color: #b06a00; } .t4 { color: #c03c8a; } .t5 { color: #86868b; }
.part { break-before: page; }
.test td { height: 40px; }
.test td.line { width: 150px; border-bottom: 1px solid #c7c7cc; }
.test td.boxes { width: 210px; white-space: nowrap; }
.box { display: inline-block; width: 34px; height: 34px; margin-right: 3px; border: 1px solid #b0b0b8; vertical-align: middle;
  background: linear-gradient(#e3e3e8, #e3e3e8) center / 100% 1px no-repeat, linear-gradient(#e3e3e8, #e3e3e8) center / 1px 100% no-repeat; }
</style></head><body>
<header>
  <div class="brand">bai.kun · baikun-ap.github.io</div>
  <h1>《汉语教程》 1A · Уроки ${from}–${to}</h1>
  <p>Все слова к мидтерму: ${total} слов. Иероглиф, пиньинь, перевод и разбор по иероглифам.</p>
</header>
<div class="tips"><b>Как учить</b>
  <ol>
    <li>Прочитай урок вслух по пиньиню. Цвет — тон: <span class="legend"><span class="t1">1 ˉ</span><span class="t2">2 ˊ</span><span class="t3">3 ˇ</span><span class="t4">4 ˋ</span><span class="t5">· нейтральный</span></span></li>
    <li>Закрой правые колонки и вспоминай значение по иероглифу, потом наоборот.</li>
    <li>Распечатай листы «Проверь себя» в конце: по переводу пиши пиньинь и иероглифы в клетках, потом сверяйся.</li>
    <li>На сайте: вкладка «Мидтерм» → «Написание» — то же самое с проверкой.</li>
  </ol>
</div>
${list}
<div class="part">${test}</div>
</body></html>`;

fs.mkdirSync('.cache', { recursive: true });
fs.writeFileSync('.cache/word-sheet.html', html);
const out = `public/files/${book}-${from}-${to}.pdf`;
fs.mkdirSync(path.dirname(out), { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
const page = await b.newPage();
await page.goto(`file://${path.join(ROOT, '.cache/word-sheet.html')}`);
await page.evaluate(() => document.fonts.ready);
await page.pdf({
  path: out, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-size:8px;color:#86868b;padding:0 12mm;display:flex;justify-content:space-between"><span>bai.kun · 汉语教程 1A · уроки ${from}–${to}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
});
await b.close();
console.log(out, `${(fs.statSync(out).size / 1024).toFixed(0)} KB`, `${total} words`);
