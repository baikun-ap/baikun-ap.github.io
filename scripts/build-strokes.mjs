/*
 * Copies stroke-order data (Hanzi Writer, Arphic Public License) for exactly
 * the characters this site can show: the 800-character dictionary plus every
 * character in the course content. Served from /strokes/<char>.json so the
 * site never depends on a third-party CDN.
 *
 * Run with: npm run strokes
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'node_modules/hanzi-writer-data');
const OUT = path.join(ROOT, 'public/strokes');
const HAN = /\p{Script=Han}/gu;

const chars = new Set();
for (const h of JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/characters.json'), 'utf8'))) {
  chars.add(h.c);
  (h.comps ?? []).forEach((c) => chars.add(c));
}
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
for (const f of walk(path.join(ROOT, 'src/content'))) for (const c of fs.readFileSync(f, 'utf8').match(HAN) ?? []) chars.add(c);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let n = 0, missing = 0;
for (const c of chars) {
  const src = path.join(SRC, `${c}.json`);
  if (!fs.existsSync(src)) { missing++; continue; }
  fs.writeFileSync(path.join(OUT, `${c}.json`), JSON.stringify(JSON.parse(fs.readFileSync(src, 'utf8'))));
  n++;
}
fs.copyFileSync(path.join(SRC, 'ARPHICPL.TXT'), path.join(OUT, 'ARPHICPL.TXT'));
console.log(`strokes: ${n} characters copied, ${missing} without data`);
