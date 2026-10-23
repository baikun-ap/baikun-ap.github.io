// Turns a book's vocabulary table (TSV: zh, pinyin, Russian, lesson) into the
// JSON the course reads. Run: node scripts/books/build-words.mjs jc1a
import fs from 'node:fs';
const id = process.argv[2];
const rows = fs.readFileSync(`scripts/books/${id}-vocab.tsv`, 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
const out = {};
for (const r of rows) {
  const [zh, py, ru, n] = r.split('\t');
  (out[n] ??= []).push({ zh, py, ru });
}
fs.writeFileSync(`src/content/${id}-words.json`, JSON.stringify(out, null, 1) + '\n');
console.log(id, Object.keys(out).length, 'lessons', rows.length, 'words');
