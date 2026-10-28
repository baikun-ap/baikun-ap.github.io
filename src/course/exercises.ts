import type { Lesson, Sentence, Word } from '../content/schema';
import { parsePinyin, stripTone, toneOf, type Tone } from '../lib/pinyin';
import { ALL_WORDS } from './data';

/**
 * Exercise generation. Everything is built from a lesson's words, grammar
 * examples and dialogue, so a new book chapter brings its exercises with it.
 */

export type Question =
  | { kind: 'pinyin'; zh: string; ru: string; options: string[]; answer: number; say: string }
  | { kind: 'tone'; zh: string; ru: string; bare: string; options: Tone[][]; answer: number; say: string }
  | { kind: 'listen'; say: string; zh: string; py: string; options: string[]; answer: number }
  | { kind: 'meaning'; zh: string; py: string; options: string[]; answer: number; say: string }
  | { kind: 'reverse'; ru: string; options: string[]; optionsPy: string[]; answer: number; say: string }
  | { kind: 'build'; ru: string; tokens: string[]; order: string[]; py: string; say: string };

/* ---------- small helpers ---------- */

export function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
const uniq = <T,>(a: T[]) => [...new Set(a)];

/** Put the right answer among distractors at a random index. */
function choice<T>(right: T, wrong: T[], n = 4, key: (x: T) => string = String): { options: T[]; answer: number } {
  const seen = new Set([key(right)]);
  const picked: T[] = [];
  for (const w of shuffle(wrong)) { if (picked.length >= n - 1) break; const k = key(w); if (!seen.has(k)) { seen.add(k); picked.push(w); } }
  const options = shuffle([right, ...picked]);
  return { options, answer: options.findIndex((o) => key(o) === key(right)) };
}

const VOWELS = 'aeiouü';
const MARKS: Record<string, string[]> = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'], e: ['e', 'ē', 'é', 'ě', 'è'], i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'], u: ['u', 'ū', 'ú', 'ǔ', 'ù'], ü: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

/** Writes a toneless syllable with a tone mark in the standard position. */
export function markTone(base: string, tone: Tone): string {
  if (tone === 5) return base;
  const s = base.toLowerCase();
  let idx = s.indexOf('a');
  if (idx < 0) idx = s.indexOf('e');
  if (idx < 0) idx = s.indexOf('ou');
  if (idx < 0) for (let i = s.length - 1; i >= 0; i--) if (VOWELS.includes(s[i])) { idx = i; break; }
  if (idx < 0) return base;
  const v = s[idx];
  return base.slice(0, idx) + MARKS[v][tone] + base.slice(idx + 1);
}

/** "nǐ hǎo" with one syllable's tone changed. */
function retone(py: string, which: number, tone: Tone): string {
  let k = -1;
  return py.replace(/[\p{L}ü]+/gu, (syl) => { k += 1; return k === which ? markTone(stripTone(syl), tone) : syl; });
}

export const tonesOf = (py: string): Tone[] => parsePinyin(py).map((s) => s.tone);
export const bare = (py: string) => stripTone(py);

const pyKey = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/* ---------- typed pinyin ---------- */

const TONE_MARKS = /[\u0300\u0301\u0304\u030c]/g;

/** "ni3 hao3", "nǐhǎo" and "Nǐ hǎo" all become "nǐhǎo". */
export function normPinyin(s: string): string {
  const x = s.normalize('NFC').toLowerCase().trim().replace(/u:/g, 'ü').replace(/v/g, 'ü')
    .replace(/([a-zü]+)([0-5])/g, (_, syl: string, d: string) => (d === '0' || d === '5' ? syl : markTone(syl, Number(d) as Tone)));
  return x.replace(/[\s'’\-·.,!?]/g, '');
}
const toneless = (s: string) => s.normalize('NFD').replace(TONE_MARKS, '').normalize('NFC');

export function checkPinyin(input: string, target: string): 'ok' | 'tones' | 'wrong' {
  const a = normPinyin(input), b = normPinyin(target);
  if (a === b) return 'ok';
  return toneless(a) === toneless(b) ? 'tones' : 'wrong';
}

/* ---------- generators ---------- */

function pinyinQ(w: Word, pool: Word[]): Question {
  const syl = parsePinyin(w.py);
  const variants: string[] = [];
  syl.forEach((s, i) => ([1, 2, 3, 4] as Tone[]).forEach((t) => { if (t !== s.tone) variants.push(retone(w.py, i, t)); }));
  const others = pool.filter((p) => p.zh !== w.zh).map((p) => p.py);
  const wrong = [...shuffle(variants).slice(0, 2), ...shuffle(others)];
  const { options, answer } = choice(w.py, wrong, 4, pyKey);
  return { kind: 'pinyin', zh: w.zh, ru: w.ru, options, answer, say: w.zh };
}

function toneQ(w: Word): Question {
  const right = tonesOf(w.py);
  const wrong: Tone[][] = [];
  for (let k = 0; k < 12; k++) wrong.push(right.map((t) => (Math.random() < 0.6 ? t : ([1, 2, 3, 4] as Tone[])[Math.floor(Math.random() * 4)])));
  const { options, answer } = choice(right, wrong, 4, (t) => t.join(''));
  return { kind: 'tone', zh: w.zh, ru: w.ru, bare: bare(w.py), options, answer, say: w.zh };
}

function meaningQ(w: Word, pool: Word[]): Question {
  const { options, answer } = choice(w.ru, pool.filter((p) => p.zh !== w.zh).map((p) => p.ru));
  return { kind: 'meaning', zh: w.zh, py: w.py, options, answer, say: w.zh };
}

function reverseQ(w: Word, pool: Word[]): Question {
  const others = pool.filter((p) => p.zh !== w.zh && p.ru !== w.ru);
  const { options, answer } = choice(w, others, 4, (x) => x.zh);
  return { kind: 'reverse', ru: w.ru, options: options.map((o) => o.zh), optionsPy: options.map((o) => o.py), answer, say: w.zh };
}

function listenQ(item: { zh: string; py: string; ru: string }, pool: { ru: string }[]): Question {
  const { options, answer } = choice(item.ru, pool.map((p) => p.ru));
  return { kind: 'listen', say: item.zh, zh: item.zh, py: item.py, options, answer };
}

const PUNCT = /^[，。！？、,.!?；;：:]+$/u;
function buildQ(s: Sentence): Question | null {
  const order = s.zh.filter((t) => !PUNCT.test(t));
  if (order.length < 2) return null;
  let tokens = shuffle(order);
  for (let k = 0; k < 5 && tokens.join('') === order.join(''); k++) tokens = shuffle(order);
  return { kind: 'build', ru: s.ru, tokens, order, py: s.py, say: s.zh.join('') };
}

/** Wider pool so distractors exist even in a lesson with few words. */
function poolFor(lesson: Lesson): Word[] {
  return lesson.words.length >= 6 ? lesson.words : uniq([...lesson.words, ...ALL_WORDS]);
}

const limit = <T,>(a: T[], n: number) => shuffle(a).slice(0, n);
/** Pattern entries such as «太……了» are taught in grammar, not quizzed as words. */
const quizWords = (l: Lesson) => l.words.filter((w) => !w.zh.includes('…'));

export function pinyinSet(l: Lesson): Question[] { return limit(quizWords(l), 8).map((w) => pinyinQ(w, poolFor(l))); }
export function toneSet(l: Lesson): Question[] { return limit(quizWords(l), 8).map(toneQ); }

export function sentencesOf(l: Lesson): { zh: string; py: string; ru: string }[] {
  return [
    ...l.dialogue.map((d) => ({ zh: d.zh, py: d.py, ru: d.ru })),
    ...l.grammar.flatMap((g) => g.examples.map((e) => ({ zh: e.zh.join(''), py: e.py, ru: e.ru }))),
  ];
}

export function listenSet(l: Lesson): Question[] {
  const sents = sentencesOf(l);
  const words = limit(quizWords(l), 4).map((w) => listenQ(w, poolFor(l)));
  const lines = limit(sents, 4).map((s) => listenQ(s, sents.length >= 4 ? sents : [...sents, ...ALL_WORDS]));
  return [...words, ...lines];
}

export function buildSet(l: Lesson, n = 3): Question[] {
  const all = l.grammar.flatMap((g) => g.examples).map(buildQ).filter((q): q is Question => !!q);
  return limit(all, n);
}

export function testSet(l: Lesson): Question[] {
  const pool = poolFor(l);
  const ws = shuffle(quizWords(l));
  const qs: Question[] = [
    ...ws.slice(0, 3).map((w) => meaningQ(w, pool)),
    ...ws.slice(3, 6).map((w) => reverseQ(w, pool)),
    ...ws.slice(6, 8).map((w) => pinyinQ(w, pool)),
    ...ws.slice(8, 9).map(toneQ),
    ...limit(sentencesOf(l), 1).map((s) => listenQ(s, sentencesOf(l).length >= 4 ? sentencesOf(l) : [...sentencesOf(l), ...ALL_WORDS])),
    ...buildSet(l, 2),
  ];
  return shuffle(qs);
}

export function isCorrect(q: Question, pick: number | string[]): boolean {
  if (q.kind === 'build') return Array.isArray(pick) && pick.join('') === q.order.join('');
  return pick === q.answer;
}

export { toneOf };
