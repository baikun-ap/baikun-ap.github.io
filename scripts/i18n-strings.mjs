// Lists every Russian content string in the books that has no English
// translation in src/content/en.json yet. Run: node scripts/i18n-strings.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
execSync('npx rolldown src/course/data.ts --format esm --platform node --file .cache/data.mjs', { stdio: 'ignore' });
const { BOOKS } = await import(`../.cache/data.mjs?${Date.now()}`);
const en = fs.existsSync('src/content/en.json') ? JSON.parse(fs.readFileSync('src/content/en.json', 'utf8')) : {};
const all = new Set();
const add = (s) => s && /[а-яё]/i.test(s) && all.add(s);
for (const b of BOOKS) {
  add(b.title); add(b.subtitle); b.audio?.forEach((a) => add(a.label));
  for (const l of b.lessons) {
    add(l.title); add(l.goal);
    l.words.forEach((w) => { add(w.ru); add(w.note); });
    for (const g of l.grammar) {
      add(g.title); add(g.formula); add(g.explain);
      g.examples.forEach((e) => add(e.ru));
      if (g.pitfall) { add(g.pitfall.why); add(g.pitfall.wrong); add(g.pitfall.right); }
    }
    l.dialogue.forEach((d) => { add(d.who); add(d.ru); });
  }
}
const missing = [...all].filter((s) => !(s in en));
if (process.argv[2] === '--json') fs.writeFileSync('.cache/missing.json', JSON.stringify(missing, null, 1));
console.log(all.size, 'strings,', missing.length, 'missing');
