import { useSyncExternalStore } from 'react';
import EN from './content/en.json';

/**
 * Interface language. Russian is the source language of the site and of the
 * books; English is a layer on top: UI strings carry both versions inline as
 * t('…', '…'), and book content is looked up by its Russian text in
 * content/en.json (L), falling back to Russian when a line is not translated.
 * The choice lives in localStorage so the landing page and the app share it.
 */
export type Lang = 'ru' | 'en';
const KEY = 'baikun-lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch { /* storage blocked */ }
  const nav = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
  return /^(ru|uk|be|kk|ky|uz|tg)/.test(nav) ? 'ru' : 'en';
}

let lang: Lang = detect();
const subs = new Set<() => void>();
document.documentElement.lang = lang;

export const getLang = () => lang;

export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
  document.documentElement.lang = l;
  subs.forEach((f) => f());
}

export function useLang(): Lang {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => lang);
}

/** A UI string: Russian and English side by side. */
export const t = (ru: string, en: string) => (lang === 'en' ? en : ru);

const dict = EN as Record<string, string>;
/** Book content written in Russian, shown in English when a translation exists. */
export const L = (ru: string) => (lang === 'en' ? dict[ru] ?? ru : ru);

/** Russian plural: plural(5, 'слово', 'слова', 'слов'). */
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
}

/** A lookup table whose values follow the current language: tr({ a: ['…', '…'] }).a */
export function tr<K extends string | number>(m: Record<K, readonly [string, string]>): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of Object.keys(m) as K[]) Object.defineProperty(out, k, { enumerable: true, get: () => t(m[k][0], m[k][1]) });
  return out;
}
