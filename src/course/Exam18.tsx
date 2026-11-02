import { useState } from 'react';
import { EXAM_MEASURE, EXAM_QUESTIONS, EXAM_WORDS } from '../content/exam18';
import { Dialogues, Foot, Measure, PinyinTask, type Done, type Score } from './Paper';
import { WritePart, readLS, writeLS, type WriteWord } from './Write';
import { CharNotes } from './Notes';
import { Py, Say } from './ui';
import { t } from '../i18n';

/**
 * The 18 words the teacher named for the exam, studied as a list and then
 * practised in the five question types of the exam.
 */

const TYPES = [
  { key: 'hanzi', en: 'Write Chinese characters from Pinyin', ru: 'Напиши иероглифы по пиньиню' },
  { key: 'pinyin', en: 'Write Pinyin from Chinese characters', ru: 'Напиши пиньинь по иероглифам' },
  { key: 'make', en: 'Make sentences with given words', ru: 'Составь предложение с данным словом' },
  { key: 'answer', en: 'Answer the questions (in hanzi)', ru: 'Ответь на вопросы иероглифами' },
  { key: 'measure', en: 'Choose the correct measure word', ru: 'Выбери счётное слово' },
] as const;
type Key = (typeof TYPES)[number]['key'];
const best = (k: string) => `baikun-exam18-best-${k}`;

export default function Exam18({ sub }: { sub?: string }) {
  if (sub === 'all') return <Shell title={t('Все 5 типов подряд', 'All 5 types in a row')}><All /></Shell>;
  const type = TYPES.find((x) => x.key === sub);
  if (type) return <Shell title={`${TYPES.indexOf(type) + 1}. ${type.en}`}><Single k={type.key} /></Shell>;

  return (
    <div className="page mt">
      <a className="back" href="#/midterm">← {t('Мидтерм', 'Midterm')}</a>
      <span className="eyebrow">{t('考试 · 18 СЛОВ', '考试 · 18 WORDS')}</span>
      <h1 className="serif h1">{t('18 слов к экзамену', '18 words for the exam')}</h1>
      <p className="muted lead">{t('Слова со слайда, которые учительница назвала для экзамена, и пять типов заданий, как на экзамене. Сначала выучи список, потом тренируй каждый тип.', 'The words from the slide the teacher named for the exam, and the five question types of the exam. Learn the list first, then practise each type.')}</p>

      <div className="ex-types">
        {TYPES.map((x, k) => {
          const b = readLS(best(x.key));
          return (
            <a key={x.key} className="panel ex-type" href={`#/midterm/words18/${x.key}`}>
              <span className="paper-n">{k + 1}</span>
              <div><b>{x.en}</b><p className="small muted">{t(x.ru, x.en)}{b !== null ? ` · ${t('лучший', 'best')} ${b}%` : ''}</p></div>
            </a>
          );
        })}
      </div>
      <a className="btn primary lg" href="#/midterm/words18/all">{t('Все 5 типов подряд', 'All 5 types in a row')}</a>

      <h2 className="serif h2">{t('Список слов', 'The word list')}</h2>
      <div className="ex-words">
        {EXAM_WORDS.map((w) => (
          <details key={w.zh} className="panel ex-word">
            <summary>
              <span className="zh ex-zh">{w.zh}</span>
              <span className="ex-mid"><Py text={w.py} /><span className="small muted">{t(w.ru, w.en)}</span></span>
              <Say text={w.zh} />
            </summary>
            <ul className="examples">{w.examples.map((e) => <li key={e.zh}><div><span className="zh">{e.zh}</span> <Py text={e.py} /><div className="muted small">{t(e.ru, e.en)}</div></div><Say text={e.zh} /></li>)}</ul>
            <CharNotes zh={w.zh} />
          </details>
        ))}
      </div>
    </div>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="page narrow mt paper">
      <a className="back" href="#/midterm/words18">← {t('18 слов', '18 words')}</a>
      <h1 className="serif h2">{title}</h1>
      {children}
    </div>
  );
}

function Section({ k, onDone }: { k: Key; onDone: Done }) {
  const type = TYPES.find((x) => x.key === k)!;
  return (
    <>
      <p className="muted">{t(type.ru, type.en)}</p>
      {k === 'hanzi' && <HanziFromPinyin onDone={onDone} />}
      {k === 'pinyin' && <PinyinTask items={EXAM_WORDS} onDone={onDone} />}
      {k === 'make' && <MakeSentences onDone={onDone} />}
      {k === 'answer' && <Dialogues data={EXAM_QUESTIONS} onDone={onDone} />}
      {k === 'measure' && <Measure items={EXAM_MEASURE} onDone={onDone} />}
    </>
  );
}

const pct = (s: Score) => (s.max ? Math.round((s.got / s.max) * 100) : 0);
function save(k: string, s: Score) { if (pct(s) > Number(readLS(best(k)) ?? -1)) writeLS(best(k), String(pct(s))); }

function Single({ k }: { k: Key }) {
  const [round, setRound] = useState(0);
  const [res, setRes] = useState<Score | null>(null);
  if (res) {
    return (
      <div className="result">
        <div className={`result-num ${pct(res) < 80 ? 'bad' : ''}`}>{pct(res)}%</div>
        <p>{t(`Верно: ${res.got} из ${res.max}`, `Correct: ${res.got} of ${res.max}`)}</p>
        {res.misses.length > 0 && <div className="mt-misses"><span className="small muted">{t('Повтори', 'Review')}:</span> <span className="zh">{res.misses.join('　')}</span></div>}
        <div className="row center">
          <button className="btn primary" onClick={() => { setRes(null); setRound(round + 1); }}>{t('Ещё раз', 'Again')}</button>
          <a className="btn" href="#/midterm/words18">{t('К списку', 'Back to the list')}</a>
        </div>
      </div>
    );
  }
  return <div key={round}><Section k={k} onDone={(s) => { save(k, s); setRes(s); }} /></div>;
}

function All() {
  const [stage, setStage] = useState(0);
  const [scores, setScores] = useState<Score[]>([]);
  if (stage >= TYPES.length) {
    const got = scores.reduce((a, s) => a + s.got, 0), max = scores.reduce((a, s) => a + s.max, 0);
    const total = { got, max, misses: [] };
    return (
      <div className="result">
        <div className={`result-num ${pct(total) < 80 ? 'bad' : ''}`}>{pct(total)}%</div>
        <ul className="mt-score">{TYPES.map((x, k) => <li key={x.key}><span>{k + 1}. {x.en}</span><b>{scores[k].got}/{scores[k].max}</b></li>)}</ul>
        {scores.some((s) => s.misses.length) && <div className="mt-misses"><span className="small muted">{t('Повтори', 'Review')}:</span> <span className="zh">{[...new Set(scores.flatMap((s) => s.misses))].join('　')}</span></div>}
        <div className="row center"><a className="btn primary" href="#/midterm/words18">{t('К списку', 'Back to the list')}</a></div>
      </div>
    );
  }
  const type = TYPES[stage];
  return (
    <div key={stage}>
      <p className="hint">{t(`Часть ${stage + 1} из 5`, `Part ${stage + 1} of 5`)} · {type.en}</p>
      <Section k={type.key} onDone={(s) => { save(type.key, s); setScores([...scores, s]); setStage(stage + 1); window.scrollTo(0, 0); }} />
    </div>
  );
}

/* ---------- 1. characters from pinyin ---------- */

function HanziFromPinyin({ onDone }: { onDone: Done }) {
  const items: WriteWord[] = EXAM_WORDS.map((w) => ({ zh: w.zh, py: w.py, ru: w.ru, lesson: 0, tag: t('экзамен', 'exam') }));
  return <WritePart items={items} byPinyin onFinish={(r) => onDone({ got: r.right, max: r.total, misses: r.misses })} />;
}

/* ---------- 3. make a sentence with the word ---------- */

const HAN = /\p{Script=Han}/gu;

function MakeSentences({ onDone }: { onDone: Done }) {
  const [vals, setVals] = useState(() => EXAM_WORDS.map(() => ''));
  const [checked, setChecked] = useState(false);
  const [ok, setOk] = useState<boolean[]>([]);
  // A sentence counts when it uses the word and has a few more characters; the learner confirms it against the samples.
  const plausible = (k: number) => vals[k].includes(EXAM_WORDS[k].zh) && (vals[k].match(HAN) ?? []).length >= [...EXAM_WORDS[k].zh].length + 2;
  const check = () => { setOk(EXAM_WORDS.map((_, k) => plausible(k))); setChecked(true); };
  const score = { got: ok.filter(Boolean).length, max: EXAM_WORDS.length, misses: EXAM_WORDS.filter((_, k) => !ok[k]).map((w) => w.zh) };
  return (
    <>
      <p className="small muted mt-note">{t('Напиши предложение с каждым словом иероглифами (китайская клавиатура) — или на бумаге, оставив поле пустым. После проверки сравни с примерами и отметь, верно ли.', 'Write a sentence with each word in characters (Chinese keyboard) — or on paper, leaving the box empty. After checking, compare with the examples and mark whether it is right.')}</p>
      <ol className="paper-rows">
        {EXAM_WORDS.map((w, k) => (
          <li key={w.zh} className={checked ? (ok[k] ? 'ok' : 'bad') : ''}>
            <div className="pd-blank" style={{ border: 0, padding: 0 }}>
              <span className="zh ex-zh">{w.zh}</span>
              <input className="search zh" lang="zh-CN" value={vals[k]} disabled={checked} placeholder={t('предложение…', 'a sentence…')}
                onChange={(e) => setVals(vals.map((v, m) => (m === k ? e.target.value : v)))} />
            </div>
            {checked && (
              <div className="pd-sample small">
                {w.examples.map((e) => <div key={e.zh}><span className="zh">{e.zh}</span> <span className="muted">{e.py} · {t(e.ru, e.en)}</span></div>)}
                <label className="check"><input type="checkbox" checked={!!ok[k]} onChange={(e) => setOk(ok.map((v, m) => (m === k ? e.target.checked : v)))} /> {t('Моё предложение верное', 'My sentence is right')}</label>
              </div>
            )}
          </li>
        ))}
      </ol>
      <Foot checked={checked} onCheck={check} score={score} onDone={onDone} />
    </>
  );
}
