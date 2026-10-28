import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Word } from '../content/schema';
import { ANSWER, BUILD, FILL, MIDTERM_BOOK, MIDTERM_LESSONS, type AnswerItem, type BuildItem, type FillItem } from '../content/midterm';
import { LESSON_BY_ID } from './data';
import { autoMark, checkPinyin, shuffle } from './exercises';
import { hanOnly } from './listen';
import { Py, Say, StrokeBox, useCourseCtx } from './ui';
import { L, t } from '../i18n';

/**
 * Midterm practice for Book 1A, lessons 1–7, in the three formats of the
 * test: write every word in characters and pinyin, read a sentence and fill
 * the gap (three options), and put sentences and answers together.
 */

const LS_LESSONS = 'baikun-midterm-lessons';
const LS_WRITE = 'baikun-midterm-write';
const LS_ORDER = 'baikun-midterm-order';

const readLS = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLS = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

type MidWord = Word & { lesson: number };
const wordsOf = (lessons: number[]): MidWord[] =>
  lessons.flatMap((n) => (LESSON_BY_ID.get(`${MIDTERM_BOOK}-${n}`)?.words ?? []).filter((w) => !w.zh.includes('…')).map((w) => ({ ...w, lesson: n })));

interface Result { right: number; total: number; misses: string[] }

/* ---------- page ---------- */

export default function Midterm({ part }: { part?: string }) {
  const [lessons, setLessonsState] = useState<number[]>(() => {
    const saved = readLS(LS_LESSONS)?.split(',').map(Number).filter((n) => MIDTERM_LESSONS.includes(n));
    return saved?.length ? saved : MIDTERM_LESSONS;
  });
  const setLessons = (l: number[]) => { setLessonsState(l); writeLS(LS_LESSONS, l.join(',')); };
  const [order, setOrderState] = useState<'book' | 'mix'>(() => (readLS(LS_ORDER) === 'mix' ? 'mix' : 'book'));
  const setOrder = (o: 'book' | 'mix') => { setOrderState(o); writeLS(LS_ORDER, o); };
  // Built once per choice of lessons: a re-render (a saved answer, a sync) must never reshuffle the tasks on screen.
  const words = useMemo(() => wordsOf(lessons), [lessons]);
  const { fill, build, answer } = useMemo(() => {
    const inL = <T extends { lesson: number }>(x: T) => lessons.includes(x.lesson);
    return { fill: FILL.filter(inL), build: BUILD.filter(inL), answer: ANSWER.filter(inL) };
  }, [lessons]);
  const arrange = <T,>(list: T[]) => (order === 'mix' ? shuffle(list) : list);
  const runner = <T,>(list: T[], run: (items: T[], done: (r: Result & { missed: T[] }) => void, start: number, onAt: (i: number) => void) => ReactNode) => (
    <Runner key={`${part}-${lessons.join()}-${order}`} make={() => arrange(list)} run={run}
      resumeKey={order === 'book' ? `baikun-midterm-at-${part}-${lessons.join('')}` : undefined} />
  );

  if (part === 'write') return <Shell title={t('1. Написание: иероглифы и пиньинь', '1. Writing: characters and pinyin')}>{runner(words, (items, done, start, onAt) => <WritePart items={items} onFinish={done} start={start} onAt={onAt} />)}</Shell>;
  if (part === 'read') return <Shell title={t('2. Чтение: вставь слово', '2. Reading: fill the gap')}>{runner(fill, (items, done, start, onAt) => <FillPart items={items} onFinish={done} start={start} onAt={onAt} />)}</Shell>;
  if (part === 'build') return <Shell title={t('3. Собери предложение', '3. Build the sentence')}>{runner(build, (items, done, start, onAt) => <BuildPart items={items} onFinish={done} start={start} onAt={onAt} />)}</Shell>;
  if (part === 'answer') return <Shell title={t('3. Ответь на вопрос', '3. Answer the question')}>{runner(answer, (items, done, start, onAt) => <AnswerPart items={items} onFinish={done} start={start} onAt={onAt} />)}</Shell>;
  if (part === 'exam') return <Shell title={t('Пробный мидтерм', 'Practice midterm')}><Exam words={words} fill={fill} build={build} answer={answer} /></Shell>;

  return (
    <div className="page mt">
      <span className="eyebrow">{t('期中考试 · МИДТЕРМ', '期中考试 · MIDTERM')}</span>
      <h1 className="serif h1">{t('Подготовка к мидтерму', 'Midterm prep')}</h1>
      <p className="muted lead">{t('《汉语教程》 книга 1A, уроки 1–7: все слова из книги и три формата заданий, как на мидтерме.', '《汉语教程》 Book 1A, lessons 1–7: every word from the book and the three task types of the midterm.')}</p>

      <section className="panel mt-lessons">
        <span className="small muted">{t('Уроки', 'Lessons')}</span>
        <div className="row">
          {MIDTERM_LESSONS.map((n) => {
            const on = lessons.includes(n);
            return <button key={n} className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
              onClick={() => setLessons(on ? (lessons.length > 1 ? lessons.filter((x) => x !== n) : lessons) : [...lessons, n].sort((x, y) => x - y))}>{n}</button>;
          })}
          {lessons.length < MIDTERM_LESSONS.length && <button className="chip" onClick={() => setLessons(MIDTERM_LESSONS)}>{t('Все', 'All')}</button>}
        </div>
        <span className="small muted">{t('Порядок', 'Order')}</span>
        <div className="seg small">
          <button className={order === 'book' ? 'on' : ''} onClick={() => setOrder('book')}>{t('Как в книге', 'As in the book')}</button>
          <button className={order === 'mix' ? 'on' : ''} onClick={() => setOrder('mix')}>{t('Вперемешку', 'Shuffled')}</button>
        </div>
        <p className="small muted mt-note">{t('«Как в книге» — слова идут по урокам по порядку, и сайт помнит, где ты остановился.', '“As in the book” goes through the lessons in order and remembers where you stopped.')}</p>
      </section>

      <div className="mt-parts">
        <a className="panel mt-part" href="#/midterm/write">
          <span className="mt-zh zh">写</span>
          <div><h3>{t('1. Написание', '1. Writing')}</h3>
            <p className="muted small">{t(`Все ${words.length} слов: видишь перевод — пишешь пиньинь и иероглифы, на экране или на бумаге.`, `All ${words.length} words: see the meaning, write the pinyin and the characters, on screen or on paper.`)}</p></div>
        </a>
        <a className="panel mt-part" href="#/midterm/read">
          <span className="mt-zh zh">读</span>
          <div><h3>{t('2. Чтение', '2. Reading')}</h3>
            <p className="muted small">{t(`${fill.length} предложений на иероглифах с пропуском и тремя вариантами ответа.`, `${fill.length} sentences in characters with a gap and three options.`)}</p></div>
        </a>
        <div className="panel mt-part">
          <span className="mt-zh zh">说</span>
          <div><h3>{t('3. Предложения и ответы', '3. Sentences and answers')}</h3>
            <p className="muted small">{t('Собери предложение из слов и ответь на вопрос по-китайски.', 'Put a sentence together from words and answer a question in Chinese.')}</p>
            <div className="row">
              <a className="chip" href="#/midterm/build">{t(`Собрать предложение · ${build.length}`, `Build sentences · ${build.length}`)}</a>
              <a className="chip" href="#/midterm/answer">{t(`Ответить на вопрос · ${answer.length}`, `Answer questions · ${answer.length}`)}</a>
            </div></div>
        </div>
      </div>

      <a className="btn primary lg" href="#/midterm/exam">{t('Пробный мидтерм: 10 + 10 + 10 заданий', 'Practice midterm: 10 + 10 + 10 tasks')}</a>
    </div>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page narrow mt">
      <a className="back" href="#/midterm">← {t('Мидтерм', 'Midterm')}</a>
      <h1 className="serif h2">{title}</h1>
      {children}
    </div>
  );
}

/** Runs one part, then shows the score and offers to redo the misses. */
function Runner<T>({ make, run, resumeKey }: {
  make: () => T[]; resumeKey?: string;
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
          <a className="btn" href="#/midterm">{t('К мидтерму', 'Back to midterm')}</a>
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
function useAt(start = 0, onAt?: (i: number) => void) {
  const [i, setI] = useState(start);
  useEffect(() => { onAt?.(i); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  return [i, setI] as const;
}

function Progress({ i, n }: { i: number; n: number }) {
  return <div className="quiz-top"><span className="muted small">{i + 1} / {n}</span><span className="bar"><span style={{ width: `${(i / n) * 100}%` }} /></span></div>;
}

/* ---------- 1. writing ---------- */

function WritePart({ items, onFinish, start, onAt }: { items: MidWord[]; onFinish: (r: Result & { missed: MidWord[] }) => void; start?: number; onAt?: (i: number) => void }) {
  const { actions } = useCourseCtx();
  const [i, setI] = useAt(start, onAt);
  const [mode, setModeState] = useState<'screen' | 'paper'>(() => (readLS(LS_WRITE) === 'paper' ? 'paper' : 'screen'));
  const setMode = (m: 'screen' | 'paper') => { setModeState(m); writeLS(LS_WRITE, m); };
  const [py, setPy] = useState('');
  const [pyRes, setPyRes] = useState<'ok' | 'tones' | 'wrong' | null>(null);
  const [ci, setCi] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hz, setHz] = useState<boolean | null>(null);   // characters written right?
  const [shown, setShown] = useState(false);
  const [right, setRight] = useState(0);
  const [missed, setMissed] = useState<MidWord[]>([]);
  const w = items[i];
  const chars = [...hanOnly(w.zh)];

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
  const finished = pyRes !== null && hz !== null;
  const ok = pyRes === 'ok' && hz === true;
  const next = () => {
    actions.answered(ok);
    const r = right + (ok ? 1 : 0), m = ok ? missed : [...missed, w];
    setRight(r); setMissed(m);
    setPy(''); setPyRes(null); setCi(0); setMistakes(0); setHz(null); setShown(false);
    if (i + 1 < items.length) setI(i + 1);
    else onFinish({ right: r, total: items.length, misses: m.map((x) => x.zh), missed: m });
  };

  return (
    <div className="quiz mt-write">
      <Progress i={i} n={items.length} />
      <div className="seg small">
        <button className={mode === 'screen' ? 'on' : ''} onClick={() => setMode('screen')}>{t('✍ На экране', '✍ On screen')}</button>
        <button className={mode === 'paper' ? 'on' : ''} onClick={() => setMode('paper')}>{t('📝 На бумаге', '📝 On paper')}</button>
      </div>
      <div className="q-prompt">
        <p className="q-ask">{t('Напиши пиньинь и иероглифы', 'Write the pinyin and the characters')} <span className="muted small">· {t('урок', 'lesson')} {w.lesson}</span></p>
        <div className="q-ru">{L(w.ru)}</div>
        <p className="muted small">{t(`${chars.length} ${chars.length === 1 ? 'иероглиф' : chars.length < 5 ? 'иероглифа' : 'иероглифов'}`, `${chars.length} ${chars.length === 1 ? 'character' : 'characters'}`)}</p>
      </div>

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
      {pyRes === null && <p className="small muted mt-note">{t('Пиши слог и сразу цифру тона: ni3 → nǐ, hao3 → hǎo. Или нажми кнопку тона после слога. Верный ответ засчитается сам.', 'Type a syllable and its tone number: ni3 → nǐ, hao3 → hǎo. Or tap a tone button after the syllable. A right answer is accepted by itself.')}</p>}
      {pyRes !== null && (
        <p className={`verdict ${pyRes === 'ok' ? 'ok' : 'bad'}`}>
          {pyRes === 'ok' ? t('Пиньинь верно!', 'Pinyin correct!') : pyRes === 'tones' ? t('Звуки верно, тоны — нет:', 'Sounds right, tones wrong:') : t('Неверно, правильно:', 'Wrong, correct:')} {pyRes !== 'ok' && <Py text={w.py} />}
        </p>
      )}

      <div className="mt-hz">
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
            {mode === 'paper' && hz === null && (
              <div className="row center">
                <button className="btn" onClick={() => setHz(false)}>{t('Ошибся', 'Got it wrong')}</button>
                <button className="btn primary" onClick={() => setHz(true)}>{t('Написал(а) верно', 'Wrote it right')}</button>
              </div>
            )}
            {mode === 'screen' && hz === false && shown && <div className="row center">{chars.map((c, k) => <StrokeBox key={k} char={c} size={120} />)}</div>}
          </div>
        )}
      </div>

      <div className="quiz-foot">
        {finished ? (
          <>
            <span className={`verdict ${ok ? 'ok' : 'bad'}`}>{ok ? t('Верно!', 'Correct!') : t('Есть ошибка — слово вернётся в «Повторить ошибки»', 'A mistake — the word goes to “Redo mistakes”')}</span>
            <button className="btn primary" onClick={next} autoFocus>{t('Дальше', 'Next')}</button>
          </>
        ) : <span className="muted small">{pyRes === null ? t('Сначала пиньинь, потом иероглифы', 'Pinyin first, then the characters') : t('Теперь напиши иероглифы', 'Now write the characters')}</span>}
      </div>
    </div>
  );
}

/* ---------- 2. reading ---------- */

function FillPart({ items, onFinish, start, onAt }: { items: FillItem[]; onFinish: (r: Result & { missed: FillItem[] }) => void; start?: number; onAt?: (i: number) => void }) {
  const { actions } = useCourseCtx();
  const [i, setI] = useAt(start, onAt);
  const [picked, setPicked] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [right, setRight] = useState(0);
  const [missed, setMissed] = useState<FillItem[]>([]);
  const q = items[i];
  const options = useMemo(() => shuffle([q.answer, ...q.wrong]), [q]);
  const [before, after] = q.zh.split('__');
  const pick = (o: string) => { if (picked) return; setPicked(o); actions.answered(o === q.answer); };
  const next = () => {
    const ok = picked === q.answer;
    const r = right + (ok ? 1 : 0), m = ok ? missed : [...missed, q];
    setRight(r); setMissed(m); setPicked(null); setHint(false);
    if (i + 1 < items.length) setI(i + 1);
    else onFinish({ right: r, total: items.length, misses: m.map((x) => x.zh.replace('__', x.answer)), missed: m });
  };
  return (
    <div className="quiz">
      <Progress i={i} n={items.length} />
      <div className="q-prompt">
        <p className="q-ask">{t('Какое слово пропущено?', 'Which word is missing?')}</p>
        <div className="mt-sentence zh">{before}<span className={`mt-gap ${picked ? (picked === q.answer ? 'ok' : 'bad') : ''}`}>{picked ? q.answer : '\u00a0'}</span>{after}</div>
        {picked || hint ? <><Py text={q.py} />{picked && <p className="muted">{t(q.ru, q.en)}</p>}</>
          : <button className="chip" onClick={() => setHint(true)}>{t('Подсказка: пиньинь', 'Hint: pinyin')}</button>}
        {picked && <Say text={q.zh.replace('__', q.answer)} />}
      </div>
      <div className="opts opts-grid mt-opts">
        {options.map((o) => (
          <button key={o} className={`opt ${picked ? (o === q.answer ? 'ok' : o === picked ? 'bad' : 'dim') : ''}`} disabled={!!picked} onClick={() => pick(o)}><span className="zh">{o}</span></button>
        ))}
      </div>
      <div className="quiz-foot">
        {picked ? <><span className={`verdict ${picked === q.answer ? 'ok' : 'bad'}`}>{picked === q.answer ? t('Верно!', 'Correct!') : t('Не совсем', 'Not quite')}</span>
          <button className="btn primary" onClick={next} autoFocus>{t('Дальше', 'Next')}</button></>
          : <span className="muted small">{t('Выбери ответ', 'Choose an answer')}</span>}
      </div>
    </div>
  );
}

/* ---------- 3. sentences and answers ---------- */

function useTiles(tokens: string[]) {
  const bank = useMemo(() => {
    let s = shuffle(tokens.map((_, k) => k));
    // A one-word puzzle aside, never hand the tiles over already in order.
    for (let n = 0; n < 5 && tokens.length > 1 && s.every((v, k) => tokens[v] === tokens[k]); n++) s = shuffle(s);
    return s;
  }, [tokens]);
  const [built, setBuilt] = useState<number[]>([]);
  return { bank, built, setBuilt };
}

const matches = (got: string[], item: { tokens: string[]; alts?: string[][] }) =>
  [item.tokens, ...(item.alts ?? [])].some((o) => o.join('') === got.join(''));

function Tiles({ tokens, built, setBuilt, bank, state }: { tokens: string[]; built: number[]; setBuilt: (b: number[]) => void; bank: number[]; state: 'ok' | 'bad' | null }) {
  return (
    <div className="build">
      <div className={`build-line ${state ?? ''}`}>
        {built.length === 0 && <span className="muted small">{t('Нажимай на слова по порядку', 'Tap the words in order')}</span>}
        {built.map((k, n) => <button key={n} className="tile on" disabled={!!state} onClick={() => setBuilt(built.filter((_, m) => m !== n))}>{tokens[k]}</button>)}
      </div>
      <div className="build-bank">
        {bank.map((k) => <button key={k} className="tile" disabled={!!state || built.includes(k)} onClick={() => setBuilt([...built, k])}>{tokens[k]}</button>)}
      </div>
    </div>
  );
}

function BuildPart({ items, onFinish, start, onAt }: { items: BuildItem[]; onFinish: (r: Result & { missed: BuildItem[] }) => void; start?: number; onAt?: (i: number) => void }) {
  return <TilePart items={items} onFinish={onFinish} start={start} onAt={onAt} prompt={(q) => <><p className="q-ask">{t('Собери предложение', 'Build the sentence')}</p><div className="q-ru">{t(q.ru, q.en)}</div></>} />;
}

function AnswerPart({ items, onFinish, start, onAt }: { items: AnswerItem[]; onFinish: (r: Result & { missed: AnswerItem[] }) => void; start?: number; onAt?: (i: number) => void }) {
  const [hint, setHint] = useState<string | null>(null);
  return <TilePart items={items} onFinish={onFinish} start={start} onAt={onAt} prompt={(q, checked) => (
    <>
      <p className="q-ask">{t('Ответь на вопрос — собери ответ из слов', 'Answer the question — build the reply from the words')}</p>
      <div className="mt-sentence zh">{q.q}</div>
      <Say text={q.q} />
      {checked || hint === q.q ? <><Py text={q.qPy} /><p className="muted small">{t(q.qRu, q.qEn)}</p></>
        : <button className="chip" onClick={() => setHint(q.q)}>{t('Подсказка: перевод', 'Hint: translation')}</button>}
    </>
  )} />;
}

function TilePart<T extends { tokens: string[]; alts?: string[][]; py: string; ru: string; en: string }>({ items, onFinish, prompt, start, onAt }: {
  items: T[]; onFinish: (r: Result & { missed: T[] }) => void; prompt: (q: T, checked: boolean) => ReactNode; start?: number; onAt?: (i: number) => void;
}) {
  const [i, setI] = useAt(start, onAt);
  const [right, setRight] = useState(0);
  const [missed, setMissed] = useState<T[]>([]);
  const q = items[i];
  return <TileQuestion key={i} q={q} i={i} n={items.length} prompt={prompt} onNext={(ok) => {
    const r = right + (ok ? 1 : 0), m = ok ? missed : [...missed, q];
    setRight(r); setMissed(m);
    if (i + 1 < items.length) setI(i + 1);
    else onFinish({ right: r, total: items.length, misses: m.map((x) => x.tokens.join('')), missed: m });
  }} />;
}

function TileQuestion<T extends { tokens: string[]; alts?: string[][]; py: string; ru: string; en: string }>({ q, i, n, prompt, onNext }: {
  q: T; i: number; n: number; prompt: (q: T, checked: boolean) => ReactNode; onNext: (ok: boolean) => void;
}) {
  const { actions } = useCourseCtx();
  const { bank, built, setBuilt } = useTiles(q.tokens);
  const [state, setState] = useState<'ok' | 'bad' | null>(null);
  const check = () => { const ok = matches(built.map((k) => q.tokens[k]), q); setState(ok ? 'ok' : 'bad'); actions.answered(ok); };
  return (
    <div className="quiz">
      <Progress i={i} n={n} />
      <div className="q-prompt">{prompt(q, !!state)}</div>
      <Tiles tokens={q.tokens} built={built} setBuilt={setBuilt} bank={bank} state={state} />
      {state && (
        <div className="answer">
          {state === 'bad' && <p>{t('Правильно', 'Answer')}: <b className="zh">{q.tokens.join('')}</b></p>}
          <Py text={q.py} /> <span className="muted small">· {t(q.ru, q.en)}</span> <Say text={q.tokens.join('')} />
        </div>
      )}
      <div className="quiz-foot">
        {state ? <><span className={`verdict ${state}`}>{state === 'ok' ? t('Верно!', 'Correct!') : t('Не совсем', 'Not quite')}</span>
          <button className="btn primary" onClick={() => onNext(state === 'ok')} autoFocus>{t('Дальше', 'Next')}</button></>
          : <button className="btn primary" disabled={built.length !== q.tokens.length} onClick={check}>{t('Проверить', 'Check')}</button>}
      </div>
    </div>
  );
}

/* ---------- practice midterm ---------- */

function Exam({ words, fill, build, answer }: { words: MidWord[]; fill: FillItem[]; build: BuildItem[]; answer: AnswerItem[] }) {
  // Parts with nothing to ask for the chosen lessons are left out.
  // Drawn once when the exam starts and kept for its whole run.
  const [parts] = useState(() => [
    { key: 'write', items: shuffle(words).slice(0, 10) },
    { key: 'fill', items: shuffle(fill).slice(0, 10) },
    { key: 'build', items: shuffle(build).slice(0, 5) },
    { key: 'answer', items: shuffle(answer).slice(0, 5) },
  ].filter((p) => p.items.length));
  const [stage, setStage] = useState(0);
  const [scores, setScores] = useState<Result[]>([]);
  const done = (r: Result) => { setScores([...scores, r]); setStage(stage + 1); };
  const NAMES: Record<string, string> = { write: t('Написание', 'Writing'), fill: t('Чтение', 'Reading'), build: t('Предложения', 'Sentences'), answer: t('Ответы', 'Answers') };

  if (stage >= parts.length) {
    const right = scores.reduce((s, r) => s + r.right, 0), total = scores.reduce((s, r) => s + r.total, 0);
    const pct = Math.round((right / total) * 100);
    return (
      <div className="result">
        <div className={`result-num ${pct < 80 ? 'bad' : ''}`}>{pct}%</div>
        <p>{t(`Итог: ${right} из ${total}`, `Total: ${right} of ${total}`)}</p>
        <ul className="mt-score">{scores.map((r, k) => <li key={k}><span>{NAMES[parts[k].key]}</span><b>{r.right}/{r.total}</b></li>)}</ul>
        {scores.some((r) => r.misses.length) && <div className="mt-misses"><span className="small muted">{t('Ошибки', 'Mistakes')}:</span> <span className="zh">{scores.flatMap((r) => r.misses).join('　')}</span></div>}
        <div className="row center"><a className="btn primary" href="#/midterm">{t('К мидтерму', 'Back to midterm')}</a></div>
      </div>
    );
  }
  const part = parts[stage];
  return (
    <>
      <p className="hint">{t(`Часть ${stage + 1} из ${parts.length} · ${NAMES[part.key]}`, `Part ${stage + 1} of ${parts.length} · ${NAMES[part.key]}`)}</p>
      {part.key === 'write' && <WritePart key={part.key} items={part.items as MidWord[]} onFinish={done} />}
      {part.key === 'fill' && <FillPart key={part.key} items={part.items as FillItem[]} onFinish={done} />}
      {part.key === 'build' && <BuildPart key={part.key} items={part.items as BuildItem[]} onFinish={done} />}
      {part.key === 'answer' && <AnswerPart key={part.key} items={part.items as AnswerItem[]} onFinish={done} />}
    </>
  );
}
