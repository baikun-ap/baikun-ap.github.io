import type { Hanzi } from './types';
import { plural } from './date';
import { getLang, t, tr } from '../i18n';

/** The gloss in the interface language, falling back to the other one. */
export function gloss(h: Hanzi): string {
  return getLang() === 'en' ? h.en || h.ru : h.ru || h.en;
}

export function glossLang(h: Hanzi): 'ru' | 'en' {
  return getLang() === 'en' ? (h.en ? 'en' : 'ru') : (h.ru ? 'ru' : 'en');
}

/**
 * A gloss sometimes cites the character it defines (什 -> "что (в составе 什么)"),
 * which would hand the learner the answer during a recall prompt. Blank it out.
 */
export function maskChar(text: string, c: string): string {
  if (!text) return text;
  return text.split(c).join('◯');
}

const TONE_MAP: Record<string, number> = {
  ā: 1, ē: 1, ī: 1, ō: 1, ū: 1, ǖ: 1,
  á: 2, é: 2, í: 2, ó: 2, ú: 2, ǘ: 2,
  ǎ: 3, ě: 3, ǐ: 3, ǒ: 3, ǔ: 3, ǚ: 3,
  à: 4, è: 4, ì: 4, ò: 4, ù: 4, ǜ: 4,
};

/** Tone number of the first syllable, or 0 for the neutral tone. */
export function toneOf(pinyin: string): number {
  for (const ch of pinyin) {
    const t = TONE_MAP[ch];
    if (t) return t;
  }
  return 0;
}

/** "shuǐ" -> "shui", so typing plain ASCII pinyin finds the character. */
export function toneless(pinyin: string): string {
  return pinyin.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function syllables(pinyin: string): string[] {
  return pinyin.split(/\s+/).filter(Boolean);
}

export const TONE_NAMES = tr({ 0: ['нейтральный', 'neutral'], 1: ['1-й ровный', '1st, level'], 2: ['2-й восходящий', '2nd, rising'], 3: ['3-й нисходяще-восходящий', '3rd, falling-rising'], 4: ['4-й нисходящий', '4th, falling'] });

const IDC_NAMES: Record<string, string> = tr({
  '⿰': ['слева направо', 'left to right'],
  '⿱': ['сверху вниз', 'top to bottom'],
  '⿲': ['три части по горизонтали', 'three parts across'],
  '⿳': ['три части по вертикали', 'three parts down'],
  '⿴': ['полное обрамление', 'full enclosure'],
  '⿵': ['обрамление сверху', 'enclosed from above'],
  '⿶': ['обрамление снизу', 'enclosed from below'],
  '⿷': ['обрамление слева', 'enclosed from the left'],
  '⿸': ['обрамление сверху слева', 'enclosed top-left'],
  '⿹': ['обрамление сверху справа', 'enclosed top-right'],
  '⿺': ['обрамление снизу слева', 'enclosed bottom-left'],
  '⿻': ['наложение', 'overlaid'],
});

/** "⿰女子" -> "слева направо". Empty when the dataset has no decomposition. */
export function structureName(decomp: string): string {
  return IDC_NAMES[decomp[0]] ?? '';
}

/** Declines "черта" for a Russian count: 1 черта, 2 черты, 5 черт. */
export function strokesLabel(n: number | null): string {
  if (n === null) return t('? черт', '? strokes');
  return t(`${n} ${plural(n, 'черта', 'черты', 'черт')}`, `${n} ${n === 1 ? 'stroke' : 'strokes'}`);
}

export function hskLabel(h: Hanzi): string {
  const parts: string[] = [];
  if (h.hsk) parts.push(`HSK ${h.hsk === 7 ? '7-9' : h.hsk}`);
  if (h.hskOld && h.hskOld !== h.hsk) parts.push(t(`ст. HSK ${h.hskOld}`, `old HSK ${h.hskOld}`));
  return parts.join(' · ') || t('вне списков HSK', 'not in HSK lists');
}

export function levelFromXp(xp: number): { level: number; into: number; span: number } {
  // Each level costs a little more than the last: 100, 220, 360, ...
  let level = 1;
  let cost = 100;
  let rest = xp;
  while (rest >= cost) {
    rest -= cost;
    level += 1;
    cost = Math.round(cost * 1.18);
  }
  return { level, into: rest, span: cost };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}
