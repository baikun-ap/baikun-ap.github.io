// Turns the character notes (TSV: char, parts, Russian, English) and the
// component glossary into the JSON the site reads.
// Run: node scripts/books/build-notes.mjs jc1a
import fs from 'node:fs';
const id = process.argv[2] ?? 'jc1a';
const rows = (f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'));
const notes = {};
for (const [c, parts, ru, en] of rows(`scripts/books/${id}-hanzi.tsv`)) notes[c] = { p: parts ? parts.split('+') : [], ru, en };
const parts = rows('scripts/books/components.tsv').map(([c, ru, en]) => ({ c, ru, en }));
fs.writeFileSync('src/content/hanzi-notes.json', JSON.stringify({ notes, parts }) + '\n');
console.log(Object.keys(notes).length, 'characters,', parts.length, 'components');
