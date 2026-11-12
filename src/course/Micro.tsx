import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ALL_MICRO, ASSIGNMENTS, EXAM_SIZE, PER_ASSIGNMENT, type MicroQ } from '../content/micro';
import { shuffle } from './exercises';
import { useCourseCtx } from './ui';
import { Progress, Runner, readLS, useAt, type Result } from './Write';
import { t } from '../i18n';

/**
 * Microeconomics: practise each of the four assignments (20 questions each),
 * a mock exam of 50 questions drawn from all 80, the questions last missed,
 * the ones not tried yet, and flip cards. The last result of every question is
 * part of the course progress, so it follows the learner across devices.
 */

/** Where earlier builds kept the results, on this device only. They now live in the synced progress. */
const LS = 'baikun-micro';
const readOld = (): Record<string, 0 | 1> => { try { return JSON.parse(readLS(LS) ?? '{}') as Record<string, 0 | 1>; } catch { return {}; } };

/** Typing in a field, or holding a modifier, is never a shortcut. */
const typing = (e: KeyboardEvent) => e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement | null)?.tagName ?? '');
const onButton = () => /^(BUTTON|A)$/.test(document.activeElement?.tagName ?? '');

const LETTERS = 'ABCDEFGH';
const isChoice = (q: MicroQ) => !!q.options?.length;
const answerText = (q: MicroQ) => (isChoice(q) ? `${LETTERS[q.answer as number]}. ${q.options![q.answer as number]}` : String(q.answer));

export default function Micro({ part }: { part?: string }) {
  const all = ALL_MICRO();
  const { state, actions } = useCourseCtx();
  useEffect(() => { const old = readOld(); if (Object.keys(old).length) actions.importMicro(old); }, [actions]);
  const m = (id: string) => state.micro?.[id]?.ok;
  const back = { backHref: '#/micro', backLabel: t('К микроэкономике', 'Back to microeconomics') };
  const run = (title: string, make: () => MicroQ[], resumeKey?: string) => (
    <Shell title={title}>
      <Runner key={part} make={make} resumeKey={resumeKey} {...back}
        run={(items, done, start, onAt) => <MicroPart items={items} onFinish={done} start={start} onAt={onAt} />} />
    </Shell>
  );

  const a = part?.match(/^a(\d)$/)?.[1];
  const as = a ? ASSIGNMENTS.find((x) => x.n === Number(a)) : undefined;
  if (as) return run(`${as.title}`, () => as.questions, `baikun-micro-at-${as.n}`);
  if (part === 'exam') return run(t(`Пробный экзамен · ${Math.min(EXAM_SIZE, all.length)} вопросов`, `Mock exam · ${Math.min(EXAM_SIZE, all.length)} questions`), () => shuffle(all).slice(0, EXAM_SIZE));
  if (part === 'mistakes') return run(t('Мои ошибки', 'My mistakes'), () => shuffle(all.filter((q) => m(q.id) === 0)));
  if (part === 'new') return run(t('Ещё не решал', 'Not tried yet'), () => all.filter((q) => m(q.id) === undefined));
  if (part === 'cards') return <Shell title={t('Карточки: вопрос → ответ', 'Cards: question → answer')}><Flip /></Shell>;

  const known = all.filter((q) => m(q.id) === 1).length;
  const wrong = all.filter((q) => m(q.id) === 0).length;
  const fresh = all.length - known - wrong;
  const empty = all.length === 0;

  return (
    <div className="page mt micro">
      <span className="eyebrow">{t('微观经济学 · МИКРОЭКОНОМИКА', '微观经济学 · MICROECONOMICS')}</span>
      <h1 className="serif h1">{t('Микроэкономика', 'Microeconomics')}</h1>
      <p className="muted lead">{t(
        `4 задания по ${PER_ASSIGNMENT} вопросов — всего ${4 * PER_ASSIGNMENT}. На экзамене будет ${EXAM_SIZE} из них, поэтому учим все.`,
        `4 assignments of ${PER_ASSIGNMENT} questions — ${4 * PER_ASSIGNMENT} in all. ${EXAM_SIZE} of them will be on the exam, so learn every one.`)}</p>

      {empty ? (
        <div className="panel micro-empty">
          <h3>{t('Вопросы ещё не добавлены', 'No questions yet')}</h3>
          <p className="muted small">{t('Пришли фото заданий (Assignment 1–4) — я перепишу все вопросы с ответами и объяснениями, и здесь появятся тренировка, пробный экзамен на 50 вопросов и карточки.', 'Send photos of the assignment sheets (1–4): every question goes in with its answer and an explanation, and the practice, the 50-question mock exam and the cards appear here.')}</p>
        </div>
      ) : (
        <section className="stats">
          <div className="stat"><b>{all.length}</b><span>{t('вопросов на сайте', 'questions here')}</span></div>
          <div className="stat"><b>{known}</b><span>{t('отвечены верно', 'answered right')}</span></div>
          <div className="stat"><b>{wrong}</b><span>{t('с ошибкой', 'missed')}</span></div>
          <div className="stat"><b>{fresh}</b><span>{t('ещё не решал', 'not tried yet')}</span></div>
        </section>
      )}

      <div className="mt-parts">
        {ASSIGNMENTS.map((x) => {
          const n = x.questions.length;
          const ok = x.questions.filter((q) => m(q.id) === 1).length;
          const body = (
            <>
              <span className="mt-zh">{x.n}</span>
              <div><h3>{x.title}</h3>
                {x.chapters && <p className="small micro-ch">{x.chapters}</p>}
                <p className="muted small">{n
                  ? t(`${n} вопросов · верно ${ok}`, `${n} questions · ${ok} right`)
                  : t('ждёт фото с вопросами', 'waiting for the question photos')}{x.due ? ` · ${t('сдать до', 'due')} ${x.due.split('-').reverse().slice(0, 2).join('.')}` : ''}</p>
                {n > 0 && <span className="bar micro-bar"><span style={{ width: `${(ok / n) * 100}%` }} /></span>}</div>
            </>
          );
          return n ? <a key={x.n} className="panel mt-part" href={`#/micro/a${x.n}`}>{body}</a> : <div key={x.n} className="panel mt-part micro-off">{body}</div>;
        })}
      </div>

      {!empty && (
        <div className="row">
          <a className="btn primary lg" href="#/micro/exam">{t(`Пробный экзамен: ${Math.min(EXAM_SIZE, all.length)} вопросов`, `Mock exam: ${Math.min(EXAM_SIZE, all.length)} questions`)}</a>
          {wrong > 0 && <a className="btn lg" href="#/micro/mistakes">{t(`Ошибки · ${wrong}`, `Mistakes · ${wrong}`)}</a>}
          {fresh > 0 && fresh < all.length && <a className="btn lg" href="#/micro/new">{t(`Ещё не решал · ${fresh}`, `Not tried yet · ${fresh}`)}</a>}
          <a className="btn lg" href="#/micro/cards">{t('Карточки', 'Cards')}</a>
        </div>
      )}
      {!empty && <p className="muted small micro-keys">{t('С клавиатуры: A–D или 1–4 — выбрать ответ, Enter — дальше.', 'Keyboard: A–D or 1–4 to answer, Enter for the next question.')}</p>}
    </div>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page narrow mt micro">
      <a className="back" href="#/micro">← {t('Микроэкономика', 'Microeconomics')}</a>
      <h1 className="serif h2">{title}</h1>
      {children}
    </div>
  );
}

/* ---------- one question at a time ---------- */

function MicroPart({ items, onFinish, start, onAt }: { items: MicroQ[]; onFinish: (r: Result & { missed: MicroQ[] }) => void; start?: number; onAt?: (i: number) => void }) {
  const { actions } = useCourseCtx();
  const [i, setI] = useAt(start, onAt);
  const [picked, setPicked] = useState<number | null>(null);
  const [shown, setShown] = useState(false);
  const [self, setSelf] = useState<boolean | null>(null);
  const [right, setRight] = useState(0);
  const [missed, setMissed] = useState<MicroQ[]>([]);
  const q = items[i];
  const choice = isChoice(q);
  const ok = choice ? picked === q.answer : self === true;
  const decided = choice ? picked !== null : self !== null;
  const box = useRef<HTMLDivElement>(null);
  // After an answer, bring the explanation and the Next button into view; a new question starts at the top.
  useEffect(() => { if (decided) box.current?.querySelector('.quiz-foot')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [decided]);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } box.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [i]);

  const pick = (k: number) => { if (picked !== null) return; setPicked(k); actions.markMicro(q.id, k === q.answer); };
  const grade = (g: boolean) => { setSelf(g); actions.markMicro(q.id, g); };
  const next = () => {
    const r = right + (ok ? 1 : 0), m = ok ? missed : [...missed, q];
    setRight(r); setMissed(m); setPicked(null); setShown(false); setSelf(null);
    if (i + 1 < items.length) setI(i + 1);
    else onFinish({ right: r, total: items.length, misses: m.map((x) => x.id.toUpperCase()), missed: m });
  };

  // A–D or 1–4 pick an option; Enter moves on (or shows the answer of an open question).
  const onKey = (e: KeyboardEvent) => {
    if (typing(e) || e.repeat) return;
    const k = /^Key[A-H]$/.test(e.code) ? e.code.charCodeAt(3) - 65 : /^(Digit|Numpad)[1-8]$/.test(e.code) ? Number(e.code.slice(-1)) - 1 : -1;
    if (choice && !decided && k >= 0 && k < q.options!.length) { e.preventDefault(); pick(k); return; }
    if (e.key !== 'Enter' || onButton()) return;
    if (decided) next(); else if (!choice && !shown) setShown(true);
  };
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="quiz" ref={box}>
      <Progress i={i} n={items.length} />
      <div className="q-prompt micro-q">
        <span className="small muted">{q.id.toUpperCase()}</span>
        <p className="micro-text">{q.q}</p>
        {q.ru && <p className="small muted">{q.ru}</p>}
      </div>
      {choice ? (
        <div className="opts micro-opts">
          {q.options!.map((o, k) => (
            <button key={k} className={`opt ${picked !== null ? (k === q.answer ? 'ok' : k === picked ? 'bad' : 'dim') : ''}`} disabled={picked !== null} onClick={() => pick(k)}>
              <b>{LETTERS[k]}.</b> {o}
            </button>
          ))}
        </div>
      ) : shown ? (
        <div className="panel micro-answer"><span className="small muted">{t('Ответ', 'Answer')}</span><p>{String(q.answer)}</p></div>
      ) : null}
      {(decided || shown) && q.explain && <p className="micro-explain small">{q.explain}</p>}
      <div className="quiz-foot">
        {decided ? <><span className={`verdict ${ok ? 'ok' : 'no'}`}>{ok ? t('Верно!', 'Correct!') : choice ? `${t('Ответ', 'Answer')}: ${answerText(q)}` : t('Повторим позже', 'We’ll come back to it')}</span>
          <button className="btn primary" onClick={next} autoFocus>{t('Дальше', 'Next')}</button></>
          : !choice && shown ? <div className="row"><button className="btn" onClick={() => grade(false)}>{t('Не знал', 'Didn’t know')}</button><button className="btn primary" onClick={() => grade(true)}>{t('Знал', 'Knew it')}</button></div>
          : !choice ? <button className="btn primary" onClick={() => setShown(true)}>{t('Показать ответ', 'Show the answer')}</button>
          : <span className="muted small">{t('Выбери ответ', 'Choose an answer')}</span>}
      </div>
    </div>
  );
}

/* ---------- flip cards ---------- */

function Flip() {
  const [from, setFrom] = useState(0); // 0 = every assignment
  const items = from ? ASSIGNMENTS.find((x) => x.n === from)?.questions ?? [] : ALL_MICRO();
  const [order, setOrder] = useState<MicroQ[]>(() => items);
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const choose = (n: number) => { setFrom(n); setOrder(n ? ASSIGNMENTS.find((x) => x.n === n)?.questions ?? [] : ALL_MICRO()); setI(0); setOpen(false); };
  const go = (d: number) => { if (!order.length) return; setOpen(false); setI((i + d + order.length) % order.length); };
  // ← → walk the cards, the space bar turns the card over.
  const onKey = (e: KeyboardEvent) => {
    if (typing(e)) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === ' ' && !document.activeElement?.classList.contains('micro-card')) { e.preventDefault(); setOpen(!open); }
  };
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const chips = (
    <div className="row micro-filter" role="group" aria-label={t('Какое задание', 'Which assignment')}>
      <button className={`chip ${from === 0 ? 'on' : ''}`} aria-pressed={from === 0} onClick={() => choose(0)}>{t('Все', 'All')}</button>
      {ASSIGNMENTS.filter((x) => x.questions.length).map((x) => (
        <button key={x.n} className={`chip ${from === x.n ? 'on' : ''}`} aria-pressed={from === x.n} title={x.chapters} onClick={() => choose(x.n)}>{t(`Задание ${x.n}`, `Assignment ${x.n}`)}</button>
      ))}
    </div>
  );
  if (!order.length) return <>{chips}<p className="muted">{t('Вопросы появятся, когда ты пришлёшь фото заданий.', 'The questions appear once you send the assignment photos.')}</p></>;
  const q = order[i];
  return (
    <div className="quiz">
      {chips}
      <Progress i={i} n={order.length} />
      <button className="panel micro-card" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="small muted">{q.id.toUpperCase()}</span>
        <p className="micro-text">{q.q}</p>
        {open ? <><p className="micro-answer-text">{answerText(q)}</p>{q.explain && <p className="small muted">{q.explain}</p>}</>
          : <span className="small muted">{t('Нажми, чтобы увидеть ответ', 'Tap to see the answer')}</span>}
      </button>
      <div className="quiz-foot">
        <button className="btn" onClick={() => go(-1)}>←</button>
        <button className="btn" onClick={() => { setOrder(shuffle(items)); setI(0); setOpen(false); }}>{t('Перемешать', 'Shuffle')}</button>
        <button className="btn primary" onClick={() => go(1)}>→</button>
      </div>
    </div>
  );
}
