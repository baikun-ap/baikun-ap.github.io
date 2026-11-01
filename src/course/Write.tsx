import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Word } from '../content/schema';
import { BOOKS } from './data';
import { autoMark, checkPinyin, shuffle } from './exercises';
import { hanOnly } from './listen';
import { Py, Say, StrokeBox, useCourseCtx } from './ui';
import { L, t } from '../i18n';
import { CharNotes } from './Notes';

/**
 * Writing practice: see the meaning, write the pinyin and the characters from
 * memory. Shared by the "Writing" page (any lessons, by default the ones the
 * learner has studied) and the midterm. Three ways to write: freely on a
 * blank grid with no hints at all, stroke by stroke with the stroke checker,
 * or on paper with a self-check.
 */

export const readLS = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
export const writeLS = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

export interface Result { right: number; total: number; misses: string[] }
export type WriteWord = Word & { lesson: number; tag?: string };

const LS_MODE = 'baikun-write-mode';
const LS_PY = 'baikun-write-pinyin';
type Mode = 'free' | 'screen' | 'paper';

/* ---------- runner: one pass, the score, redo the misses ---------- */

export function Runner<T>({ make, run, resumeKey, backHref, backLabel }: {
  make: () => T[]; resumeKey?: string; backHref: string; backLabel: string;
  run: (items: T[], done: (r: Result & { missed: T[] }) => void, start: number, onAt: (i: number) => void) => ReactNode;
}) {
  const [items, setItems] = useState(make);
  const [round, setRound] = useState(0);
  const [res, setResState] = useState<(Result & { missed: T[] }) | null>(null);
  // Only the first full pass in book order resumes; redoing mistakes starts at the top.
  const resumable = !!resumeKey && round === 0;
  const [start, setStart] = useState(() => { const n = Number(resumeKey ? readLS(resumeKey) : 0) || 0; return n < items.length ? n : 0; });
  const onAt = (i: number) => { if (resumable) writeLS(resumeKey!, String(i)); };
  const setRes = (r: Result & { missed: T[] }) => { if (resumeKey) writeLS(resumeKey, '0'); setResState(r); };
  if (!items.length) return <p className="muted">{t('Для выбранных уроков тут пока нет заданий.', 'No tasks for the chosen lessons yet.')}</p>;
  if (res) {
    const pct = Math.round((res.right / res.total) * 100);
    return (
      <div className="result">
        <div className={`result-num ${pct < 80 ? 'bad' : ''}`}>{pct}%</div>
        <p>{t(`Верно: ${res.right} из ${res.total}`, `Correct: ${res.right} of ${res.total}`)}</p>
        {res.misses.length > 0 && <div className="mt-misses"><span className="small muted">{t('Ошибки', 'Mistakes')}:</span> <span className="zh">{res.misses.join('　')}</span></div>}
        <div className="row center">
          {res.missed.length > 0 && <button className="btn primary" onClick={() => { setItems(shuffle(res.missed)); setResState(null); setStart(0); setRound(round + 1); }}>{t('Повторить ошибки', 'Redo mistakes')}</button>}
          <button className="btn" onClick={() => { setItems(make()); setResState(null); setStart(0); setRound(round + 1); }}>{t('Ещё раз', 'Again')}</button>
          <a className="btn" href={backHref}>{backLabel}</a>
        </div>
      </div>
    );
  }
  return (
    <div key={round}>
      {resumable && start > 0 && (
        <p className="small muted mt-note">{t(`Продолжаем с ${start + 1}-го задания.`, `Resuming at task ${start + 1}.`)} <button className="link-btn" onClick={() => { setStart(0); onAt(0); setRound(round + 1); }}>{t('Начать сначала', 'Start over')}</button></p>
      )}
      {run(items, setRes, resumable ? start : 0, onAt)}
    </div>
  );
}

/** Keeps the current task index in step with the runner's bookmark. */
export function useAt(start = 0, onAt?: (i: number) => void) {
  const [i, setI] = useState(start);
  useEffect(() => { onAt?.(i); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  return [i, setI] as const;
}

export function Progress({ i, n }: { i: number; n: number }) {
  return <div className="quiz-top"><span className="muted small">{i + 1} / {n}</span><span className="bar"><span style={{ width: `${(i / n) * 100}%` }} /></span></div>;
}

/* ---------- a blank square to write in with a finger, mouse or pencil ---------- */

export function FreeCanvas({ size, ghost }: { size: number; ghost?: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<{ x: number; y: number }[][]>([]);
  const drawing = useRef(false);
  const [count, setCount] = useState(0);

  const redraw = () => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = getComputedStyle(c).color;
    ctx.lineWidth = Math.max(4, size / 26);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of strokes.current) {
      ctx.beginPath();
      s.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (s.length === 1) ctx.lineTo(s[0].x + 0.1, s[0].y);
      ctx.stroke();
    }
  };
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr; c.height = size * dpr;
    redraw();
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  return (
    <div className="fc-wrap">
      <div className="fc" style={{ width: size, height: size }}>
        {ghost && <span className="fc-ghost zh" style={{ fontSize: size * 0.86, lineHeight: `${size}px` }}>{ghost}</span>}
        <canvas ref={ref} style={{ width: size, height: size }}
          onPointerDown={(e) => { e.preventDefault(); ref.current!.setPointerCapture(e.pointerId); drawing.current = true; strokes.current.push([at(e)]); redraw(); }}
          onPointerMove={(e) => { if (!drawing.current) return; strokes.current[strokes.current.length - 1].push(at(e)); redraw(); }}
          onPointerUp={() => { if (drawing.current) { drawing.current = false; setCount(strokes.current.length); } }}
          onPointerCancel={() => { drawing.current = false; setCount(strokes.current.length); }} />
      </div>
      {!ghost && (
        <div className="fc-tools">
          <button type="button" className="chip" disabled={!count} onClick={() => { strokes.current.pop(); setCount(strokes.current.length); redraw(); }} aria-label={t('Отменить черту', 'Undo stroke')}>↶</button>
          <button type="button" className="chip" disabled={!count} onClick={() => { strokes.current = []; setCount(0); redraw(); }} aria-label={t('Стереть', 'Clear')}>✕</button>
        </div>
      )}
    </div>
  );
}

/** Boxes as large as the screen allows: one or two per row. */
function useBoxSize(n: number) {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 390 : window.innerWidth));
  useEffect(() => { const on = () => setW(window.innerWidth); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const avail = Math.min(w - 48, 560);
  const perRow = n === 1 ? 1 : Math.min(n, avail >= 520 ? n : 2);
  return Math.floor(Math.min(n === 1 ? 240 : 180, (avail - (perRow - 1) * 12) / perRow));
}

/* ---------- the writing task ---------- */

export function WritePart({ items, onFinish, start, onAt }: { items: WriteWord[]; onFinish: (r: Result & { missed: WriteWord[] }) => void; start?: number; onAt?: (i: number) => void }) {
  const { actions } = useCourseCtx();
  const [i, setI] = useAt(start, onAt);
  const [mode, setModeState] = useState<Mode>(() => { const m = readLS(LS_MODE); return m === 'screen' || m === 'paper' ? m : 'free'; });
  const setMode = (m: Mode) => { setModeState(m); writeLS(LS_MODE, m); };
  const [askPy, setAskPyState] = useState(() => readLS(LS_PY) !== 'off');
  const setAskPy = (v: boolean) => { setAskPyState(v); writeLS(LS_PY, v ? 'on' : 'off'); };
  const [py, setPy] = useState('');
  const [pyRes, setPyRes] = useState<'ok' | 'tones' | 'wrong' | null>(null);
  const [ci, setCi] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hz, setHz] = useState<boolean | null>(null);   // characters written right?
  const [shown, setShown] = useState(false);
  const [right, setRight] = useState(0);
  const [missed, setMissed] = useState<WriteWord[]>([]);
  const w = items[i];
  const chars = [...hanOnly(w.zh)];
  const box = useBoxSize(chars.length);

  const checkPy = () => { if (py.trim()) setPyRes(checkPinyin(py, w.py)); };
  // Tones turn into marks as you type (ni3 → nǐ), and a right answer is accepted at once.
  const typePy = (raw: string) => {
    const v = autoMark(raw);
    setPy(v);
    if (checkPinyin(v, w.py) === 'ok') setPyRes('ok');
  };
  const addTone = (tone: number) => typePy(py.replace(/\s+$/, '') + tone);
  const charDone = (m: number) => {
    const total = mistakes + m;
    setMistakes(total);
    if (ci + 1 < chars.length) setCi(ci + 1);
    else setHz(total <= chars.length);   // a slip per character still counts as written
  };
  const pyDone = !askPy || pyRes !== null;
  const finished = pyDone && hz !== null;
  const ok = (!askPy || pyRes === 'ok') && hz === true;
  const next = () => {
    actions.answered(ok);
    const r = right + (ok ? 1 : 0), m = ok ? missed : [...missed, w];
    setRight(r); setMissed(m);
    setPy(''); setPyRes(null); setCi(0); setMistakes(0); setHz(null); setShown(false);
    if (i + 1 < items.length) setI(i + 1);
    else onFinish({ right: r, total: items.length, misses: m.map((x) => x.zh), missed: m });
  };
  const selfCheck = mode !== 'screen' && shown && hz === null;

  return (
    <div className="quiz mt-write">
      <Progress i={i} n={items.length} />
      <div className="row mt-modes">
        <div className="seg small">
          <button className={mode === 'free' ? 'on' : ''} onClick={() => setMode('free')}>{t('✍ Свободно', '✍ Freehand')}</button>
          <button className={mode === 'screen' ? 'on' : ''} onClick={() => setMode('screen')}>{t('🎯 Черты', '🎯 Strokes')}</button>
          <button className={mode === 'paper' ? 'on' : ''} onClick={() => setMode('paper')}>{t('📝 Бумага', '📝 Paper')}</button>
        </div>
        <label className="check small"><input type="checkbox" checked={askPy} onChange={(e) => setAskPy(e.target.checked)} /> {t('спрашивать пиньинь', 'ask pinyin')}</label>
      </div>
      <div className="q-prompt">
        <p className="q-ask">{askPy ? t('Напиши пиньинь и иероглифы', 'Write the pinyin and the characters') : t('Напиши иероглифы', 'Write the characters')} <span className="muted small">· {w.tag ?? `${t('урок', 'lesson')} ${w.lesson}`}</span></p>
        <div className="q-ru">{L(w.ru)}</div>
        <p className="muted small">{t(`${chars.length} ${chars.length === 1 ? 'иероглиф' : chars.length < 5 ? 'иероглифа' : 'иероглифов'}`, `${chars.length} ${chars.length === 1 ? 'character' : 'characters'}`)}</p>
      </div>

      {askPy && (
        <>
          <form className="row mt-py" onSubmit={(e) => { e.preventDefault(); checkPy(); }}>
            <input className="search" value={py} onChange={(e) => typePy(e.target.value)} disabled={pyRes !== null} autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
              placeholder={t('пиньинь, например ni3 → nǐ', 'pinyin, e.g. ni3 → nǐ')} style={{ marginBottom: 0 }} />
            {pyRes === null && <button className="btn primary" disabled={!py.trim()}>{t('Проверить', 'Check')}</button>}
          </form>
          {pyRes === null && (
            <div className="mt-tones">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" className={`tone-key t${n}`} onMouseDown={(e) => e.preventDefault()} onClick={() => addTone(n)}
                  aria-label={t(`${n}-й тон`, `Tone ${n}`)}>{['', 'ā', 'á', 'ǎ', 'à'][n]}</button>
              ))}
              <button type="button" className="tone-key" onMouseDown={(e) => e.preventDefault()} onClick={() => typePy(py + 'ü')}>ü</button>
              <button type="button" className="chip" onClick={() => setPyRes('wrong')}>{t('Не знаю', 'I don’t know')}</button>
            </div>
          )}
          {pyRes === null && i === 0 && <p className="small muted mt-note">{t('Пиши слог и сразу цифру тона: ni3 → nǐ, hao3 → hǎo. Или нажми кнопку тона после слога. Верный ответ засчитается сам.', 'Type a syllable and its tone number: ni3 → nǐ, hao3 → hǎo. Or tap a tone button after the syllable. A right answer is accepted by itself.')}</p>}
          {pyRes !== null && (
            <p className={`verdict ${pyRes === 'ok' ? 'ok' : 'bad'}`}>
              {pyRes === 'ok' ? t('Пиньинь верно!', 'Pinyin correct!') : pyRes === 'tones' ? t('Звуки верно, тоны — нет:', 'Sounds right, tones wrong:') : t('Неверно, правильно:', 'Wrong, correct:')} {pyRes !== 'ok' && <Py text={w.py} />}
            </p>
          )}
        </>
      )}

      <div className="mt-hz">
        {mode === 'free' && hz === null && (
          <>
            <div className="fc-row">{chars.map((c, k) => <FreeCanvas key={`${i}-${k}`} size={box} ghost={shown ? c : null} />)}</div>
            {!shown && <button className="btn primary" onClick={() => setShown(true)}>{t('Проверить иероглифы', 'Check the characters')}</button>}
            {!shown && i === 0 && <p className="small muted mt-note">{t('Пиши по памяти, подсказок нет. Потом нажми «Проверить» — правильный иероглиф появится поверх твоего.', 'Write from memory, no hints. Then press “Check” and the right character appears over yours.')}</p>}
          </>
        )}
        {mode === 'screen' && hz === null && !shown && (
          <>
            <div className="row center">{chars.map((c, k) => <span key={k} className={`mt-slot ${k < ci ? 'done' : k === ci ? 'cur' : ''}`}>{k < ci ? c : '？'}</span>)}</div>
            <StrokeBox key={`${i}-${ci}`} char={chars[ci]} size={220} mode="quiz" outline={false} onComplete={charDone} />
            <button className="chip" onClick={() => { setShown(true); setHz(false); }}>{t('Не помню — показать', 'I don’t remember — show me')}</button>
          </>
        )}
        {mode === 'paper' && hz === null && !shown && (
          <button className="btn" onClick={() => setShown(true)}>{t('Написал(а) на бумаге — показать ответ', 'Wrote it on paper — show the answer')}</button>
        )}
        {(shown || hz !== null) && (
          <div className="mt-reveal">
            <div className="zh-xxl">{w.zh}</div>
            <Py text={w.py} className="py-l" />
            <Say text={w.zh} />
            <CharNotes zh={w.zh} />
            {selfCheck && (
              <div className="row center">
                <button className="btn" onClick={() => setHz(false)}>{t('Ошибся', 'Got it wrong')}</button>
                <button className="btn primary" onClick={() => setHz(true)}>{t('Написал(а) верно', 'Wrote it right')}</button>
              </div>
            )}
            {(hz === false || selfCheck) && <div className="row center">{chars.map((c, k) => <StrokeBox key={k} char={c} size={120} />)}</div>}
          </div>
        )}
      </div>

      <div className="quiz-foot">
        {finished ? (
          <>
            <span className={`verdict ${ok ? 'ok' : 'bad'}`}>{ok ? t('Верно!', 'Correct!') : t('Есть ошибка — слово вернётся в «Повторить ошибки»', 'A mistake — the word goes to “Redo mistakes”')}</span>
            <button className="btn primary" onClick={next} autoFocus>{t('Дальше', 'Next')}</button>
          </>
        ) : <span className="muted small">{!pyDone ? t('Напиши пиньинь и иероглифы', 'Write the pinyin and the characters') : t('Теперь иероглифы', 'Now the characters')}</span>}
      </div>
    </div>
  );
}

/* ---------- the writing page: any lessons, by default the studied ones ---------- */

const LS_SEL = 'baikun-write-lessons';
const LS_ORDER = 'baikun-write-order';
const DEFAULT = Array.from({ length: 7 }, (_, k) => `jc1a-${k + 1}`);

export default function WritePage({ go }: { go?: string }) {
  const { state } = useCourseCtx();
  const studied = useMemo(() => BOOKS.flatMap((b) => b.lessons).filter((l) => (state.lessons[l.id]?.steps.length ?? 0) > 0).map((l) => l.id), [state.lessons]);
  const [sel, setSelState] = useState<string[]>(() => {
    const saved = readLS(LS_SEL)?.split(',').filter(Boolean);
    return saved?.length ? saved : DEFAULT;
  });
  const setSel = (s: string[]) => { setSelState(s); writeLS(LS_SEL, s.join(',')); };
  const [order, setOrderState] = useState<'book' | 'mix'>(() => (readLS(LS_ORDER) === 'mix' ? 'mix' : 'book'));
  const setOrder = (o: 'book' | 'mix') => { setOrderState(o); writeLS(LS_ORDER, o); };

  const words = useMemo(() => {
    const seen = new Set<string>();
    const out: WriteWord[] = [];
    for (const b of BOOKS) for (const l of b.lessons) {
      if (!sel.includes(l.id)) continue;
      for (const w of l.words) {
        if (w.zh.includes('…') || seen.has(w.zh)) continue;
        seen.add(w.zh);
        out.push({ ...w, lesson: l.n, tag: `${b.id === 'jc1a' ? '1A' : L(b.title)} · ${t('урок', 'lesson')} ${l.n}` });
      }
    }
    return out;
  }, [sel]);
  const charCount = useMemo(() => new Set(words.flatMap((w) => [...hanOnly(w.zh)])).size, [words]);

  if (go === 'go') {
    return (
      <div className="page narrow mt">
        <a className="back" href="#/write">← {t('Письмо', 'Writing')}</a>
        <h1 className="serif h2">{t('Пиши по памяти', 'Write from memory')}</h1>
        <Runner key={`${sel.join()}-${order}`} make={() => (order === 'mix' ? shuffle(words) : words)}
          resumeKey={order === 'book' ? `baikun-write-at-${sel.join('')}` : undefined}
          backHref="#/write" backLabel={t('К письму', 'Back to writing')}
          run={(items, done, start, onAt) => <WritePart items={items} onFinish={done} start={start} onAt={onAt} />} />
      </div>
    );
  }

  const toggle = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  return (
    <div className="page mt">
      <span className="eyebrow">{t('写 · ПИСЬМО', '写 · WRITING')}</span>
      <h1 className="serif h1">{t('Пиши иероглифы по памяти', 'Write characters from memory')}</h1>
      <p className="muted lead">{t('Повторяй слова пройденных уроков: видишь перевод — пишешь пиньинь и иероглифы. Режим «Свободно» — пустые клетки и никаких подсказок, как на экзамене.', 'Review the words of the lessons you have done: see the meaning, write the pinyin and the characters. “Freehand” is a blank grid with no hints, like in an exam.')}</p>

      {BOOKS.map((b) => (
        <section key={b.id} className="panel mt-lessons">
          <span className="small muted">{L(b.title)}</span>
          <div className="row">
            {b.lessons.map((l) => <button key={l.id} className={`chip ${sel.includes(l.id) ? 'on' : ''}`} aria-pressed={sel.includes(l.id)} onClick={() => toggle(l.id)}
              title={L(l.title)}>{l.n}</button>)}
          </div>
        </section>
      ))}
      <div className="row">
        <button className="chip" onClick={() => setSel(DEFAULT)}>{t('Уроки 1–7 (1A)', 'Lessons 1–7 (1A)')}</button>
        {studied.length > 0 && <button className="chip" onClick={() => setSel(studied)}>{t(`Пройденные на сайте · ${studied.length}`, `Done on the site · ${studied.length}`)}</button>}
        {sel.length > 0 && <button className="chip" onClick={() => setSel([])}>{t('Снять всё', 'Clear')}</button>}
      </div>
      <div className="row mt-orderrow">
        <span className="small muted">{t('Порядок', 'Order')}</span>
        <div className="seg small">
          <button className={order === 'book' ? 'on' : ''} onClick={() => setOrder('book')}>{t('Как в книге', 'As in the book')}</button>
          <button className={order === 'mix' ? 'on' : ''} onClick={() => setOrder('mix')}>{t('Вперемешку', 'Shuffled')}</button>
        </div>
      </div>
      <a className="panel nt-link" href="#/parts"><span className="zh">部</span><span><b>{t('Как запомнить иероглифы', 'How to remember characters')}</b><br /><span className="small muted">{t('Из каких деталей состоит каждый иероглиф уроков 1–15 и короткая история для запоминания →', 'The parts of every character in lessons 1–15 and a short story to remember it →')}</span></span></a>
      <p className="muted">{t(`Выбрано: ${words.length} слов, ${charCount} разных иероглифов.`, `Selected: ${words.length} words, ${charCount} different characters.`)}</p>
      <a className={`btn primary lg ${words.length ? '' : 'disabled'}`} href={words.length ? '#/write/go' : undefined} aria-disabled={!words.length}>{t('Начать писать', 'Start writing')}</a>
    </div>
  );
}
