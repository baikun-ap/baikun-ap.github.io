import { useMemo, useRef, useState } from 'react';
import { ALL_GRAMMAR, BOOKS, LESSONS, STEPS } from './data';
import { GrammarCard } from './Lesson';
import { markTone } from './exercises';
import CardReview from './CardReview';
import { Bar, Planet, Py, Ring, Say, StrokeBox, VoiceWarning, useCourseCtx, useSay, type PlanetKey } from './ui';
import { dueCards, type CourseState } from './store';
import { CHARACTERS, BY_CHAR } from '../lib/syllables';
import { parsePinyin, stripTone } from '../lib/pinyin';
import { chineseVoices } from '../lib/speech';
import { useVoiceStatus } from '../components/Speaker';
import { today } from '../lib/date';
import { loadState, saveState } from '../lib/db';
import { cloudConfigured } from './cloud';
import type { AppState } from '../lib/types';
import { L, plural, setLang, t, useLang } from '../i18n';

/* ---------- helpers ---------- */

function lessonState(s: CourseState, id: string) {
  const p = s.lessons[id];
  return { done: p?.steps.length ?? 0, test: p?.test ?? null, complete: !!p?.doneAt };
}

function nextStep(s: CourseState): { lesson: (typeof LESSONS)[number]; step: number } {
  if (s.last) {
    const l = LESSONS.find((x) => x.id === s.last!.lesson);
    if (l && !s.lessons[l.id]?.doneAt) {
      const steps = s.lessons[l.id]?.steps ?? [];
      const step = STEPS.find((st) => !steps.includes(st.n))?.n ?? s.last.step;
      return { lesson: l, step };
    }
  }
  const l = LESSONS.find((x) => !s.lessons[x.id]?.doneAt) ?? LESSONS[0];
  const steps = s.lessons[l.id]?.steps ?? [];
  return { lesson: l, step: STEPS.find((st) => !steps.includes(st.n))?.n ?? 1 };
}

/** "3 cards" / "3 карточки". */
const count = (n: number, ru: [string, string, string], en: [string, string]) => `${n} ${t(plural(n, ...ru), n === 1 ? en[0] : en[1])}`;

/* ---------- dashboard ---------- */

const worlds = (): { p: PlanetKey; title: string; text: string; links: [string, string][] }[] => [
  { p: 'earth', title: t('Иероглифы и слова', 'Characters and words'), text: t('Уроки по книгам, порядок черт, словарь из 800 знаков.', 'Textbook lessons, stroke order, a dictionary of 800 characters.'), links: [[t('Курс', 'Course'), '#/course'], [t('Словарь', 'Dictionary'), '#/hanzi']] },
  { p: 'venus', title: t('Звук', 'Sound'), text: t('Пиньинь, четыре тона, аудирование и твой голос.', 'Pinyin, the four tones, listening and your own voice.'), links: [[t('Пиньинь', 'Pinyin'), '#/pinyin'], [t('Тоны', 'Tones'), '#/tones']] },
  { p: 'mars', title: t('Структура', 'Structure'), text: t('Грамматика формулами, тесты и интервальные карточки.', 'Grammar as formulas, tests and spaced-repetition flashcards.'), links: [[t('Грамматика', 'Grammar'), '#/grammar'], [t('Карточки', 'Flashcards'), '#/cards']] },
];

export function Dashboard() {
  const { state } = useCourseCtx();
  const due = dueCards(state.cards).length;
  const doneLessons = LESSONS.filter((l) => state.lessons[l.id]?.doneAt).length;
  const nx = nextStep(state);
  const stepInfo = STEPS[nx.step - 1];
  const fresh = !state.last && !Object.keys(state.lessons).length;
  const todayN = state.days[today()] ?? 0;

  return (
    <div className="page dash">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">{fresh ? t('欢迎 · ДОБРО ПОЖАЛОВАТЬ', '欢迎 · WELCOME') : t('加油 · ПРОДОЛЖАЕМ', '加油 · KEEP GOING')}</span>
          <h1 className="serif">{fresh ? t('Начни свой путь в китайский язык', 'Start your journey into Chinese') : `${t('Урок', 'Lesson')} ${nx.lesson.n}: ${L(nx.lesson.title)}`}</h1>
          <p className="muted">{fresh ? t('bai.kun — твой китайский среди звёзд. Каждый урок проходит 8 шагов: от иероглифа до твоего голоса.', 'bai.kun — your Chinese among the stars. Every lesson walks through 8 steps, from the character to your own voice.') : `${t('Следующий шаг — ', 'Next step: ')}${t(stepInfo.title, stepInfo.en).toLowerCase()}. ${L(nx.lesson.goal)}`}</p>
          <div className="row">
            <a className="btn primary lg" href={`#/lesson/${nx.lesson.id}/${nx.step}`}>{fresh ? t('Начать первый урок', 'Start the first lesson') : t('Продолжить', 'Continue')}</a>
            {due > 0 && <a className="btn lg" href="#/cards">{t('Повторить', 'Review')} {count(due, ['карточку', 'карточки', 'карточек'], ['card', 'cards'])}</a>}
          </div>
        </div>
        <div className="hero-zh" aria-hidden="true">{nx.lesson.titleZh}</div>
      </section>

      <section className="stats">
        <div className="stat"><b>{state.streak}</b><span>{t(`${plural(state.streak, 'день', 'дня', 'дней')} подряд`, state.streak === 1 ? 'day streak' : 'days in a row')}</span></div>
        <div className="stat"><b>{due}</b><span>{t('к повторению', 'due for review')}</span></div>
        <div className="stat"><b>{doneLessons}/{LESSONS.length}</b><span>{t('уроков пройдено', 'lessons done')}</span></div>
        <div className="stat"><b>{todayN}</b><span>{t('ответов сегодня', 'answers today')}</span></div>
      </section>

      <section className="worlds">
        {worlds().map((w) => (
          <article key={w.p} className={`world world-${w.p}`}>
            <Planet p={w.p} size={92} />
            <div>
              <h3><span className="zh">{w.p === 'earth' ? '地球' : w.p === 'venus' ? '金星' : '火星'}</span> {w.title}</h3>
              <p className="muted small">{w.text}</p>
              <div className="row">{w.links.map(([label, h]) => <a key={h} className="chip" href={h}>{label}</a>)}</div>
            </div>
          </article>
        ))}
      </section>

      <section>
        <div className="row between"><h2 className="serif h2">{t('Курс', 'Course')}</h2><a className="link" href="#/course">{t('Все уроки →', 'All lessons →')}</a></div>
        <LessonGrid limit={6} />
      </section>
    </div>
  );
}

/* ---------- course ---------- */

function LessonGrid({ limit, book }: { limit?: number; book?: string }) {
  const { state } = useCourseCtx();
  const list = (book ? LESSONS.filter((l) => l.book === book) : LESSONS).slice(0, limit);
  return (
    <div className="lessons">
      {list.map((l) => {
        const st = lessonState(state, l.id);
        return (
          <a key={l.id} className={`lesson-card ${st.complete ? 'complete' : ''}`} href={`#/lesson/${l.id}/${STEPS.find((s) => !(state.lessons[l.id]?.steps ?? []).includes(s.n))?.n ?? 1}`}>
            <Ring value={st.done / 8} size={52}><span className="serif">{l.n}</span></Ring>
            <div>
              <span className="lesson-n">{t('Урок', 'Lesson')} {l.n}</span>
              <h3>{L(l.title)} <span className="zh muted">{l.titleZh}</span></h3>
              <p className="muted small">{l.words.length} {t('слов', 'words')} · {l.grammar.length} {t('правил', 'rules')}{st.test !== null ? ` · ${t('тест', 'test')} ${st.test}%` : ''}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}

export function Course() {
  return (
    <div className="page">
      <h1 className="serif h1">{t('Курс', 'Course')}</h1>
      <p className="muted lead">{t('Каждый урок — 8 шагов: иероглифы → пиньинь → тоны → аудирование → говорение → грамматика → тест → карточки. Можно идти по порядку или открыть любой шаг.', 'Every lesson has 8 steps: characters → pinyin → tones → listening → speaking → grammar → test → flashcards. Go in order or open any step.')}</p>
      {BOOKS.map((b) => (
        <section key={b.id} className="book">
          <h2 className="serif h2">{L(b.title)}</h2>
          <p className="muted">{L(b.subtitle)}</p>
          {b.audio?.map((a) => <a key={a.url} className="chip audio-link" href={a.url} target="_blank" rel="noopener">🎧 {L(a.label)}</a>)}
          <LessonGrid book={b.id} />
        </section>
      ))}
    </div>
  );
}

/* ---------- cards ---------- */

export function Cards() {
  const { state, actions } = useCourseCtx();
  const [mode, setMode] = useState<'due' | 'all' | null>(null);
  const all = Object.values(state.cards);
  const due = dueCards(state.cards);
  const session = useMemo(() => (mode === 'all' ? [...all].sort(() => Math.random() - 0.5).slice(0, 20) : due), [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode) return <div className="page narrow"><button className="back" onClick={() => setMode(null)}>← {t('Колода', 'Deck')}</button><CardReview cards={session} onFinish={() => setMode(null)} /></div>;

  const groups = { new: 0, learning: 0, known: 0 };
  all.forEach((c) => { if (c.reps === 0) groups.new++; else if (c.interval < 21) groups.learning++; else groups.known++; });

  return (
    <div className="page">
      <h1 className="serif h1">{t('Карточки', 'Flashcards')}</h1>
      <p className="muted lead">{t('Интервальные повторения: вспоминаешь слово, переворачиваешь и честно оцениваешь — «Снова», «Трудно», «Хорошо» или «Легко». Сайт сам решит, когда показать его снова.', 'Spaced repetition: recall the word, flip the card and grade yourself honestly — Again, Hard, Good or Easy. The site decides when to show it next.')}</p>
      <section className="panel cards-top">
        <div><b className="big-num">{due.length}</b><span className="muted"> {t(`${plural(due.length, 'карточка', 'карточки', 'карточек')} ждут повторения`, due.length === 1 ? 'card due' : 'cards due')}</span></div>
        <div className="row">
          <button className="btn primary lg" disabled={!due.length} onClick={() => setMode('due')}>{t('Повторить', 'Review')}</button>
          <button className="btn lg" disabled={!all.length} onClick={() => setMode('all')}>{t('Свободная практика', 'Free practice')}</button>
        </div>
        <div className="row small muted">
          <span>{t('Новые', 'New')}: {groups.new}</span><span>{t('Учу', 'Learning')}: {groups.learning}</span><span>{t('Знаю', 'Known')}: {groups.known}</span>
          <label className="toggle">{t('Лицевая сторона', 'Front side')}:
            <select value={state.settings.cardFront} onChange={(e) => actions.setSettings({ cardFront: e.target.value as 'zh' | 'ru' })}>
              <option value="zh">{t('иероглиф', 'character')}</option><option value="ru">{t('перевод', 'translation')}</option>
            </select></label>
        </div>
      </section>
      {all.length ? (
        <ul className="wordlist deck">{all.sort((a, b) => (a.due < b.due ? -1 : 1)).map((c) => (
          <li key={c.id}><span className="zh">{c.zh}</span><Py text={c.py} /><span>{L(c.ru)}</span>
            <span className="muted small">{c.due <= today() ? t('сегодня', 'today') : c.due.slice(5).split('-').reverse().join('.')}</span><Say text={c.zh} /></li>
        ))}</ul>
      ) : <p className="muted">{t('Колода пока пустая. Слова добавляются на 8-м шаге каждого урока.', 'The deck is empty for now. Words are added at step 8 of every lesson.')}</p>}
    </div>
  );
}

/* ---------- pinyin chart ---------- */

/**
 * Characters for every toned syllable, read off the dictionary and the words
 * listed under each entry, so the chart can sound out far more syllables in
 * all four tones than the 800 head characters alone would allow.
 */
const SYL = (() => {
  const m = new Map<string, Map<number, string[]>>();
  const add = (ch: string, py: string) => {
    const s = parsePinyin(py)[0];
    if (!s || s.tone === 5 || !/\p{Script=Han}/u.test(ch)) return;
    const base = s.base.replace('ü', 'v');
    const row = m.get(base) ?? new Map<number, string[]>();
    const list = row.get(s.tone) ?? [];
    if (!list.includes(ch) && list.length < 4) list.push(ch);
    row.set(s.tone, list); m.set(base, row);
  };
  for (const h of CHARACTERS) {
    add(h.c, h.py.split(/\s+/)[0]);
    for (const w of h.words) { const cs = [...w.w], ps = w.p.trim().split(/\s+/); if (cs.length === ps.length) cs.forEach((c, i) => add(c, ps[i])); }
  }
  return m;
})();
const marked = (base: string, t: number) => markTone(base.replace(/v/g, 'ü'), t as 1 | 2 | 3 | 4);

const INIT = ['', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'];
const FIN = ['a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'er', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang', 'üe', 'üan', 'ün', 'v', 've', 'van', 'vn'];

export function Pinyin() {
  const { say } = useSay();
  const [sel, setSel] = useState<string | null>('ma');
  const grid = useMemo(() => {
    const finals = FIN.filter((f) => INIT.some((i) => SYL.has(i + f)));
    const inits = INIT.filter((i) => finals.some((f) => SYL.has(i + f)));
    return { finals, inits };
  }, []);
  const row = sel ? [1, 2, 3, 4].map((n) => SYL.get(sel)?.get(n) ?? null) : [];
  const first = (b: string) => { const r = SYL.get(b); if (!r) return; for (const n of [1, 2, 3, 4]) { const c = r.get(n); if (c) return c[0]; } };
  return (
    <div className="page">
      <h1 className="serif h1">{t('Пиньинь', 'Pinyin')}</h1>
      <p className="muted lead">{t('Каждый слог = инициаль (начало) + финаль (конец) + тон. Нажми на слог, затем на тон, чтобы услышать его.', 'Every syllable = initial (start) + final (end) + tone. Tap a syllable, then a tone, to hear it.')}</p>
      <VoiceWarning />
      <section className="panel tone-intro">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`tone-card t${n}`}>
            <svg viewBox="0 0 60 40" aria-hidden="true"><path d={['', 'M6 8 H54', 'M6 28 L54 8', 'M6 16 L28 34 L54 10', 'M6 6 L54 34'][n]} /></svg>
            <b>{t(`${n}-й тон`, `Tone ${n}`)}</b><span className="small muted">{t(['', 'ровный, высокий', 'восходящий, как вопрос', 'вниз и вверх', 'резко вниз'][n], ['', 'high and level', 'rising, like a question', 'dips down, then up', 'sharply falling'][n])}</span>
          </div>
        ))}
      </section>
      {sel && (
        <section className="panel syl-pick">
          <span className="syl-base">{sel.replace(/v/g, 'ü')}</span>
          <div className="row">{row.map((cs, k) => cs ? (
            <button key={k} className={`tone-btn t${k + 1}`} onClick={() => say(cs[0])}>
              <span className="py">{marked(sel, k + 1)}</span><span className="zh small">{cs.slice(0, 3).join(' ')}</span>
            </button>) : <span key={k} className="tone-btn empty">{marked(sel, k + 1)}</span>)}</div>
        </section>
      )}
      <div className="chart-wrap">
        <table className="chart">
          <thead><tr><th />{grid.finals.map((f) => <th key={f}>{f.replace('v', 'ü')}</th>)}</tr></thead>
          <tbody>{grid.inits.map((i) => (
            <tr key={i || '∅'}><th>{i || '—'}</th>{grid.finals.map((f) => {
              const b = i + f;
              return <td key={f}>{SYL.has(b) ? <button className={sel === b ? 'on' : ''} onClick={() => { setSel(b); const c = first(b); if (c) say(c); }}>{b.replace(/v/g, 'ü')}</button> : null}</td>;
            })}</tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- grammar ---------- */

export function Grammar() {
  const [q, setQ] = useState('');
  const list = ALL_GRAMMAR.filter((g) => !q || `${L(g.title)} ${L(g.formula)} ${L(g.explain)} ${g.examples.map((e) => e.zh.join('') + L(e.ru)).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page">
      <h1 className="serif h1">{t('Грамматика', 'Grammar')}</h1>
      <p className="muted lead">{t('Все правила курса в виде формул с примерами. Нажми на динамик, чтобы услышать пример.', 'Every rule of the course as a formula with examples. Tap the speaker to hear an example.')}</p>
      <input className="search" placeholder={t('Поиск: 是, вопрос, время…', 'Search: 是, question, time…')} value={q} onChange={(e) => setQ(e.target.value)} />
      {list.map((g) => (
        <div key={`${g.lesson.id}-${g.id}`}>
          <a className="lesson-n" href={`#/lesson/${g.lesson.id}/6`}>{t('Урок', 'Lesson')} {g.lesson.n} · {L(g.lesson.title)}</a>
          <GrammarCard g={g} />
        </div>
      ))}
      {!list.length && <p className="muted">{t('Ничего не найдено.', 'Nothing found.')}</p>}
    </div>
  );
}

/* ---------- characters ---------- */

export function Hanzi({ char }: { char?: string }) {
  const [q, setQ] = useState('');
  const [hsk, setHsk] = useState(0);
  const h = char ? BY_CHAR.get(char) : undefined;
  if (h) {
    return (
      <div className="page">
        <a className="back" href="#/hanzi">← {t('Словарь', 'Dictionary')}</a>
        <section className="panel hz-detail">
          <div className="hz-main">
            <div className="zh-xxl">{h.c}</div>
            <Py text={h.py} className="py-l" />
            <p className="hz-ru">{t(h.ru || h.en, h.en || h.ru)}</p>
            <Say text={h.c} big />
            <dl className="facts">
              {h.strokes && <><dt>{t('Черт', 'Strokes')}</dt><dd>{h.strokes}</dd></>}
              {h.radical && <><dt>{t('Ключ', 'Radical')}</dt><dd className="zh">{h.radical}</dd></>}
              {h.comps.length > 0 && <><dt>{t('Состав', 'Parts')}</dt><dd className="zh">{h.comps.map((c) => BY_CHAR.has(c) ? <a key={c} href={`#/hanzi/${c}`}>{c}</a> : <span key={c}>{c}</span>)}</dd></>}
              {h.hsk && <><dt>HSK</dt><dd>{h.hsk}</dd></>}
              <dt>{t('Частотность', 'Frequency')}</dt><dd>№ {h.rank}</dd>
            </dl>
          </div>
          <div className="hz-stroke"><StrokeBox char={h.c} size={220} /><WriteToggle c={h.c} /></div>
        </section>
        {h.words.length > 0 && <section className="panel"><h3>{t('Слова с этим знаком', 'Words with this character')}</h3>
          <ul className="wordlist">{h.words.slice(0, 12).map((w) => <li key={w.w}><span className="zh">{w.w}</span><Py text={w.p} /><span className="muted">{w.e}</span><Say text={w.w} /></li>)}</ul></section>}
      </div>
    );
  }
  const needle = stripTone(q.trim().toLowerCase());
  const list = CHARACTERS.filter((x) => (!hsk || x.hsk === hsk) && (!needle || x.c === q.trim() || stripTone(x.py).replace(/\s/g, '').startsWith(needle.replace(/\s/g, '')) || x.ru.toLowerCase().includes(needle) || x.en.toLowerCase().includes(needle)));
  return (
    <div className="page">
      <h1 className="serif h1">{t('Иероглифы', 'Characters')}</h1>
      <p className="muted lead">{t('800 самых частых знаков: порядок черт, значение, слова. Ищи по иероглифу, пиньиню без тонов или переводу.', 'The 800 most frequent characters: stroke order, meaning, words. Search by character, pinyin without tones, or meaning.')}</p>
      <div className="row"><input className="search" placeholder={t('好, hao, хороший…', '好, hao, good…')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="search sel" value={hsk} onChange={(e) => setHsk(+e.target.value)}><option value={0}>{t('Все HSK', 'All HSK')}</option>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>HSK {n}</option>)}</select></div>
      <p className="muted small">{t('Найдено', 'Found')}: {list.length}</p>
      <div className="hz-grid">{list.slice(0, 400).map((x) => (
        <a key={x.c} href={`#/hanzi/${x.c}`} className="hz-cell"><span className="zh">{x.c}</span><Py text={x.py.split(' ')[0]} /></a>
      ))}</div>
    </div>
  );
}

function WriteToggle({ c }: { c: string }) {
  const [on, setOn] = useState(false);
  return <>{on && <StrokeBox char={c} size={220} mode="quiz" key="q" />}<button className="chip" onClick={() => setOn(!on)}>{on ? t('Скрыть прописи', 'Hide practice') : t('✍ Прописи', '✍ Practice writing')}</button></>;
}

/* ---------- settings ---------- */

export function Settings() {
  const { state, actions, cloud, gh } = useCourseCtx();
  const [token, setToken] = useState('');
  useVoiceStatus();
  const voices = chineseVoices();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const { say } = useSay();
  const lang = useLang();

  const exportAll = async () => {
    const tones = await loadState();
    const blob = new Blob([JSON.stringify({ app: 'xinghan', at: new Date().toISOString(), course: state, tones }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `baikun-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const importAll = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as { course?: CourseState; tones?: AppState };
      if (!data.course) throw new Error();
      actions.replace(data.course);
      if (data.tones) await saveState(data.tones);
      setMsg(t('Прогресс восстановлен.', 'Progress restored.'));
    } catch { setMsg(t('Это не файл прогресса bai.kun.', 'This is not a bai.kun progress file.')); }
  };

  return (
    <div className="page narrow">
      <h1 className="serif h1">{t('Настройки', 'Settings')}</h1>
      <section className="panel form">
        <h3>{t('Язык', 'Language')}</h3>
        <label>{t('Язык интерфейса и переводов', 'Language of the interface and translations')}
          <select value={lang} onChange={(e) => setLang(e.target.value as 'ru' | 'en')}>
            <option value="ru">Русский</option><option value="en">English</option>
          </select></label>
      </section>
      <section className="panel form">
        <span className="eyebrow">{t('Синхронизация', 'Sync')}</span>
        <h3>{t('Прогресс на всех устройствах', 'Progress on all your devices')}</h3>
        {gh.connected ? (
          <div className="sync">
            <div>
              <div>GitHub: <b>{gh.login}</b></div>
              <div className="sync-state">{gh.status === 'syncing' || gh.status === 'connecting' ? t('Синхронизирую…', 'Syncing…') : gh.status === 'error' ? t('Ошибка синхронизации', 'Sync error') : `${t('Синхронизировано', 'Synced')}${gh.syncedAt ? ' · ' + gh.syncedAt.toLocaleTimeString().slice(0, 5) : ''}`}</div>
            </div>
            <div className="row">
              <button className="btn" onClick={() => gh.syncNow()}>{t('Синхронизировать', 'Sync now')}</button>
              <button className="btn" onClick={() => gh.disconnect()}>{t('Отключить', 'Disconnect')}</button>
            </div>
          </div>
        ) : (
          <>
            <p className="muted small">{t('Прогресс, карточки и тоны будут сохраняться в секретный Gist на твоём GitHub и подтягиваться на любом устройстве, где ты введёшь ключ. Работает в Китае без VPN.', 'Your progress, cards and tones are saved to a secret Gist on your GitHub and loaded on every device where you enter the token.')}</p>
            <ol className="install-steps">
              <li>{t('Открой', 'Open')} <a className="link" href="https://github.com/settings/tokens/new?scopes=gist&description=bai.kun" target="_blank" rel="noopener">{t('создание ключа на GitHub', 'new token on GitHub')}</a> {t('(галочка «gist» уже стоит).', '(the “gist” box is already ticked).')}</li>
              <li>{t('В «Expiration» выбери', 'Under “Expiration” choose')} <b>No expiration</b>{t(', внизу нажми', ', then press')} <b>Generate token</b>.</li>
              <li>{t('Скопируй ключ (начинается с', 'Copy the token (it starts with')} <code>ghp_</code>{t(') и вставь сюда.', ') and paste it here.')}</li>
            </ol>
            <form className="row" onSubmit={(e) => { e.preventDefault(); gh.connect(token); setToken(''); }}>
              <input className="search" type="password" autoComplete="off" placeholder="ghp_…" value={token} onChange={(e) => setToken(e.target.value)} style={{ marginBottom: 0 }} />
              <button className="btn primary" disabled={!token.trim() || gh.status === 'connecting'}>{gh.status === 'connecting' ? t('Подключаю…', 'Connecting…') : t('Подключить', 'Connect')}</button>
            </form>
          </>
        )}
        {gh.error && <p className="warn">{gh.error}</p>}
      </section>
      {cloudConfigured && (
      <section className="panel form">
          <span className="eyebrow">{t('Аккаунт', 'Account')}</span>
          <h3>{t('Сохранение прогресса', 'Saving progress')}</h3>
          {cloud.user ? (
            <div className="sync">
              {cloud.user.photo && <img className="avatar" src={cloud.user.photo} alt="" referrerPolicy="no-referrer" />}
              <div>
                <div>{cloud.user.name || cloud.user.email}</div>
                <div className="sync-state">{cloud.status === 'syncing' ? t('Синхронизирую…', 'Syncing…') : cloud.status === 'error' ? t('Ошибка синхронизации', 'Sync error') : `${t('Синхронизировано', 'Synced')}${cloud.syncedAt ? ' · ' + cloud.syncedAt.toLocaleTimeString().slice(0, 5) : ''}`}</div>
              </div>
              <div className="row">
                <button className="btn" onClick={() => cloud.syncNow()}>{t('Синхронизировать', 'Sync now')}</button>
                <button className="btn" onClick={() => cloud.signOut()}>{t('Выйти', 'Sign out')}</button>
              </div>
            </div>
          ) : (
            <>
              <p className="muted small">{t('Войди через Google — прогресс, карточки и тоны будут сохраняться в облаке и появятся на любом устройстве, где ты войдёшь.', 'Sign in with Google: your progress, cards and tones are saved in the cloud and appear on every device where you sign in.')}</p>
              <button className="btn primary g-btn" onClick={() => cloud.signIn()}>
                <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                {t('Войти через Google', 'Sign in with Google')}
              </button>
            </>
          )}
          {cloud.error && <p className="warn">{cloud.error}</p>}
        </section>
      )}
      <section className="panel form">
        <span className="eyebrow">iPhone</span>
        <h3>{t('Установить как приложение', 'Install as an app')}</h3>
        <ol className="install-steps">
          <li>{t('Открой сайт в', 'Open the site in')} <b>Safari</b>.</li>
          <li>{t('Нажми кнопку «Поделиться» (квадрат со стрелкой вверх).', 'Tap Share (the square with an arrow pointing up).')}</li>
          <li>{t('Выбери', 'Choose')} <b>{t('«На экран „Домой“»', '“Add to Home Screen”')}</b> → {t('«Добавить».', '“Add”.')}</li>
        </ol>
        <p className="muted small">{t('bai.kun откроется на весь экран, как обычное приложение.', 'bai.kun opens full screen, like a regular app.')} {cloudConfigured ? t('Войди там через Google, чтобы подтянуть прогресс.', 'Sign in with Google there to load your progress.') : ''}</p>
      </section>
      <section className="panel form">
        <h3>{t('Голос', 'Voice')}</h3>
        <VoiceWarning />
        <label>{t('Голос озвучки', 'Speech voice')}
          <select value={state.settings.voiceURI ?? ''} onChange={(e) => actions.setSettings({ voiceURI: e.target.value || null })}>
            <option value="">{t('Автоматически', 'Automatic')}</option>{voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
          </select></label>
        <label>{t('Скорость речи', 'Speech rate')}: {state.settings.rate.toFixed(2)}
          <input type="range" min={0.5} max={1.2} step={0.05} value={state.settings.rate} onChange={(e) => actions.setSettings({ rate: +e.target.value })} /></label>
        <button className="btn" onClick={() => say('你好，欢迎！')}>{t('Проверить голос', 'Test the voice')}</button>
      </section>
      <section className="panel form">
        <h3>{t('Оформление', 'Appearance')}</h3>
        <label>{t('Тема', 'Theme')}
          <select value={state.settings.theme ?? 'auto'} onChange={(e) => actions.setSettings({ theme: e.target.value as 'auto' | 'light' | 'dark' })}>
            <option value="auto">{t('Как в системе', 'Same as system')}</option><option value="light">{t('Светлая', 'Light')}</option><option value="dark">{t('Тёмная', 'Dark')}</option>
          </select></label>
      </section>
      <section className="panel form">
        <h3>{t('Обучение', 'Learning')}</h3>
        <label className="check"><input type="checkbox" checked={state.settings.showPinyin} onChange={(e) => actions.setSettings({ showPinyin: e.target.checked })} /> {t('Показывать пиньинь в вопросах «Что значит?»', 'Show pinyin in “What does it mean?” questions')}</label>
      </section>
      <section className="panel form">
        <h3>{t('Прогресс', 'Progress')}</h3>
        <p className="muted small">{t('Прогресс хранится на этом устройстве. Сохрани файл, чтобы перенести его на другой телефон или не потерять при очистке Safari.', 'Progress is stored on this device. Save a file to move it to another phone or to keep it safe when Safari data is cleared.')}</p>
        <div className="row">
          <button className="btn" onClick={exportAll}>{t('Сохранить в файл', 'Save to file')}</button>
          <button className="btn" onClick={() => file.current?.click()}>{t('Загрузить из файла', 'Load from file')}</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importAll(e.target.files[0])} />
        </div>
        {msg && <p className="small">{msg}</p>}
        <button className="btn danger" onClick={() => { if (confirm(t('Удалить весь прогресс курса?', 'Delete all course progress?'))) actions.reset(); }}>{t('Сбросить прогресс курса', 'Reset course progress')}</button>
      </section>
      <p className="muted small">bai.kun · {t('курс', 'course')}: {LESSONS.length} {t('уроков', 'lessons')} · {t('карточек', 'cards')}: {Object.keys(state.cards).length}</p>
      <Bar value={LESSONS.filter((l) => state.lessons[l.id]?.doneAt).length / LESSONS.length} />
    </div>
  );
}
