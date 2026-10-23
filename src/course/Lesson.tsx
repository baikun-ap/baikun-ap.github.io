import { useEffect, useMemo, useState } from 'react';
import type { Lesson as L } from '../content/schema';
import { LESSON_BY_ID, STEPS, bookOf, nextLesson } from './data';
import { buildSet, listenSet, pinyinSet, sentencesOf, testSet, toneSet, shuffle } from './exercises';
import Quiz from './Quiz';
import { Py, Say, StrokeBox, VoiceWarning, go, useCourseCtx } from './ui';
import { listen, listenSupported, scoreSpeech, hanOnly, type Match } from './listen';
import CardReview from './CardReview';
import { cardIdOf, dueCards } from './store';

export default function Lesson({ id, step }: { id: string; step: number }) {
  const lesson = LESSON_BY_ID.get(id);
  const { state, actions } = useCourseCtx();
  const s = Math.min(8, Math.max(1, step || 1));
  useEffect(() => { if (lesson) actions.visit(lesson.id, s); }, [lesson, s, actions]);
  if (!lesson) return <div className="page"><p>Урок не найден.</p><a className="btn" href="#/course">К курсу</a></div>;

  const prog = state.lessons[lesson.id];
  const done = new Set(prog?.steps ?? []);
  const finish = (score?: number) => {
    actions.completeStep(lesson.id, s, score);
    if (s < 8) go(`lesson/${lesson.id}/${s + 1}`);
  };

  return (
    <div className="page lesson">
      <header className="lesson-head">
        <a className="back" href="#/course">← {bookOf(lesson).title}</a>
        <div className="lesson-title">
          <span className="lesson-n">Урок {lesson.n}</span>
          <h1><span className="zh">{lesson.titleZh}</span> <span className="serif">{lesson.title}</span></h1>
          <p className="muted">{lesson.goal}</p>
        </div>
        <nav className="steps" aria-label="Шаги урока">
          {STEPS.map((st) => (
            <a key={st.n} href={`#/lesson/${lesson.id}/${st.n}`} className={`step ${st.n === s ? 'cur' : ''} ${done.has(st.n) ? 'done' : ''}`}
              aria-current={st.n === s ? 'step' : undefined}>
              <span className="step-zh">{done.has(st.n) && st.n !== s ? '✓' : st.zh}</span>
              <span className="step-t">{st.short}</span>
            </a>
          ))}
        </nav>
      </header>

      <section className="panel step-body" key={`${lesson.id}-${s}`}>
        <h2 className="step-h"><span className="step-num">{s}</span>{STEPS[s - 1].title}</h2>
        {s === 1 && <HanziStep lesson={lesson} onDone={() => finish()} />}
        {s === 2 && <><p className="hint">Пиньинь — латинская запись звуков. Знак над гласной показывает тон.</p><QuizStep make={() => pinyinSet(lesson)} onDone={finish} /></>}
        {s === 3 && <><VoiceWarning /><p className="hint">1 — ровный высокий, 2 — восходящий, 3 — вниз-вверх, 4 — резко вниз, · — нейтральный.</p><QuizStep make={() => toneSet(lesson)} onDone={finish} /></>}
        {s === 4 && <><VoiceWarning /><QuizStep make={() => listenSet(lesson)} onDone={finish} /><Dialogue lesson={lesson} /></>}
        {s === 5 && <SpeakStep lesson={lesson} onDone={finish} />}
        {s === 6 && <GrammarStep lesson={lesson} onDone={finish} />}
        {s === 7 && <QuizStep make={() => testSet(lesson)} onDone={(p) => finish(p)} label="Завершить тест" test />}
        {s === 8 && <CardsStep lesson={lesson} />}
      </section>
    </div>
  );
}

function QuizStep({ make, onDone, label, test }: { make: () => ReturnType<typeof pinyinSet>; onDone: (p: number) => void; label?: string; test?: boolean }) {
  const [round, setRound] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const qs = useMemo(make, [round]);
  const [score, setScore] = useState<number | null>(null);
  if (test && score !== null && score < 80) {
    return (
      <div className="result">
        <div className="result-num bad">{score}%</div>
        <p>Для зачёта нужно 80%. Повтори слова и попробуй ещё раз — вопросы будут другие.</p>
        <div className="row"><button className="btn primary" onClick={() => { setScore(null); setRound(round + 1); }}>Пройти заново</button>
          <button className="btn" onClick={() => onDone(score)}>Всё равно дальше</button></div>
      </div>
    );
  }
  return <Quiz key={round} questions={qs} onDone={(p) => (test && p < 80 ? setScore(p) : onDone(p))} doneLabel={label} />;
}

/* ---------- 1. characters ---------- */

function HanziStep({ lesson, onDone }: { lesson: L; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [write, setWrite] = useState(false);
  const w = lesson.words[i];
  const chars = [...hanOnly(w.zh)];
  const [ci, setCi] = useState(0);
  const goTo = (n: number) => { setI(n); setCi(0); setWrite(false); };
  const ch = chars[Math.min(ci, chars.length - 1)];
  return (
    <div className="hz-step">
      <div className="hz-card">
        <div className="hz-main">
          <div className="zh-xxl">{w.zh}</div>
          <Py text={w.py} className="py-l" />
          <p className="hz-ru">{w.ru}{w.note && <span className="muted"> · {w.note}</span>}</p>
          <Say text={w.zh} big auto={i} />
        </div>
        <div className="hz-stroke">
          {chars.length > 1 && <div className="row center">{chars.map((c, k) => <button key={k} className={`chip zh ${k === ci ? 'on' : ''}`} onClick={() => setCi(k)}>{c}</button>)}</div>}
          <StrokeBox char={ch} size={190} mode={write ? 'quiz' : 'animate'} key={`${ch}-${write}`} />
          <button className="chip" onClick={() => setWrite(!write)}>{write ? 'Смотреть порядок' : '✍ Написать самому'}</button>
        </div>
      </div>
      <div className="dots" aria-hidden="true">{lesson.words.map((_, k) => <span key={k} className={k === i ? 'on' : k < i ? 'past' : ''} />)}</div>
      <div className="row between">
        <button className="btn" disabled={i === 0} onClick={() => goTo(i - 1)}>← Назад</button>
        <span className="muted small">{i + 1} из {lesson.words.length}</span>
        {i + 1 < lesson.words.length ? <button className="btn primary" onClick={() => goTo(i + 1)}>Дальше →</button>
          : <button className="btn primary" onClick={onDone}>Готово</button>}
      </div>
      <details className="all-words"><summary>Все слова урока</summary>
        <ul className="wordlist">{lesson.words.map((x) => <li key={x.zh}><span className="zh">{x.zh}</span><Py text={x.py} /><span>{x.ru}</span><Say text={x.zh} /></li>)}</ul>
      </details>
    </div>
  );
}

/* ---------- 4. dialogue ---------- */

function Dialogue({ lesson }: { lesson: L }) {
  if (!lesson.dialogue.length) return null;
  return (
    <div className="dialogue">
      <h3>Диалог урока</h3>
      {lesson.dialogue.map((d, k) => (
        <div key={k} className={`line ${d.who === lesson.dialogue[0].who ? 'a' : 'b'}`}>
          <span className="who">{d.who}</span>
          <div><div className="zh">{d.zh}</div><Py text={d.py} /><div className="muted small">{d.ru}</div></div>
          <Say text={d.zh} />
        </div>
      ))}
    </div>
  );
}

/* ---------- 5. speaking ---------- */

function SpeakStep({ lesson, onDone }: { lesson: L; onDone: (p: number) => void }) {
  const { actions } = useCourseCtx();
  const items = useMemo(() => {
    const words = shuffle(lesson.words.filter((w) => hanOnly(w.zh).length >= 2)).slice(0, 4);
    const lines = shuffle(sentencesOf(lesson)).slice(0, 2);
    return [...words, ...lines].map((x) => ({ zh: x.zh, py: x.py, ru: x.ru }));
  }, [lesson]);
  const [i, setI] = useState(0);
  const [rec, setRec] = useState(false);
  const [interim, setInterim] = useState('');
  const [res, setRes] = useState<Match | null>(null);
  const [err, setErr] = useState('');
  const [scores, setScores] = useState<number[]>([]);
  const it = items[i];

  const start = () => {
    setErr(''); setRes(null); setInterim(''); setRec(true);
    listen({
      onInterim: setInterim,
      onFinal: (alts) => { if (alts.length) { const m = scoreSpeech(it.zh, alts); setRes(m); actions.answered(m.score >= 0.8); } },
      onError: setErr,
      onEnd: () => setRec(false),
    });
  };
  const next = (score: number) => {
    const all = [...scores, score];
    setScores(all);
    setRes(null); setErr(''); setInterim('');
    if (i + 1 < items.length) setI(i + 1);
    else onDone(Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 100));
  };
  if (!it) return <p className="muted">Нет материала для говорения.</p>;

  return (
    <div className="speak">
      {!listenSupported && <p className="warn">Этот браузер не распознаёт речь. Открой сайт в Safari (iPhone) или Chrome. Пока можно оценивать себя самому.</p>}
      <p className="hint">Послушай, потом нажми на микрофон и скажи вслух. Сайт сравнит каждый иероглиф.</p>
      <div className="speak-card">
        <div className="muted small">{i + 1} / {items.length}</div>
        <div className="zh-l speak-zh">
          {(() => {
            let han = -1;
            return [...it.zh].map((c, k) => {
              const isHan = /\p{Script=Han}/u.test(c);
              if (isHan) han += 1;
              const mark = res && isHan ? res.marks[han] : '';
              return <span key={k} className={`m-${mark}`}>{c}</span>;
            });
          })()}
        </div>
        <Py text={it.py} className="py-l" />
        <p className="muted">{it.ru}</p>
        <div className="row center">
          <Say text={it.zh} label="Образец" />
          <button className={`mic ${rec ? 'rec' : ''}`} onClick={start} disabled={rec || !listenSupported} aria-label="Говорить">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            {rec ? 'Слушаю…' : 'Сказать'}
          </button>
        </div>
        {rec && interim && <p className="heard">{interim}</p>}
        {err && <p className="warn">{err}</p>}
        {res && (
          <div className={`speak-res ${res.score >= 0.8 ? 'ok' : res.score >= 0.5 ? 'mid' : 'bad'}`}>
            <b>{Math.round(res.score * 100)}%</b>
            <span>{res.score >= 0.8 ? 'Отлично, тебя поняли!' : res.score >= 0.5 ? 'Почти. Послушай образец и повтори.' : 'Пока непохоже — попробуй ещё раз, медленнее.'}</span>
            <span className="muted small">Распознано: <span className="zh">{res.heard || '—'}</span></span>
          </div>
        )}
      </div>
      <div className="row between">
        {listenSupported ? <button className="btn" onClick={() => next(0)}>Пропустить</button>
          : <button className="btn" onClick={() => next(0.5)}>Сказал(а) не очень</button>}
        {listenSupported ? <button className="btn primary" disabled={!res} onClick={() => next(res?.score ?? 0)}>Дальше →</button>
          : <button className="btn primary" onClick={() => next(1)}>Сказал(а) хорошо</button>}
      </div>
    </div>
  );
}

/* ---------- 6. grammar ---------- */

export function GrammarCard({ g }: { g: L['grammar'][number] }) {
  return (
    <article className="gram">
      <h3>{g.title}</h3>
      <div className="formula">{g.formula}</div>
      <p>{g.explain}</p>
      <ul className="examples">{g.examples.map((e, k) => (
        <li key={k}><div><span className="zh">{e.zh.join('')}</span> <Py text={e.py} /><div className="muted small">{e.ru}</div></div><Say text={e.zh.join('')} /></li>
      ))}</ul>
      {g.pitfall && <div className="pitfall"><div><s className="zh">{g.pitfall.wrong}</s> → <b className="zh">{g.pitfall.right}</b></div><div className="small muted">{g.pitfall.why}</div></div>}
    </article>
  );
}

function GrammarStep({ lesson, onDone }: { lesson: L; onDone: (p: number) => void }) {
  const [practice, setPractice] = useState(false);
  const qs = useMemo(() => buildSet(lesson, 3), [lesson]);
  if (practice) return <Quiz questions={qs} onDone={onDone} />;
  return (
    <div>
      {lesson.grammar.map((g) => <GrammarCard key={g.id} g={g} />)}
      <div className="row end"><button className="btn primary" onClick={() => (qs.length ? setPractice(true) : onDone(100))}>Практика: собери фразы →</button></div>
    </div>
  );
}

/* ---------- 8. cards ---------- */

function CardsStep({ lesson }: { lesson: L }) {
  const { state, actions } = useCourseCtx();
  useEffect(() => { actions.addCards(lesson.words, lesson.id); }, [lesson, actions]);
  const ids = lesson.words.map((w) => cardIdOf(w.zh));
  const due = dueCards(state.cards).filter((c) => ids.includes(c.id));
  const added = ids.every((id) => state.cards[id]);
  const nl = nextLesson(lesson.id);
  // The lesson counts as finished once its new cards have had their first review.
  useEffect(() => { if (added && !due.length) actions.completeStep(lesson.id, 8); }, [added, due.length, lesson.id, actions]);
  return (
    <div>
      <p className="hint">Все {lesson.words.length} слов урока добавлены в твою колоду. Карточки будут возвращаться по графику: трудные — чаще, лёгкие — реже.</p>
      {due.length ? <CardReview cards={due} /> : (
        <div className="result">
          <div className="result-num">✓</div>
          <p>Урок пройден! Новые карточки появятся в разделе «Карточки» в нужный день.</p>
          <div className="row center">
            <a className="btn" href="#/course">К курсу</a>
            {nl ? <a className="btn primary" href={`#/lesson/${nl.id}/1`}>Следующий урок →</a> : <a className="btn primary" href="#/cards">К карточкам</a>}
          </div>
        </div>
      )}
    </div>
  );
}
