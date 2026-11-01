import { useMemo, useState } from 'react';
import data from '../content/hanzi-notes.json';
import { BOOKS } from './data';
import { BY_CHAR } from '../lib/syllables';
import { Py, Say, StrokeBox } from './ui';
import { L, t } from '../i18n';

/**
 * "How to remember": what each character of Book 1A (lessons 1–15) is built
 * from and a one-line story tying the parts to the meaning, plus the list of
 * the parts that come up most often. Written for this site.
 */

interface Note { p: string[]; ru: string; en: string }
interface Part { c: string; ru: string; en: string }
const NOTES = (data as { notes: Record<string, Note> }).notes;
const PARTS = (data as { parts: Part[] }).parts;
const PART_BY = new Map(PARTS.map((p) => [p.c, p]));

export const noteOf = (c: string): Note | undefined => NOTES[c];
const HAN = /\p{Script=Han}/u;

/** The textbook lessons in order, with the characters each one introduces. */
const BOOK = BOOKS.find((b) => b.id === 'jc1a')!;
const NEW_BY_LESSON: { n: number; title: string; chars: string[] }[] = (() => {
  const seen = new Set<string>();
  return BOOK.lessons.map((l) => {
    const chars: string[] = [];
    for (const w of l.words) for (const c of w.zh) if (HAN.test(c) && !seen.has(c) && NOTES[c]) { seen.add(c); chars.push(c); }
    return { n: l.n, title: l.title, chars };
  });
})();
const LESSON_OF = new Map(NEW_BY_LESSON.flatMap((l) => l.chars.map((c) => [c, l.n] as const)));

/** Reading of a single character: the dictionary first, else a one-character word of the book. */
function pyOf(c: string): string | undefined {
  const h = BY_CHAR.get(c);
  if (h) return h.py.split(/\s+/)[0];
  for (const l of BOOK.lessons) for (const w of l.words) if (w.zh === c) return w.py;
  return undefined;
}

/** "女 + 子" with each part's meaning on hover and tap. */
function Formula({ parts }: { parts: string[] }) {
  if (!parts.length) return null;
  return (
    <span className="nt-formula">
      {parts.map((p, k) => {
        const g = PART_BY.get(p);
        return <span key={k}>{k > 0 && ' + '}<span className="zh" title={g ? t(g.ru, g.en) : undefined}>{p}</span></span>;
      })}
    </span>
  );
}

/** One line per character of a word: the character, its parts and the story. */
export function CharNotes({ zh, title = true }: { zh: string; title?: boolean }) {
  const cs = [...new Set([...zh].filter((c) => HAN.test(c) && NOTES[c]))];
  if (!cs.length) return null;
  return (
    <div className="nt">
      {title && <span className="nt-h">{t('Как запомнить', 'How to remember')}</span>}
      {cs.map((c) => {
        const n = NOTES[c];
        return (
          <a key={c} className="nt-row" href={`#/parts/${c}`}>
            <span className="nt-c zh">{c}</span>
            <span>{n.p.length > 0 && <><Formula parts={n.p} /> · </>}{t(n.ru, n.en)}</span>
          </a>
        );
      })}
    </div>
  );
}

/* ---------- page ---------- */

export default function PartsPage({ char }: { char?: string }) {
  if (char && NOTES[char]) return <CharPage c={char} />;
  return <Overview />;
}

function Overview() {
  const [lesson, setLesson] = useState(1);
  const examples = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [c, n] of Object.entries(NOTES)) for (const p of n.p) { const l = m.get(p) ?? []; if (!l.includes(c)) l.push(c); m.set(p, l); }
    return m;
  }, []);
  const cur = NEW_BY_LESSON.find((l) => l.n === lesson)!;
  return (
    <div className="page nt-page">
      <span className="eyebrow">{t('部件 · ДЕТАЛИ', '部件 · PARTS')}</span>
      <h1 className="serif h1">{t('Из чего состоят иероглифы', 'What characters are made of')}</h1>
      <p className="muted lead">{t('Большинство иероглифов собраны из простых деталей. Часто одна деталь подсказывает смысл (女 — что-то про женщину, 氵 — про воду), а другая — звук (马 → ma: 妈, 吗, 码). Выучи детали, и новые знаки станут знакомыми.', 'Most characters are built from simple parts. Often one part hints at the meaning (女 — about women, 氵 — about water) and another at the sound (马 → ma: 妈, 吗, 码). Learn the parts and new characters will look familiar.')}</p>

      <div className="row">
        <a className="chip" href={`${import.meta.env.BASE_URL}files/jc1a-1-7.pdf`} target="_blank" rel="noopener">📄 {t('PDF: уроки 1–7', 'PDF: lessons 1–7')}</a>
        <a className="chip" href={`${import.meta.env.BASE_URL}files/jc1a-1-15.pdf`} target="_blank" rel="noopener">📄 {t('PDF: уроки 1–15', 'PDF: lessons 1–15')}</a>
      </div>

      <section>
        <h2 className="serif h2">{t('Все иероглифы по урокам', 'Every character by lesson')}</h2>
        <p className="muted small">{t('Новые иероглифы каждого урока 《汉语教程》 1A: из чего состоят и как запомнить. Нажми на знак, чтобы увидеть порядок черт.', 'The new characters of each lesson of 《汉语教程》 1A: their parts and a way to remember them. Tap a character for its stroke order.')}</p>
        <div className="row nt-lessons">
          {NEW_BY_LESSON.map((l) => <button key={l.n} className={`chip ${l.n === lesson ? 'on' : ''}`} onClick={() => setLesson(l.n)}>{l.n}</button>)}
        </div>
        <p className="small muted">{t('Урок', 'Lesson')} {cur.n} · {L(cur.title)} · {t(`${cur.chars.length} новых иероглифов`, `${cur.chars.length} new characters`)}</p>
        <div className="nt-cards">
          {cur.chars.map((c) => {
            const n = NOTES[c], py = pyOf(c);
            return (
              <a key={c} className="panel nt-card" href={`#/parts/${c}`}>
                <span className="nt-big zh">{c}</span>
                <div>
                  {py && <Py text={py} />}
                  <div className="nt-f"><Formula parts={n.p} /></div>
                  <p className="small">{t(n.ru, n.en)}</p>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="serif h2">{t('Главные детали', 'The main parts')}</h2>
        <p className="muted small">{t('Самые частые детали в уроках 1–15 и иероглифы, в которых они встречаются.', 'The parts that come up most in lessons 1–15 and the characters that use them.')}</p>
        <div className="nt-parts">
          {PARTS.map((p) => (
            <div key={p.c} className="panel nt-part">
              <span className="nt-big zh">{p.c}</span>
              <div>
                <b className="small">{t(p.ru, p.en)}</b>
                <div className="nt-ex">{(examples.get(p.c) ?? []).map((c) => <a key={c} className="zh" href={`#/parts/${c}`}>{c}</a>)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CharPage({ c }: { c: string }) {
  const n = NOTES[c];
  const py = pyOf(c);
  const words = BOOK.lessons.flatMap((l) => l.words.filter((w) => w.zh.includes(c)).map((w) => ({ ...w, n: l.n })));
  const lesson = LESSON_OF.get(c);
  return (
    <div className="page narrow nt-page">
      <a className="back" href="#/parts">← {t('Детали', 'Parts')}</a>
      <section className="panel nt-detail">
        <div className="zh-xxl">{c}</div>
        {py && <Py text={py} className="py-l" />}
        <Say text={c} />
        {lesson && <p className="small muted">{t('Урок', 'Lesson')} {lesson}</p>}
        {n.p.length > 0 && (
          <div className="nt-pieces">
            {n.p.map((p, k) => {
              const g = PART_BY.get(p);
              return (
                <span key={k} className="nt-piece">
                  <span className="zh">{p}</span>
                  {g && <span className="small muted">{t(g.ru, g.en)}</span>}
                </span>
              );
            })}
          </div>
        )}
        <p className="nt-story">{t(n.ru, n.en)}</p>
        <StrokeBox char={c} size={200} />
      </section>
      {words.length > 0 && (
        <section className="panel">
          <h3>{t('Слова из учебника', 'Words from the textbook')}</h3>
          <ul className="wordlist">{words.map((w) => <li key={w.zh}><span className="zh">{w.zh}</span><Py text={w.py} /><span className="muted">{L(w.ru)}</span><Say text={w.zh} /></li>)}</ul>
        </section>
      )}
    </div>
  );
}
