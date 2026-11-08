import { useState, type ReactNode } from 'react';
import { ALL_MICRO, ASSIGNMENTS, EXAM_SIZE, PER_ASSIGNMENT, type MicroQ } from '../content/micro';
import { shuffle } from './exercises';
import { useCourseCtx } from './ui';
import { Progress, Runner, readLS, useAt, writeLS, type Result } from './Write';
import { t } from '../i18n';

/**
 * Microeconomics: practise each of the four assignments (20 questions each),
 * a mock exam of 50 questions drawn from all 80, the questions last missed,
 * and flip cards. The last result of every question is kept on this device.
 */

const LS = 'baikun-micro';
type Marks = Record<string, 0 | 1>;
const readMarks = (): Marks => { try { return JSON.parse(readLS(LS) ?? '{}') as Marks; } catch { return {}; } };
const mark = (id: string, ok: boolean) => writeLS(LS, JSON.stringify({ ...readMarks(), [id]: ok ? 1 : 0 }));

const LETTERS = 'ABCDEFGH';
const isChoice = (q: MicroQ) => !!q.options?.length;
const answerText = (q: MicroQ) => (isChoice(q) ? `${LETTERS[q.answer as number]}. ${q.options![q.answer as number]}` : String(q.answer));

export default function Micro({ part }: { part?: string }) {
  const all = ALL_MICRO();
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
  if (part === 'mistakes') return run(t('Мои ошибки', 'My mistakes'), () => { const m = readMarks(); return shuffle(all.filter((q) => m[q.id] === 0)); });
  if (part === 'cards') return <Shell title={t('Карточки: вопрос → ответ', 'Cards: question → answer')}><Flip items={all} /></Shell>;

  const m = readMarks();
  const known = all.filter((q) => m[q.id] === 1).length;
  const wrong = all.filter((q) => m[q.id] === 0).length;
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
          <div className="stat"><b>{all.length - known - wrong}</b><span>{t('ещё не решал', 'not tried yet')}</span></div>
        </section>
      )}

      <div className="mt-parts">
        {ASSIGNMENTS.map((x) => {
          const n = x.questions.length;
          const ok = x.questions.filter((q) => m[q.id] === 1).length;
          const body = (
            <>
              <span className="mt-zh">{x.n}</span>
              <div><h3>{x.title}</h3>
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
          <a className="btn lg" href="#/micro/cards">{t('Карточки', 'Cards')}</a>
        </div>
      )}
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

  const pick = (k: number) => { if (picked !== null) return; setPicked(k); mark(q.id, k === q.answer); actions.answered(k === q.answer); };
  const grade = (g: boolean) => { setSelf(g); mark(q.id, g); actions.answered(g); };
  const next = () => {
    const r = right + (ok ? 1 : 0), m = ok ? missed : [...missed, q];
    setRight(r); setMissed(m); setPicked(null); setShown(false); setSelf(null);
    if (i + 1 < items.length) setI(i + 1);
    else onFinish({ right: r, total: items.length, misses: m.map((x) => x.id.toUpperCase()), missed: m });
  };

  return (
    <div className="quiz">
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

function Flip({ items }: { items: MicroQ[] }) {
  const [order, setOrder] = useState(() => items);
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  if (!order.length) return <p className="muted">{t('Вопросы появятся, когда ты пришлёшь фото заданий.', 'The questions appear once you send the assignment photos.')}</p>;
  const q = order[i];
  const go = (d: number) => { setOpen(false); setI((i + d + order.length) % order.length); };
  return (
    <div className="quiz">
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
