import type { Book, GrammarPoint, Lesson, Word } from '../content/schema';
import { STARTER } from '../content/starter';
import { JC1A } from '../content/jc1a';

/**
 * Every book the site teaches from. A new textbook is one more Book object in
 * src/content/ added to this list; lessons, exercises, cards and the grammar
 * reference all pick it up from here.
 */
export const BOOKS: Book[] = [JC1A, STARTER];

export const LESSONS: Lesson[] = BOOKS.flatMap((b) => b.lessons);
export const LESSON_BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

export function bookOf(lesson: Lesson): Book {
  return BOOKS.find((b) => b.id === lesson.book) ?? BOOKS[0];
}

export function nextLesson(id: string): Lesson | undefined {
  const i = LESSONS.findIndex((l) => l.id === id);
  return i >= 0 ? LESSONS[i + 1] : undefined;
}

/** Every word across all lessons, first occurrence wins, with the lesson it came from. */
export const ALL_WORDS: (Word & { lesson: string })[] = (() => {
  const seen = new Map<string, Word & { lesson: string }>();
  for (const l of LESSONS) for (const w of l.words) if (!seen.has(w.zh)) seen.set(w.zh, { ...w, lesson: l.id });
  return [...seen.values()];
})();
export const WORD_BY_ZH = new Map(ALL_WORDS.map((w) => [w.zh, w]));

export const ALL_GRAMMAR: (GrammarPoint & { lesson: Lesson })[] = LESSONS.flatMap((l) =>
  l.grammar.map((g) => ({ ...g, lesson: l })),
);

/** The eight steps every lesson walks through, in order. */
export const STEPS = [
  { n: 1, key: 'hanzi', title: 'Иероглифы', short: 'Знаки', zh: '字' },
  { n: 2, key: 'pinyin', title: 'Пиньинь', short: 'Пиньинь', zh: '拼' },
  { n: 3, key: 'tones', title: 'Тоны', short: 'Тоны', zh: '声' },
  { n: 4, key: 'listen', title: 'Аудирование', short: 'Слух', zh: '听' },
  { n: 5, key: 'speak', title: 'Говорение', short: 'Голос', zh: '说' },
  { n: 6, key: 'grammar', title: 'Грамматика', short: 'Грамм.', zh: '法' },
  { n: 7, key: 'test', title: 'Тест', short: 'Тест', zh: '考' },
  { n: 8, key: 'cards', title: 'Карточки', short: 'Карты', zh: '卡' },
] as const;
export type StepN = (typeof STEPS)[number]['n'];
