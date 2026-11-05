import { useEffect, useMemo, useState } from 'react';
import { BLANKS, DICTATION, FILL_TEXTS, REPLIES, TALKS, TONES, type BlankItem, type FillText, type Gap, type Reply, type Talk, type ToneItem } from '../content/listening-midterm';
import { autoMark, checkPinyin, shuffle } from './exercises';
import { Py, VoiceWarning, useCourseCtx } from './ui';
import { useVoiceStatus } from '../components/Speaker';
import { Progress, Runner, WritePart, readLS, writeLS, useAt, type Result, type WriteWord } from './Write';
import { speak, speakSequence, stopSpeaking } from '../lib/speech';
import { t } from '../i18n';

/**
 * Listening midterm practice from 《汉语听力教程》 Book 1, lessons 6–8: hear a
 * question and choose a reply, hear a dialogue and answer, write what you
 * hear (pinyin, then characters), fill the gaps of a text. The site's Chinese
 * voice reads everything; in dialogues the two speakers differ in pitch.
 */

const LESSONS = [6, 7, 8];
const LS_SEL = 'baikun-listen-lessons';
const PITCH = { 男: 0.75, 女: 1.3 } as const;

const PARTS = [
  { key: 'tones', zh: '一、听后标出声调', ru: 'Послушай и напиши пиньинь с тоном (уроки 1–3, слайды преподавателя)', en: 'Listen and write the pinyin with tones (lessons 1–3, teacher’s slides)' },
  { key: 'blanks', zh: '二、在横线上填出你听到的音节', ru: 'Послушай и впиши пропущенные слоги (уроки 1–5, как в тесте)', en: 'Listen and fill in the missing syllables (lessons 1–5, as in the test)' },
  { key: 'reply', zh: '三、听后选择合适的回答', ru: 'Послушай вопрос и выбери подходящий ответ', en: 'Listen and choose the appropriate answer' },
  { key: 'talk', zh: '四、听下列对话，选择正确答案', ru: 'Послушай диалог и выбери правильный ответ', en: 'Listen to the conversation and choose the right answer' },
  { key: 'write', zh: '五、边听边写出词语的拼音和汉字', ru: 'Послушай слово → напиши пиньинь → потом иероглифы', en: 'Listen, write the pinyin, then the characters' },
  { key: 'fill', zh: '六、边听边填空', ru: 'Послушай текст и заполни пропуски (стр. 26)', en: 'Listen and fill in the blanks (p. 26)' },
] as const;
type Key = (typeof PARTS)[number]['key'];

/**
 * Reads with the learner's voice and speed. Subscribing to the voice status is
 * what makes the browser load its voices; without it the list stays empty and
 * nothing is spoken.
 */
function useVoice() {
  const { state } = useCourseCtx();
  const status = useVoiceStatus();
  const base = { voiceURI: state.settings.voiceURI, rate: state.settings.rate };
  useEffect(() => () => stopSpeaking(), []);
  return {
    status,
    say: (text: string) => speak(text, base),
    dialogue: (lines: { who: '男' | '女'; zh: string }[], q?: string) =>
      speakSequence([...lines.map((l) => ({ text: l.zh, pitch: PITCH[l.who] })), ...(q ? [{ text: `问：${q}`, pitch: 1 }] : [])], base),
  };
}

export default function Listening({ sub }: { sub?: string }) {
  const [sel, setSelState] = useState<number[]>(() => {
    const s = readLS(LS_SEL)?.split(',').map(Number).filter((n) => LESSONS.includes(n));
    return s?.length ? s : LESSONS;
  });
  const setSel = (s: number[]) => { setSelState(s); writeLS(LS_SEL, s.join(',')); };
  const lists = useMemo(() => ({
    reply: REPLIES.filter((x) => sel.includes(x.lesson)),
    talk: TALKS.filter((x) => sel.includes(x.lesson)),
    write: DICTATION.filter((x) => sel.includes(x.lesson)),
  }), [sel]);

  const back = { backHref: '#/midterm/listen', backLabel: t('К аудированию', 'Back to listening') };
  const part = PARTS.find((p) => p.key === sub);
  if (part) {
    return (
      <div className="page narrow mt paper">
        <a className="back" href="#/midterm/listen">← {t('Аудирование', 'Listening')}</a>
        <h1 className="serif h2 zh-title">{part.zh}</h1>
        <p className="muted">{t(part.ru, part.en)}</p>
        {part.key === 'reply' && <Runner key={`r${sel}`} {...back} make={() => shuffle(lists.reply)} run={(items, done, start, onAt) => <ChoicePart items={items} kind="reply" onFinish={done} start={start} onAt={onAt} />} />}
        {part.key === 'talk' && <Runner key={`t${sel}`} {...back} make={() => shuffle(lists.talk)} run={(items, done, start, onAt) => <ChoicePart items={items} kind="talk" onFinish={done} start={start} onAt={onAt} />} />}
        {part.key === 'write' && <Runner key={`w${sel}`} {...back} make={() => shuffle(lists.write).map(toWord)} run={(items, done, start, onAt) => <WritePart items={items} byAudio onFinish={done} start={start} onAt={onAt} />} />}
        {part.key === 'fill' && <FillPart />}
        {part.key === 'tones' && <ByLesson lessons={[1, 2, 3]} render={(l) => <TonePart key={l} items={TONES.filter((x) => x.lesson === l)} />} />}
        {part.key === 'blanks' && <ByLesson lessons={[1, 2, 3, 4, 5]} render={(l) => <BlankPart key={l} items={BLANKS.filter((x) => x.lesson === l)} />} />}
      </div>
    );
  }
  if (sub === 'all') return <All lists={lists} />;

  const count: Record<Key, number> = { tones: TONES.length, blanks: BLANKS.length, reply: lists.reply.length, talk: lists.talk.length, write: lists.write.length, fill: FILL_TEXTS.length };
  return (
    <div className="page mt">
      <a className="back" href="#/midterm">← {t('Мидтерм', 'Midterm')}</a>
      <span className="eyebrow">{t('听力 · АУДИРОВАНИЕ', '听力 · LISTENING')}</span>
      <h1 className="serif h1">{t('Мидтерм по аудированию', 'Listening midterm')}</h1>
      <p className="muted lead">{t('《汉语听力教程》 том 1. Разделы 一, 二 и диктант уроков 6–7, диалоги урока 8 — тексты домашних записей со слайдов преподавателя. Вопросы уроков 6–8 написаны сайтом под варианты ответов книги. Всё читает китайский голос сайта: в диалогах мужчина ниже, женщина выше.', '《汉语听力教程》 Book 1. Parts 一 and 二, the lesson 6–7 dictation and the lesson 8 dialogues use the homework recordings’ texts from the teacher’s slides. The lesson 6–8 questions are written by the site for the book’s answer options. The site’s Chinese voice reads everything: in dialogues the man is lower, the woman higher.')}</p>

      <section className="panel mt-lessons">
        <span className="small muted">{t('Уроки', 'Lessons')}</span>
        <div className="row">
          {LESSONS.map((n) => {
            const on = sel.includes(n);
            return <button key={n} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setSel(on ? (sel.length > 1 ? sel.filter((x) => x !== n) : sel) : [...sel, n].sort())}>{n}</button>;
          })}
        </div>
      </section>

      <div className="paper-list">
        {PARTS.map((p, k) => (
          <a key={p.key} className="panel paper-sec" href={`#/midterm/listen/${p.key}`}>
            <span className="paper-n zh">{['一', '二', '三', '四', '五', '六'][k]}</span>
            <div><h3 className="zh">{p.zh.slice(2)}</h3><p className="small muted">{t(p.ru, p.en)} · {count[p.key]}</p></div>
          </a>
        ))}
      </div>
      <a className="btn primary lg" href="#/midterm/listen/all">{t('Всё подряд: тоны, слоги, вопросы, диалоги, диктант, текст', 'All in a row: tones, syllables, questions, dialogues, dictation, text')}</a>
    </div>
  );
}

const toWord = (x: (typeof DICTATION)[number]): WriteWord => ({ zh: x.zh, py: x.py, ru: t(x.ru, x.en), lesson: x.lesson, tag: t(`урок ${x.lesson} · стр. ${x.page}`, `lesson ${x.lesson} · p. ${x.page}`) });

/* ---------- choose an answer after listening ---------- */

function ChoicePart<T extends Reply | Talk>({ items, kind, onFinish, start, onAt }: { items: T[]; kind: 'reply' | 'talk'; onFinish: (r: Result & { missed: T[] }) => void; start?: number; onAt?: (i: number) => void }) {
  const { actions } = useCourseCtx();
  const voice = useVoice();
  const [i, setI] = useAt(start, onAt);
  const [pick, setPick] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [missed, setMissed] = useState<T[]>([]);
  const q = items[i];
  const play = () => ('ask' in q ? voice.say(q.ask) : voice.dialogue(q.lines, q.q));
  useEffect(() => {
    if (voice.status !== 'ready') return;
    const id = window.setTimeout(play, 350);
    return () => window.clearTimeout(id);
  }, [i, voice.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const ok = pick !== null && q.a.includes(pick);
  const choose = (k: number) => { if (pick !== null) return; setPick(k); actions.answered(q.a.includes(k)); };
  const next = () => {
    const r = right + (ok ? 1 : 0), m = ok ? missed : [...missed, q];
    setRight(r); setMissed(m); setPick(null);
    if (i + 1 < items.length) setI(i + 1);
    else onFinish({ right: r, total: items.length, misses: m.map((x) => ('ask' in x ? x.ask : x.q)), missed: m });
  };
  return (
    <div className="quiz">
      <Progress i={i} n={items.length} />
      <div className="q-prompt">
        <p className="q-ask small">{t(`Урок ${q.lesson} · стр. ${q.page} · №${q.n}`, `Lesson ${q.lesson} · p. ${q.page} · No. ${q.n}`)}</p>
        <VoiceWarning />
        <button className="btn lg ls-play" onClick={play}>▶ {kind === 'reply' ? t('Послушать вопрос', 'Play the question') : t('Послушать диалог', 'Play the dialogue')}</button>
      </div>
      <div className="opts ls-opts">
        {q.options.map((o, k) => (
          <button key={k} className={`opt ${pick !== null ? (q.a.includes(k) ? 'ok' : k === pick ? 'bad' : 'dim') : ''}`} disabled={pick !== null} onClick={() => choose(k)}>
            <b>{'ABCD'[k]}.</b> <span className="zh">{o}</span>
          </button>
        ))}
      </div>
      {pick !== null && (
        <div className="ls-script">
          {'ask' in q
            ? <p><span className="zh">{q.ask}</span></p>
            : <>{q.lines.map((l, k) => <p key={k}><b>{l.who}：</b><span className="zh">{l.zh}</span></p>)}<p><b>问：</b><span className="zh">{q.q}</span></p></>}
          <p className="small muted">{t(q.ru, q.en)}</p>
        </div>
      )}
      <div className="quiz-foot">
        {pick !== null
          ? <><span className={`verdict ${ok ? 'ok' : 'bad'}`}>{ok ? t('Верно!', 'Correct!') : t('Не совсем', 'Not quite')}</span><button className="btn primary" onClick={next} autoFocus>{t('Дальше', 'Next')}</button></>
          : <span className="muted small">{t('Слушай сколько нужно, потом выбирай', 'Listen as often as you need, then choose')}</span>}
      </div>
    </div>
  );
}

/* ---------- fill the gaps of a text ---------- */

function FillText({ text, vals, setVal, checked }: { text: FillText; vals: string[]; setVal: (k: number, v: string) => void; checked: boolean }) {
  const voice = useVoice();
  const spoken = text.lines.map((l) => ({ who: (l.who === 'B' ? '女' : '男') as '男' | '女', zh: l.parts.map((p) => (typeof p === 'string' ? p : p.zh)).join('') }));
  let gap = -1;
  return (
    <div className="panel ls-fill">
      <VoiceWarning />
      <button className="btn ls-play" onClick={() => voice.dialogue(spoken)}>▶ {t('Послушать текст', 'Play the text')}</button>
      {text.lines.map((l, j) => (
        <p key={j} className="ls-line">{l.who && <b>{l.who}：</b>}
          {l.parts.map((p, k) => {
            if (typeof p === 'string') return <span key={k} className="zh">{p}</span>;
            gap += 1;
            const at = gap, good = gapOk(p, vals[at]);
            return (
              <span key={k} className="ls-gap">
                <input className={`search zh ${checked ? (good ? 'ok' : 'bad') : ''}`} value={vals[at] ?? ''} disabled={checked} onChange={(e) => setVal(at, e.target.value)}
                  autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="＿＿" />
                {checked && !good && <span className="small"><span className="zh">{p.zh}</span> <Py text={p.py} /></span>}
              </span>
            );
          })}
        </p>
      ))}
      {checked && <p className="small muted">{t(text.ru, text.en)}</p>}
    </div>
  );
}

const gapOk = (g: Gap, v = '') => { const s = v.trim(); return !!s && (s === g.zh || checkPinyin(s, g.py) === 'ok'); };

function FillPart({ onDone }: { onDone?: (s: { got: number; max: number }) => void }) {
  const { actions } = useCourseCtx();
  const gaps = FILL_TEXTS.map((x) => x.lines.flatMap((l) => l.parts.filter((p): p is Gap => typeof p !== 'string')));
  const [vals, setVals] = useState<string[][]>(() => gaps.map((g) => g.map(() => '')));
  const [checked, setChecked] = useState(false);
  const got = gaps.reduce((s, g, i) => s + g.filter((p, k) => gapOk(p, vals[i][k])).length, 0), max = gaps.flat().length;
  return (
    <>
      <p className="small muted mt-note">{t('Пиши пропущенное слово иероглифами или пиньинем (тон цифрой: mang2 → máng).', 'Write each missing word in characters or pinyin (tone as a number: mang2 → máng).')}</p>
      {FILL_TEXTS.map((x, i) => <FillText key={i} text={x} checked={checked} vals={vals[i]}
        setVal={(k, v) => setVals(vals.map((row, m) => (m === i ? row.map((c, n) => (n === k ? (/[a-z]\d/i.test(v) ? autoMark(v) : v) : c)) : row)))} />)}
      <div className="quiz-foot">
        {checked
          ? <><span className={`verdict ${got === max ? 'ok' : 'bad'}`}>{t(`Верно ${got} из ${max}`, `${got} of ${max} correct`)}</span>
            {onDone ? <button className="btn primary" onClick={() => onDone({ got, max })}>{t('Готово', 'Done')}</button> : <button className="btn" onClick={() => { setVals(gaps.map((g) => g.map(() => ''))); setChecked(false); }}>{t('Ещё раз', 'Again')}</button>}</>
          : <button className="btn primary" onClick={() => { setChecked(true); actions.answered(got === max); }}>{t('Проверить', 'Check')}</button>}
      </div>
    </>
  );
}

/* ---------- lessons 1–5: tones and missing syllables ---------- */

function ByLesson({ lessons, render }: { lessons: number[]; render: (l: number) => React.ReactNode }) {
  const [l, setL] = useState(lessons[0]);
  return (
    <>
      <div className="row nt-lessons">{lessons.map((n) => <button key={n} className={`chip ${n === l ? 'on' : ''}`} onClick={() => setL(n)}>{t(`Урок ${n}`, `Lesson ${n}`)}</button>)}</div>
      {render(l)}
    </>
  );
}

const toneless = (py: string) => py.normalize('NFD').replace(/[\u0300\u0301\u0304\u030c]/g, '').normalize('NFC');

function TonePart({ items, onDone }: { items: ToneItem[]; onDone?: (s: { got: number; max: number }) => void }) {
  const voice = useVoice();
  const { actions } = useCourseCtx();
  const [vals, setVals] = useState(() => items.map(() => ''));
  const [checked, setChecked] = useState(false);
  const ok = items.map((x, k) => checkPinyin(vals[k], x.py) === 'ok');
  const got = ok.filter(Boolean).length;
  return (
    <>
      <VoiceWarning />
      <p className="small muted mt-note">{t('Нажми ▶, послушай и напиши пиньинь с тоном: цифрой после слога (pa4 → pà) или знаком.', 'Tap ▶, listen and write the pinyin with its tone: a number after the syllable (pa4 → pà) or a mark.')}</p>
      <div className="ls-tones">
        {items.map((x, k) => (
          <div key={x.py} className={`ls-tone ${checked ? (ok[k] ? 'ok' : 'bad') : ''}`}>
            <button className="chip" onClick={() => voice.say(x.say)} aria-label={t('Послушать', 'Listen')}>▶</button>
            <span className="ls-bare">{toneless(x.py)}</span>
            <input className="search" value={vals[k]} disabled={checked} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={toneless(x.py)}
              onChange={(e) => setVals(vals.map((v, m) => (m === k ? autoMark(e.target.value) : v)))} />
            {checked && !ok[k] && <span className="small"><Py text={x.py} />{x.zh && <span className="zh"> {x.zh}</span>}</span>}
            {checked && ok[k] && x.zh && <span className="small zh">{x.zh}</span>}
          </div>
        ))}
      </div>
      <div className="quiz-foot">
        {checked
          ? <><span className={`verdict ${got === items.length ? 'ok' : 'bad'}`}>{t(`Верно ${got} из ${items.length}`, `${got} of ${items.length} correct`)}</span>
            {onDone ? <button className="btn primary" onClick={() => onDone({ got, max: items.length })}>{t('Готово', 'Done')}</button>
              : <button className="btn" onClick={() => { setVals(items.map(() => '')); setChecked(false); }}>{t('Ещё раз', 'Again')}</button>}</>
          : <button className="btn primary" onClick={() => { setChecked(true); actions.answered(got === items.length); }}>{t('Проверить', 'Check')}</button>}
      </div>
    </>
  );
}

/** "hěn hǎo[kàn]" → text and gaps. */
const splitGaps = (py: string) => py.split(/(\[[^\]]+\])/).filter(Boolean).map((x) => (x.startsWith('[') ? { gap: x.slice(1, -1) } : x));

function BlankPart({ items, onDone }: { items: BlankItem[]; onDone?: (s: { got: number; max: number }) => void }) {
  const voice = useVoice();
  const { actions } = useCourseCtx();
  const gaps = items.map((it) => it.lines.flatMap((l) => splitGaps(l.py).filter((p): p is { gap: string } => typeof p !== 'string').map((p) => p.gap)));
  const [vals, setVals] = useState<string[][]>(() => gaps.map((g) => g.map(() => '')));
  const [checked, setChecked] = useState(false);
  const okAt = (i: number, k: number) => checkPinyin(vals[i][k] ?? '', gaps[i][k]) === 'ok';
  const got = gaps.reduce((s, g, i) => s + g.filter((_, k) => okAt(i, k)).length, 0), max = gaps.flat().length;
  const play = (it: BlankItem) => voice.dialogue(it.lines.map((l) => ({ who: l.who === 'B' ? '女' : '男', zh: l.zh })));
  return (
    <>
      <VoiceWarning />
      <p className="small muted mt-note">{t('Нажми ▶ и впиши пропущенные слоги пиньинем с тонами (kan4 → kàn).', 'Tap ▶ and fill in the missing syllables in pinyin with tones (kan4 → kàn).')}</p>
      <ol className="paper-rows">
        {items.map((it, i) => {
          let at = -1;
          return (
            <li key={i}>
              <button className="chip ls-mini" onClick={() => play(it)}>▶ {t('Послушать', 'Listen')}</button>
              {it.lines.map((l, j) => (
                <p key={j} className="ls-py">{l.who && <b>{l.who}：</b>}
                  {splitGaps(l.py).map((p, k) => {
                    if (typeof p === 'string') return <span key={k}>{p}</span>;
                    at += 1;
                    const n = at, good = okAt(i, n);
                    return (
                      <span key={k} className="ls-gap">
                        <input className={`search ${checked ? (good ? 'ok' : 'bad') : ''}`} value={vals[i][n] ?? ''} disabled={checked} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="＿＿"
                          onChange={(e) => setVals(vals.map((row, m) => (m === i ? row.map((c, q) => (q === n ? autoMark(e.target.value) : c)) : row)))} />
                        {checked && !good && <span className="small"><Py text={p.gap} /></span>}
                      </span>
                    );
                  })}
                </p>
              ))}
              {checked && <p className="small muted">{it.lines.map((l) => l.zh).join(' ')} · {t(it.ru, it.en)}</p>}
            </li>
          );
        })}
      </ol>
      <div className="quiz-foot">
        {checked
          ? <><span className={`verdict ${got === max ? 'ok' : 'bad'}`}>{t(`Верно ${got} из ${max}`, `${got} of ${max} correct`)}</span>
            {onDone ? <button className="btn primary" onClick={() => onDone({ got, max })}>{t('Готово', 'Done')}</button>
              : <button className="btn" onClick={() => { setVals(gaps.map((g) => g.map(() => ''))); setChecked(false); }}>{t('Ещё раз', 'Again')}</button>}</>
          : <button className="btn primary" onClick={() => { setChecked(true); actions.answered(got === max); }}>{t('Проверить', 'Check')}</button>}
      </div>
    </>
  );
}

/* ---------- everything in a row ---------- */

function All({ lists }: { lists: { reply: Reply[]; talk: Talk[]; write: (typeof DICTATION)[number][] } }) {
  const [plan] = useState(() => ({ tones: shuffle(TONES).slice(0, 12), blanks: shuffle(BLANKS).slice(0, 5), reply: shuffle(lists.reply).slice(0, 10), talk: shuffle(lists.talk).slice(0, 10), write: shuffle(lists.write).slice(0, 10).map(toWord) }));
  const [stage, setStage] = useState(0);
  const [scores, setScores] = useState<{ got: number; max: number }[]>([]);
  const done = (s: { got: number; max: number }) => { setScores([...scores, s]); setStage(stage + 1); window.scrollTo(0, 0); };
  const head = (
    <>
      <a className="back" href="#/midterm/listen">← {t('Аудирование', 'Listening')}</a>
      <h1 className="serif h2">{t('Всё подряд', 'All in a row')}</h1>
    </>
  );
  if (stage >= PARTS.length) {
    const got = scores.reduce((a, s) => a + s.got, 0), max = scores.reduce((a, s) => a + s.max, 0);
    const pct = Math.round((got / max) * 100);
    return (
      <div className="page narrow mt paper">{head}
        <div className="result">
          <div className={`result-num ${pct < 80 ? 'bad' : ''}`}>{pct}%</div>
          <ul className="mt-score">{PARTS.map((p, k) => <li key={p.key}><span className="zh">{p.zh}</span><b>{scores[k].got}/{scores[k].max}</b></li>)}</ul>
          <div className="row center"><a className="btn primary" href="#/midterm/listen">{t('К аудированию', 'Back to listening')}</a></div>
        </div>
      </div>
    );
  }
  const p = PARTS[stage];
  return (
    <div className="page narrow mt paper" key={stage}>{head}
      <p className="hint">{t(`Часть ${stage + 1} из ${PARTS.length}`, `Part ${stage + 1} of ${PARTS.length}`)} · <span className="zh">{p.zh}</span></p>
      {p.key === 'tones' && <TonePart items={plan.tones} onDone={done} />}
      {p.key === 'blanks' && <BlankPart items={plan.blanks} onDone={done} />}
      {p.key === 'reply' && <ChoicePart items={plan.reply} kind="reply" onFinish={(r) => done({ got: r.right, max: r.total })} />}
      {p.key === 'talk' && <ChoicePart items={plan.talk} kind="talk" onFinish={(r) => done({ got: r.right, max: r.total })} />}
      {p.key === 'write' && <WritePart items={plan.write} byAudio onFinish={(r) => done({ got: r.right, max: r.total })} />}
      {p.key === 'fill' && <FillPart onDone={done} />}
    </div>
  );
}
