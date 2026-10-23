import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get, set } from 'idb-keyval';
import { addDays, today } from '../lib/date';
import type { Word } from '../content/schema';

/**
 * Course progress: which lesson steps are done, the flashcard deck, the
 * streak. Kept apart from the tone trainer's state so either can evolve
 * without migrating the other. Stored in IndexedDB with a localStorage
 * mirror, because Safari may evict IndexedDB for sites not added to the home
 * screen and the mirror survives that.
 */

export interface WordCard {
  id: string;          // "w:你好"
  zh: string;
  py: string;
  ru: string;
  lesson: string;
  ef: number;
  interval: number;    // days
  reps: number;
  lapses: number;
  due: string;         // YYYY-MM-DD
  added: string;
  history: number[];
}

export interface LessonProgress {
  steps: number[];     // completed step numbers
  test: number | null; // best test score, %
  doneAt: string | null;
}

export interface CourseSettings {
  rate: number;        // speech rate
  voiceURI: string | null;
  showPinyin: boolean;
  cardFront: 'zh' | 'ru';
}

export interface CourseState {
  v: 1;
  lessons: Record<string, LessonProgress>;
  cards: Record<string, WordCard>;
  last: { lesson: string; step: number } | null;
  xp: number;
  streak: number;
  bestStreak: number;
  lastDay: string | null;
  days: Record<string, number>; // day -> answers given
  settings: CourseSettings;
}

const KEY = 'xinghan-course-v1';

export function emptyCourse(): CourseState {
  return {
    v: 1, lessons: {}, cards: {}, last: null, xp: 0, streak: 0, bestStreak: 0, lastDay: null, days: {},
    settings: { rate: 0.8, voiceURI: null, showPinyin: true, cardFront: 'zh' },
  };
}

function normalise(raw: unknown): CourseState {
  const base = emptyCourse();
  if (!raw || typeof raw !== 'object' || (raw as CourseState).v !== 1) return base;
  const r = raw as Partial<CourseState>;
  return { ...base, ...r, settings: { ...base.settings, ...(r.settings ?? {}) } } as CourseState;
}

export async function loadCourse(): Promise<CourseState> {
  try {
    const fromDb = await get(KEY);
    if (fromDb) return normalise(fromDb);
  } catch { /* private mode or evicted: fall through to the mirror */ }
  try {
    const m = localStorage.getItem(KEY);
    if (m) return normalise(JSON.parse(m));
  } catch { /* ignore */ }
  return emptyCourse();
}

function saveCourse(s: CourseState) {
  set(KEY, s).catch(() => {});
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
}

/* ---------- spaced repetition (SM-2 with four buttons) ---------- */

export type Grade = 1 | 3 | 4 | 5; // Снова, Трудно, Хорошо, Легко
export const GRADES: { g: Grade; label: string; key: string }[] = [
  { g: 1, label: 'Снова', key: '1' },
  { g: 3, label: 'Трудно', key: '2' },
  { g: 4, label: 'Хорошо', key: '3' },
  { g: 5, label: 'Легко', key: '4' },
];

export function scheduleCard(c: WordCard, q: Grade, day = today()): WordCard {
  let { ef, interval, reps, lapses } = c;
  if (q < 3) {
    lapses += 1; reps = 0; interval = 0; ef = Math.max(1.3, ef - 0.2);
  } else {
    reps += 1;
    if (reps === 1) interval = q === 5 ? 3 : 1;
    else if (reps === 2) interval = q === 3 ? 2 : q === 5 ? 6 : 3;
    else interval = Math.round(interval * ef * (q === 3 ? 0.8 : q === 5 ? 1.3 : 1));
    interval = Math.min(365, Math.max(1, interval));
    ef = Math.min(2.8, Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));
  }
  return { ...c, ef, interval, reps, lapses, due: addDays(day, interval), history: [...c.history, q].slice(-20) };
}

/** "через 3 дн." — what each button would do, shown under it. */
export function previewInterval(c: WordCard, q: Grade): string {
  const d = scheduleCard(c, q).interval;
  if (d === 0) return 'сегодня';
  if (d < 30) return `${d} дн.`;
  if (d < 365) return `${Math.round(d / 30)} мес.`;
  return '1 год';
}

export const cardIdOf = (zh: string) => `w:${zh}`;

export function dueCards(cards: Record<string, WordCard>, day = today()): WordCard[] {
  return Object.values(cards).filter((c) => c.due <= day).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.interval - b.interval));
}

/* ---------- hook ---------- */

export function useCourse() {
  const [state, setState] = useState<CourseState | null>(null);
  const pending = useRef<CourseState | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => { loadCourse().then(setState); }, []);

  const persist = useCallback((next: CourseState) => {
    pending.current = next;
    if (timer.current !== null) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (pending.current) saveCourse(pending.current);
    }, 300);
  }, []);

  useEffect(() => {
    const flush = () => { if (pending.current) saveCourse(pending.current); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush); };
  }, []);

  const update = useCallback((fn: (s: CourseState) => CourseState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, [persist]);

  const actions = useMemo(() => {
    /** Counts toward the streak and the day log. */
    const touch = (s: CourseState, answers = 1, xp = 0): CourseState => {
      const day = today();
      let { streak, bestStreak } = s;
      if (s.lastDay !== day) {
        streak = s.lastDay === addDays(day, -1) ? streak + 1 : 1;
        bestStreak = Math.max(bestStreak, streak);
      }
      const days = { ...s.days, [day]: (s.days[day] ?? 0) + answers };
      const keys = Object.keys(days).sort();
      if (keys.length > 400) delete days[keys[0]];
      return { ...s, streak, bestStreak, lastDay: day, days, xp: s.xp + xp };
    };

    return {
      answered(correct: boolean) {
        update((s) => touch(s, 1, correct ? 10 : 2));
      },
      visit(lesson: string, step: number) {
        update((s) => (s.last?.lesson === lesson && s.last.step === step ? s : { ...s, last: { lesson, step } }));
      },
      completeStep(lesson: string, step: number, score?: number) {
        update((s) => {
          const p = s.lessons[lesson] ?? { steps: [], test: null, doneAt: null };
          const steps = p.steps.includes(step) ? p.steps : [...p.steps, step].sort((a, b) => a - b);
          const test = score === undefined ? p.test : Math.max(p.test ?? 0, score);
          const doneAt = p.doneAt ?? (steps.length === 8 ? today() : null);
          return touch({ ...s, lessons: { ...s.lessons, [lesson]: { steps, test, doneAt } } }, 0, 30);
        });
      },
      addCards(words: Word[], lesson: string) {
        update((s) => {
          const cards = { ...s.cards };
          const day = today();
          for (const w of words) {
            const id = cardIdOf(w.zh);
            if (!cards[id]) cards[id] = { id, zh: w.zh, py: w.py, ru: w.ru, lesson, ef: 2.5, interval: 0, reps: 0, lapses: 0, due: day, added: day, history: [] };
          }
          return { ...s, cards };
        });
      },
      grade(id: string, q: Grade) {
        update((s) => {
          const c = s.cards[id];
          if (!c) return s;
          return touch({ ...s, cards: { ...s.cards, [id]: scheduleCard(c, q) } }, 1, q >= 3 ? 8 : 2);
        });
      },
      removeCard(id: string) {
        update((s) => { const cards = { ...s.cards }; delete cards[id]; return { ...s, cards }; });
      },
      setSettings(patch: Partial<CourseSettings>) {
        update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      },
      replace(next: CourseState) {
        const n = normalise(next);
        setState(n); saveCourse(n);
      },
      reset() {
        const n = emptyCourse();
        setState(n); saveCourse(n);
      },
    };
  }, [update]);

  return { state, actions };
}

export type CourseActions = ReturnType<typeof useCourse>['actions'];
