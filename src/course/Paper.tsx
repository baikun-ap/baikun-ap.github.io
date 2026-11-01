import { useMemo, useState } from 'react';
import {
  MEASURE_GLOSS, PAPER_BANK, PAPER_DIALOGUES, PAPER_FILL, PAPER_MEASURE, PAPER_MEASURE_BANK, PAPER_PINYIN, SLIDE_WORDS, type DialogueBlank,
} from '../content/midterm-paper';
import { LESSONS, WORD_BY_ZH } from './data';
import { autoMark, checkPinyin, retone, shuffle, tonesOf } from './exercises';
import { Py, Say, useCourseCtx } from './ui';
import { Runner, WritePart, readLS, writeLS, type WriteWord } from './Write';
import { L, t } from '../i18n';
import type { Tone } from '../lib/pinyin';

/**
 * The teacher's practice test, section by section in the paper's own format
 * and points, plus the "Write the correct 汉字" slide.
 */

interface Score { got: number; max: number; misses: string[] }
type Done = (s: Score) => void;

const SECTIONS = [
  { key: 'listen', n: '一', zh: '听录音，选择正确的拼音', ru: 'Послушай и выбери правильный пиньинь', en: 'Listen and choose the right pinyin', pts: 20, note: ['Первую страницу ты не сфотографировал — задание собрано сайтом в том же формате.', 'The first page was not photographed — this part is generated in the same format.'] },
  { key: 'pinyin', n: '三', zh: '看汉字，写拼音', ru: 'Посмотри на иероглифы и напиши пиньинь', en: 'Write pinyin according to the Hanzi', pts: 20 },
  { key: 'fill', n: '四', zh: '用正确的词语填空', ru: 'Вставь правильное слово', en: 'Choose the correct words to complete the sentences', pts: 20 },
  { key: 'dialog', n: '五', zh: '对话题', ru: 'Допиши диалог', en: 'Complete the dialogue', pts: 30 },
  { key: 'measure', n: '六', zh: '填量词', ru: 'Вставь счётное слово', en: 'Choose the right measure word', pts: 10 },
] as const;
type Key = (typeof SECTIONS)[number]['key'];

const bestKey = (k: string) => `baikun-paper-best-${k}`;
const pctOf = (s: Score) => (s.max ? Math.round((s.got / s.max) * 100) : 0);

/* ---------- page ---------- */

export default function Paper({ sub }: { sub?: string }) {
  if (sub === 'all') return <Shell title={t('Весь тест подряд', 'The whole test')}><All /></Shell>;
  const sec = SECTIONS.find((s) => s.key === sub);
  if (sec) return <Shell title={`${sec.n}、${sec.zh}`}><Single k={sec.key} /></Shell>;

  return (
    <div className="page mt">
      <a className="back" href="#/midterm">← {t('Мидтерм', 'Midterm')}</a>
      <span className="eyebrow">{t('《初级汉语》 试卷', '《初级汉语》 试卷')}</span>
      <h1 className="serif h1">{t('Тест как у преподавателя', 'The teacher’s practice test')}</h1>
      <p className="muted lead">{t('Те же задания и слова, что на листах теста: пиньинь по иероглифам, слово из списка, диалоги и счётные слова. Баллы — как на бумаге, всего 100.', 'The same tasks and words as the printed test: pinyin for characters, words from a list, dialogues and measure words. Points as on paper, 100 in total.')}</p>
      <div className="paper-list">
        {SECTIONS.map((s) => {
          const best = readLS(bestKey(s.key));
          return (
            <a key={s.key} className="panel paper-sec" href={`#/midterm/paper/${s.key}`}>
              <span className="paper-n zh">{s.n}</span>
              <div>
                <h3 className="zh">{s.zh}</h3>
                <p className="small muted">{t(s.ru, s.en)} · {s.pts} {t('баллов', 'points')}{best !== null ? ` · ${t('лучший результат', 'best')} ${best}%` : ''}</p>
              </div>
            </a>
          );
        })}
      </div>
      <div className="row">
        <a className="btn primary lg" href="#/midterm/paper/all">{t('Пройти весь тест (100 баллов)', 'Take the whole test (100 points)')}</a>
        <a className="btn lg" href="#/midterm/slide">{t('✍ Write the correct 汉字 (слайд)', '✍ Write the correct 汉字 (slide)')}</a>
      </div>
    </div>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="page narrow mt paper">
      <a className="back" href="#/midterm/paper">← {t('Тест', 'Test')}</a>
      <h1 className="serif h2 zh-title">{title}</h1>
      {children}
    </div>
  );
}

function Section({ k, onDone }: { k: Key; onDone: Done }) {
  const sec = SECTIONS.find((s) => s.key === k)!;
  return (
    <>
      <p className="muted">{t(sec.ru, sec.en)} · {sec.pts} {t('баллов', 'points')}</p>
      {'note' in sec && <p className="small muted mt-note">{t(sec.note[0], sec.note[1])}</p>}
      {k === 'listen' && <Listen onDone={onDone} />}
      {k === 'pinyin' && <PinyinTask onDone={onDone} />}
      {k === 'fill' && <Fill onDone={onDone} />}
      {k === 'dialog' && <Dialogues onDone={onDone} />}
      {k === 'measure' && <Measure onDone={onDone} />}
    </>
  );
}

function Single({ k }: { k: Key }) {
  const [round, setRound] = useState(0);
  const [res, setRes] = useState<Score | null>(null);
  const pts = SECTIONS.find((s) => s.key === k)!.pts;
  if (res) {
    const pct = pctOf(res);
    return (
      <div className="result">
        <div className={`result-num ${pct < 80 ? 'bad' : ''}`}>{Math.round((res.got / res.max) * pts)}/{pts}</div>
        <p>{t(`Верно: ${res.got} из ${res.max}`, `Correct: ${res.got} of ${res.max}`)}</p>
        {res.misses.length > 0 && <div className="mt-misses"><span className="small muted">{t('Ошибки', 'Mistakes')}:</span> <span className="zh">{res.misses.join('　')}</span></div>}
        <div className="row center">
          <button className="btn primary" onClick={() => { setRes(null); setRound(round + 1); }}>{t('Ещё раз', 'Again')}</button>
          <a className="btn" href="#/midterm/paper">{t('К тесту', 'Back to the test')}</a>
        </div>
      </div>
    );
  }
  return <div key={round}><Section k={k} onDone={(s) => { saveBest(k, s); setRes(s); }} /></div>;
}

function saveBest(k: string, s: Score) {
  const prev = Number(readLS(bestKey(k)) ?? -1);
  if (pctOf(s) > prev) writeLS(bestKey(k), String(pctOf(s)));
}

function All() {
  const [stage, setStage] = useState(0);
  const [scores, setScores] = useState<Score[]>([]);
  if (stage >= SECTIONS.length) {
    const pts = scores.map((s, k) => (s.got / s.max) * SECTIONS[k].pts);
    const total = Math.round(pts.reduce((a, b) => a + b, 0));
    return (
      <div className="result">
        <div className={`result-num ${total < 80 ? 'bad' : ''}`}>{total}/100</div>
        <ul className="mt-score">{SECTIONS.map((s, k) => <li key={s.key}><span><span className="zh">{s.n}</span> {t(s.ru, s.en)}</span><b>{Math.round(pts[k])}/{s.pts}</b></li>)}</ul>
        {scores.some((s) => s.misses.length) && <div className="mt-misses"><span className="small muted">{t('Ошибки', 'Mistakes')}:</span> <span className="zh">{scores.flatMap((s) => s.misses).join('　')}</span></div>}
        <div className="row center"><a className="btn primary" href="#/midterm/paper">{t('К тесту', 'Back to the test')}</a></div>
      </div>
    );
  }
  const sec = SECTIONS[stage];
  return (
    <div key={stage}>
      <p className="hint">{t(`Часть ${stage + 1} из ${SECTIONS.length}`, `Part ${stage + 1} of ${SECTIONS.length}`)} · <span className="zh">{sec.n}、{sec.zh}</span></p>
      <Section k={sec.key} onDone={(s) => { saveBest(sec.key, s); setScores([...scores, s]); setStage(stage + 1); window.scrollTo(0, 0); }} />
    </div>
  );
}

/** The check button, then the score line and a button to go on. */
function Foot({ checked, onCheck, score, onDone, ready = true }: { checked: boolean; onCheck: () => void; score: Score; onDone: Done; ready?: boolean }) {
  const { actions } = useCourseCtx();
  return (
    <div className="quiz-foot">
      {checked ? (
        <>
          <span className={`verdict ${pctOf(score) >= 80 ? 'ok' : 'bad'}`}>{t(`Верно ${score.got} из ${score.max}`, `${score.got} of ${score.max} correct`)}</span>
          <button className="btn primary" onClick={() => { actions.answered(pctOf(score) >= 80); onDone(score); }}>{t('Готово', 'Done')}</button>
        </>
      ) : <button className="btn primary" disabled={!ready} onClick={onCheck}>{t('Проверить', 'Check')}</button>}
    </div>
  );
}

/* ---------- 一 listening ---------- */

function Listen({ onDone }: { onDone: Done }) {
  const items = useMemo(() => {
    const pool = LESSONS.filter((l) => l.book === 'jc1a' && l.n <= 8).flatMap((l) => l.words).filter((w) => !w.zh.includes('…') && w.py.split(/\s+/).length <= 2);
    return shuffle(pool).slice(0, 10).map((w) => {
      const tones = tonesOf(w.py);
      const at = Math.floor(Math.random() * tones.length);
      const other = ([1, 2, 3, 4] as Tone[]).filter((x) => x !== tones[at]);
      const wrong = retone(w.py, at, other[Math.floor(Math.random() * other.length)]);
      const opts = shuffle([w.py, wrong]);
      return { w, opts, a: opts.indexOf(w.py) };
    });
  }, []);
  const [pick, setPick] = useState<(number | null)[]>(() => items.map(() => null));
  const [checked, setChecked] = useState(false);
  const right = items.filter((it, k) => pick[k] === it.a).length;
  const score = { got: right, max: items.length, misses: items.filter((it, k) => pick[k] !== it.a).map((it) => it.w.zh) };
  return (
    <>
      <ol className="paper-rows">
        {items.map((it, k) => (
          <li key={k} className={checked ? (pick[k] === it.a ? 'ok' : 'bad') : ''}>
            <Say text={it.w.zh} />
            <div className="paper-ab">
              {it.opts.map((o, j) => (
                <button key={j} className={`opt ${pick[k] === j ? 'picked' : ''} ${checked && j === it.a ? 'ok' : ''}`} disabled={checked}
                  onClick={() => setPick(pick.map((p, m) => (m === k ? j : p)))}><b>{'AB'[j]}.</b> <Py text={o} /></button>
              ))}
            </div>
            {checked && <span className="paper-ans zh">{it.w.zh} <span className="small muted">{L(it.w.ru)}</span></span>}
          </li>
        ))}
      </ol>
      <Foot checked={checked} onCheck={() => setChecked(true)} score={score} onDone={onDone} ready={pick.every((p) => p !== null)} />
    </>
  );
}

/* ---------- 三 pinyin for characters ---------- */

function PinyinTask({ onDone }: { onDone: Done }) {
  const [vals, setVals] = useState(() => PAPER_PINYIN.map(() => ''));
  const [active, setActive] = useState(0);
  const [checked, setChecked] = useState(false);
  const res = PAPER_PINYIN.map((x, k) => checkPinyin(vals[k], x.py));
  const set = (k: number, v: string) => setVals(vals.map((x, m) => (m === k ? autoMark(v) : x)));
  const score = { got: res.filter((r) => r === 'ok').length, max: PAPER_PINYIN.length, misses: PAPER_PINYIN.filter((_, k) => res[k] !== 'ok').map((x) => x.zh) };
  return (
    <>
      <div className="paper-grid">
        {PAPER_PINYIN.map((x, k) => (
          <label key={x.zh} className={`paper-py ${checked ? (res[k] === 'ok' ? 'ok' : 'bad') : ''}`}>
            <input className="search" value={vals[k]} disabled={checked} onFocus={() => setActive(k)} onChange={(e) => set(k, e.target.value)}
              autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} placeholder="(        )" />
            <span className="zh paper-zh">{x.zh}</span>
            {checked && res[k] !== 'ok' && <Py text={x.py} />}
          </label>
        ))}
      </div>
      {!checked && (
        <div className="mt-tones paper-tones">
          {[1, 2, 3, 4].map((n) => <button key={n} type="button" className={`tone-key t${n}`} onMouseDown={(e) => e.preventDefault()} onClick={() => set(active, vals[active].replace(/\s+$/, '') + n)}>{['', 'ā', 'á', 'ǎ', 'à'][n]}</button>)}
          <span className="small muted">{t('Тон цифрой после слога: qu3 → qǔ. Кнопки ставят тон в поле, где курсор.', 'Tone number after a syllable: qu3 → qǔ. The buttons add a tone to the focused box.')}</span>
        </div>
      )}
      <Foot checked={checked} onCheck={() => setChecked(true)} score={score} onDone={onDone} />
    </>
  );
}

/* ---------- 四 words from the box ---------- */

function Fill({ onDone }: { onDone: Done }) {
  const [vals, setVals] = useState(() => PAPER_FILL.map(() => ''));
  const [checked, setChecked] = useState(false);
  const word = (k: string) => PAPER_BANK.find((b) => b.k === k);
  const score = { got: PAPER_FILL.filter((f, k) => vals[k] === f.a).length, max: PAPER_FILL.length, misses: PAPER_FILL.filter((f, k) => vals[k] !== f.a).map((f) => f.zh.replace('__', word(f.a)!.zh)) };
  return (
    <>
      <div className="paper-bank">{PAPER_BANK.map((b) => <span key={b.k}><b>{b.k}</b> <span className="zh">{b.zh}</span></span>)}</div>
      <ol className="paper-rows">
        {PAPER_FILL.map((f, k) => {
          const [before, after] = f.zh.split('__');
          const ok = vals[k] === f.a;
          return (
            <li key={k} className={checked ? (ok ? 'ok' : 'bad') : ''}>
              <div className="zh paper-sent">{before}
                <select className="paper-sel" value={vals[k]} disabled={checked} onChange={(e) => setVals(vals.map((v, m) => (m === k ? e.target.value : v)))}>
                  <option value="">＿＿</option>{PAPER_BANK.map((b) => <option key={b.k} value={b.k}>{b.k} {b.zh}</option>)}
                </select>{after}</div>
              {checked && <div className="small muted">{!ok && <><b>{f.a} <span className="zh">{word(f.a)!.zh}</span></b> · </>}{t(f.ru, f.en)}</div>}
            </li>
          );
        })}
      </ol>
      <Foot checked={checked} onCheck={() => setChecked(true)} score={score} onDone={onDone} />
    </>
  );
}

/* ---------- 五 dialogues ---------- */

const clean = (s: string) => s.replace(/[\s，。！？、,.!?；;：:“”"'（）()…]/g, '');
const matchBlank = (b: DialogueBlank, v: string) => !!clean(v) && b.ok.some((p) => new RegExp(p, 'u').test(clean(v)));

function Dialogues({ onDone }: { onDone: Done }) {
  const blanks = useMemo(() => PAPER_DIALOGUES.flatMap((d, i) => d.map((l, j) => (l.blank ? `${i}-${j}` : null)).filter(Boolean) as string[]), []);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [own, setOwn] = useState<Record<string, boolean>>({});   // "my answer is right too"
  const [checked, setChecked] = useState(false);
  const isOk = (id: string, b: DialogueBlank) => own[id] || matchBlank(b, vals[id] ?? '');
  const okCount = blanks.filter((id) => { const [i, j] = id.split('-').map(Number); return isOk(id, PAPER_DIALOGUES[i][j].blank!); }).length;
  const score = { got: okCount, max: blanks.length, misses: blanks.filter((id) => { const [i, j] = id.split('-').map(Number); return !isOk(id, PAPER_DIALOGUES[i][j].blank!); }).map((id) => PAPER_DIALOGUES[Number(id.split('-')[0])][Number(id.split('-')[1])].blank!.sample[0].zh) };
  return (
    <>
      <p className="small muted mt-note">{t('Печатай по-китайски (клавиатура iPhone: Настройки → Основные → Клавиатура → Клавиатуры → Новые → Китайский упрощ. → Пиньинь) или пиши на бумаге и оставь поле пустым — после проверки сравни с образцом и отметь сам.', 'Type in Chinese (iPhone: Settings → General → Keyboard → Keyboards → Add → Chinese Simplified → Pinyin) or write on paper and leave the box empty — after checking, compare with the sample and mark it yourself.')}</p>
      <ol className="paper-rows paper-dialogs">
        {PAPER_DIALOGUES.map((d, i) => (
          <li key={i}>
            {d.map((l, j) => {
              const id = `${i}-${j}`;
              if (!l.blank) return <div key={j} className="pd-line"><b>{l.who}：</b><span className="zh">{l.zh}</span> {l.py && <span className="small muted">（{l.py}）</span>}</div>;
              const ok = checked && isOk(id, l.blank);
              return (
                <div key={j} className={`pd-line pd-blank ${checked ? (ok ? 'ok' : 'bad') : ''}`}>
                  <b>{l.who}：</b>{l.pre && <span className="zh">{l.pre}</span>}
                  <input className="search zh" lang="zh-CN" value={vals[id] ?? ''} disabled={checked} onChange={(e) => setVals({ ...vals, [id]: e.target.value })} placeholder="……" />
                  <span className="zh">{l.end}</span>
                  {checked && (
                    <div className="pd-sample small">
                      {l.blank.sample.map((sm, k) => <div key={k}><span className="zh">{sm.zh}</span> <span className="muted">{sm.py} · {t(sm.ru, sm.en)}</span></div>)}
                      {!matchBlank(l.blank, vals[id] ?? '') && (
                        <label className="check"><input type="checkbox" checked={!!own[id]} onChange={(e) => setOwn({ ...own, [id]: e.target.checked })} /> {t('Мой ответ тоже верный', 'My answer is right too')}</label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </li>
        ))}
      </ol>
      <Foot checked={checked} onCheck={() => setChecked(true)} score={score} onDone={onDone} />
    </>
  );
}

/* ---------- 六 measure words ---------- */

function Measure({ onDone }: { onDone: Done }) {
  const [vals, setVals] = useState(() => PAPER_MEASURE.map(() => ''));
  const [checked, setChecked] = useState(false);
  const [gloss, setGloss] = useState(false);
  const score = { got: PAPER_MEASURE.filter((m, k) => m.ok.includes(vals[k])).length, max: PAPER_MEASURE.length, misses: PAPER_MEASURE.filter((m, k) => !m.ok.includes(vals[k])).map((m) => `${m.n}${m.ok[0]}${m.noun}`) };
  return (
    <>
      <div className="paper-bank zh">{PAPER_MEASURE_BANK.join('、')}</div>
      <button className="chip" onClick={() => setGloss(!gloss)}>{gloss ? t('Скрыть значения', 'Hide meanings') : t('Подсказка: что значит каждое', 'Hint: what each one means')}</button>
      {gloss && <ul className="paper-gloss small">{PAPER_MEASURE_BANK.map((m) => <li key={m}><span className="zh">{m}</span> {MEASURE_GLOSS[m][0]} — {t(MEASURE_GLOSS[m][1], MEASURE_GLOSS[m][2])}</li>)}</ul>}
      <div className="paper-measure">
        {PAPER_MEASURE.map((m, k) => {
          const ok = m.ok.includes(vals[k]);
          return (
            <div key={k} className={`paper-mw ${checked ? (ok ? 'ok' : 'bad') : ''}`}>
              <span className="zh">{m.n}</span>
              <select className="paper-sel zh" value={vals[k]} disabled={checked} onChange={(e) => setVals(vals.map((v, j) => (j === k ? e.target.value : v)))}>
                <option value="">＿</option>{PAPER_MEASURE_BANK.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <span className="zh">{m.noun}</span>
              {checked && <div className="small muted">{!ok && <b className="zh">{m.ok.join(' / ')} · </b>}{m.py} · {t(m.ru, m.en)}{m.note && <div>{t(m.note[0], m.note[1])}</div>}</div>}
            </div>
          );
        })}
      </div>
      <Foot checked={checked} onCheck={() => setChecked(true)} score={score} onDone={onDone} />
    </>
  );
}

/* ---------- the slide: write the characters for the pinyin ---------- */

export function SlideWrite() {
  const words: WriteWord[] = SLIDE_WORDS.map((s) => {
    const w = WORD_BY_ZH.get(s.zh);
    return { zh: s.zh, py: w?.py ?? s.py, ru: w?.ru ?? '', lesson: Number(w?.lesson.split('-')[1] ?? 0), tag: t('слайд', 'slide') };
  });
  return (
    <div className="page narrow mt">
      <a className="back" href="#/midterm/paper">← {t('Тест', 'Test')}</a>
      <h1 className="serif h2">Write the correct 汉字</h1>
      <p className="muted">{t('18 слов со слайда: видишь пиньинь — пишешь иероглифы.', '18 words from the slide: see the pinyin, write the characters.')}</p>
      <Runner make={() => words} backHref="#/midterm/paper" backLabel={t('К тесту', 'Back to the test')}
        run={(items, done) => <WritePart items={items} onFinish={done} byPinyin />} />
    </div>
  );
}
