import { useMemo, useState } from 'react';
import type { Question } from './exercises';
import { isCorrect } from './exercises';
import { Py, Say, useCourseCtx } from './ui';
import type { Tone } from '../lib/pinyin';

/**
 * Runs a list of questions one at a time with instant feedback, then reports
 * the share answered right on the first try.
 */
export default function Quiz({ questions, onDone, doneLabel = 'Дальше' }: { questions: Question[]; onDone: (score: number) => void; doneLabel?: string }) {
  const { actions, state } = useCourseCtx();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [right, setRight] = useState(0);
  const [finished, setFinished] = useState(false);
  const q = questions[i];

  const correct = useMemo(() => {
    if (!checked || !q) return false;
    return q.kind === 'build' ? isCorrect(q, built.map((k) => q.tokens[k])) : isCorrect(q, picked ?? -1);
  }, [checked, q, picked, built]);

  if (!questions.length) return <p className="muted">Для этого шага в уроке нет материала.</p>;

  if (finished) {
    const pct = Math.round((right / questions.length) * 100);
    return (
      <div className="result">
        <div className="result-num">{pct}%</div>
        <p>Правильно с первого раза: {right} из {questions.length}</p>
        <button className="btn primary" onClick={() => onDone(pct)}>{doneLabel}</button>
      </div>
    );
  }

  const check = (pick?: number) => {
    if (checked) return;
    const p = pick ?? picked;
    if (q.kind !== 'build' && p === null) return;
    const ok = q.kind === 'build' ? isCorrect(q, built.map((k) => q.tokens[k])) : isCorrect(q, p as number);
    if (pick !== undefined) setPicked(pick);
    setChecked(true);
    if (ok) setRight((r) => r + 1);
    actions.answered(ok);
  };
  const next = () => {
    // Reset the answer state in the same update as the index, so the next
    // question never renders for a frame with the previous question's picks.
    setPicked(null); setBuilt([]); setChecked(false);
    if (i + 1 < questions.length) setI(i + 1); else setFinished(true);
  };
  const showPy = state.settings.showPinyin;

  return (
    <div className="quiz">
      <div className="quiz-top"><span className="muted small">{i + 1} / {questions.length}</span>
        <span className="bar"><span style={{ width: `${(i / questions.length) * 100}%` }} /></span></div>

      <div className="q-prompt" key={i}>
        {q.kind === 'pinyin' && <><p className="q-ask">Как читается?</p><div className="zh-xl">{q.zh}</div><p className="muted">{q.ru}</p></>}
        {q.kind === 'tone' && <><p className="q-ask">Послушай и выбери тоны</p><Say text={q.say} big auto={i} /><p className="q-bare">{q.bare}</p><p className="muted">{q.ru}</p></>}
        {q.kind === 'listen' && <><p className="q-ask">Что ты услышал?</p><Say text={q.say} big auto={i} />{checked && <><div className="zh-l">{q.zh}</div><Py text={q.py} /></>}</>}
        {q.kind === 'meaning' && <><p className="q-ask">Что значит?</p><div className="zh-xl">{q.zh}</div>{showPy && <Py text={q.py} />}<Say text={q.say} /></>}
        {q.kind === 'reverse' && <><p className="q-ask">Как сказать по-китайски?</p><div className="q-ru">{q.ru}</div></>}
        {q.kind === 'build' && <><p className="q-ask">Собери предложение</p><div className="q-ru">{q.ru}</div></>}
      </div>

      {q.kind === 'build' ? (
        <div className="build">
          <div className={`build-line ${checked ? (correct ? 'ok' : 'bad') : ''}`}>
            {built.length === 0 && <span className="muted small">Нажимай на слова по порядку</span>}
            {built.map((k, n) => <button key={n} className="tile on" disabled={checked} onClick={() => setBuilt(built.filter((_, m) => m !== n))}>{q.tokens[k]}</button>)}
          </div>
          <div className="build-bank">
            {q.tokens.map((t, k) => <button key={k} className="tile" disabled={checked || built.includes(k)} onClick={() => setBuilt([...built, k])}>{t}</button>)}
          </div>
          {checked && !correct && <p className="answer">Правильно: <b className="zh">{q.order.join(' ')}</b> · <Py text={q.py} /></p>}
          {checked && <Say text={q.say} label="Прослушать" />}
        </div>
      ) : (
        <div className={`opts ${q.kind === 'reverse' || q.kind === 'tone' ? 'opts-grid' : ''}`}>
          {q.options.map((o, k) => {
            const cls = checked ? (k === q.answer ? 'ok' : k === picked ? 'bad' : 'dim') : '';
            return (
              <button key={k} className={`opt ${cls}`} onClick={() => check(k)} disabled={checked}>
                {q.kind === 'tone' ? <ToneSeq t={o as Tone[]} /> :
                  q.kind === 'pinyin' ? <Py text={o as string} /> :
                  q.kind === 'reverse' ? <span className="opt-zh"><span className="zh">{o as string}</span>{checked && <Py text={q.optionsPy[k]} />}</span> :
                  <span>{o as string}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="quiz-foot">
        {checked ? (
          <>
            <span className={`verdict ${correct ? 'ok' : 'bad'}`}>{correct ? 'Верно!' : 'Не совсем'}</span>
            <button className="btn primary" onClick={next} autoFocus>Дальше</button>
          </>
        ) : q.kind === 'build' ? (
          <button className="btn primary" disabled={built.length !== q.tokens.length} onClick={() => check()}>Проверить</button>
        ) : <span className="muted small">Выбери ответ</span>}
      </div>
    </div>
  );
}

export function ToneSeq({ t }: { t: Tone[] }) {
  return <span className="toneseq">{t.map((x, i) => <span key={i} className={`tone-chip t${x}`}>{x === 5 ? '·' : x}</span>)}</span>;
}
