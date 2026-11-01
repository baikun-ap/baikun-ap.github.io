import { useMemo, useState, type ReactNode } from 'react';
import { ANSWER, BUILD, FILL, MIDTERM_BOOK, MIDTERM_LESSONS, type AnswerItem, type BuildItem, type FillItem } from '../content/midterm';
import { LESSON_BY_ID } from './data';
import { shuffle } from './exercises';
import { Py, Say, useCourseCtx } from './ui';
import { Progress, Runner, WritePart, readLS, useAt, writeLS, type Result, type WriteWord } from './Write';
import { t } from '../i18n';
import Paper, { SlideWrite } from './Paper';

/**
 * Midterm practice for Book 1A, lessons 1–8, in the three formats of the
 * test: write every word in characters and pinyin, read a sentence and fill
 * the gap (three options), and put sentences and answers together.
 */

const LS_LESSONS = 'baikun-midterm-lessons';
const LS_ORDER = 'baikun-midterm-order';

type MidWord = WriteWord;
const wordsOf = (lessons: number[]): MidWord[] =>
  lessons.flatMap((n) => (LESSON_BY_ID.get(`${MIDTERM_BOOK}-${n}`)?.words ?? []).filter((w) => !w.zh.includes('…')).map((w) => ({ ...w, lesson: n })));


/* ---------- page ---------- */

export default function Midterm({ part, sub }: { part?: string; sub?: string }) {
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
      resumeKey={order === 'book' ? `baikun-midterm-at-${part}-${lessons.join('')}` : undefined}
      backHref="#/midterm" backLabel={t('К мидтерму', 'Back to midterm')} />
  );

  if (part === 'paper') return <Paper sub={sub} />;
  if (part === 'slide') return <SlideWrite />;
  if (part === 'write') return <Shell title={t('1. Написание: иероглифы и пиньинь', '1. Writing: characters and pinyin')}>{runner(words, (items, done, start, onAt) => <WritePart items={items} onFinish={done} start={start} onAt={onAt} />)}</Shell>;
  if (part === 'read') return <Shell title={t('2. Чтение: вставь слово', '2. Reading: fill the gap')}>{runner(fill, (items, done, start, onAt) => <FillPart items={items} onFinish={done} start={start} onAt={onAt} />)}</Shell>;
  if (part === 'build') return <Shell title={t('3. Собери предложение', '3. Build the sentence')}>{runner(build, (items, done, start, onAt) => <BuildPart items={items} onFinish={done} start={start} onAt={onAt} />)}</Shell>;
  if (part === 'answer') return <Shell title={t('3. Ответь на вопрос', '3. Answer the question')}>{runner(answer, (items, done, start, onAt) => <AnswerPart items={items} onFinish={done} start={start} onAt={onAt} />)}</Shell>;
  if (part === 'exam') return <Shell title={t('Пробный мидтерм', 'Practice midterm')}><Exam words={words} fill={fill} build={build} answer={answer} /></Shell>;

  return (
    <div className="page mt">
      <span className="eyebrow">{t('期中考试 · МИДТЕРМ', '期中考试 · MIDTERM')}</span>
      <h1 className="serif h1">{t('Подготовка к мидтерму', 'Midterm prep')}</h1>
      <p className="muted lead">{t('《汉语教程》 книга 1A, уроки 1–8: все слова из книги и задания, как на мидтерме.', '《汉语教程》 Book 1A, lessons 1–8: every word from the book and the tasks of the midterm.')}</p>

      <a className="panel mt-pdf mt-paper" href="#/midterm/paper">
        <span className="mt-zh zh">卷</span>
        <div><h3>{t('📝 Тест как у преподавателя', '📝 The teacher’s practice test')}</h3>
          <p className="muted small">{t('Задания с листов 《初级汉语》 試卷: пиньинь по иероглифам, слова из списка A–J, диалоги, счётные слова — те же слова, баллы до 100. И слайд «Write the correct 汉字».', 'The tasks from the 《初级汉语》 test sheets: pinyin, words from the A–J box, dialogues, measure words — same words, up to 100 points. Plus the “Write the correct 汉字” slide.')}</p></div>
      </a>

      <a className="panel mt-pdf" href={`${import.meta.env.BASE_URL}files/jc1a-1-8.pdf`} target="_blank" rel="noopener">
        <span className="mt-zh zh">词</span>
        <div><h3>{t('📄 Все слова уроков 1–8 (PDF)', '📄 All words of lessons 1–8 (PDF)')}</h3>
          <p className="muted small">{t('179 слов: иероглиф, пиньинь, перевод и как запомнить каждый иероглиф (из каких деталей он состоит). В конце — листы «Проверь себя» с клетками для письма.', '179 words: character, pinyin, meaning and how to remember each character (its parts), plus “test yourself” sheets with writing boxes.')}</p></div>
      </a>

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
