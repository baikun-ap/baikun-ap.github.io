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

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

/* ---------- dashboard ---------- */

const WORLDS: { p: PlanetKey; title: string; text: string; links: [string, string][] }[] = [
  { p: 'earth', title: 'Иероглифы и слова', text: 'Уроки по книгам, порядок черт, словарь из 800 знаков.', links: [['Курс', '#/course'], ['Словарь', '#/hanzi']] },
  { p: 'venus', title: 'Звук', text: 'Пиньинь, четыре тона, аудирование и твой голос.', links: [['Пиньинь', '#/pinyin'], ['Тоны', '#/tones']] },
  { p: 'mars', title: 'Структура', text: 'Грамматика формулами, тесты и интервальные карточки.', links: [['Грамматика', '#/grammar'], ['Карточки', '#/cards']] },
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
          <span className="eyebrow">{fresh ? '欢迎 · ДОБРО ПОЖАЛОВАТЬ' : '加油 · ПРОДОЛЖАЕМ'}</span>
          <h1 className="serif">{fresh ? 'Начни свой путь в китайский язык' : `Урок ${nx.lesson.n}: ${nx.lesson.title}`}</h1>
          <p className="muted">{fresh ? 'bai.kun — твой китайский среди звёзд. Каждый урок проходит 8 шагов: от иероглифа до твоего голоса.' : `Следующий шаг — ${stepInfo.title.toLowerCase()}. ${nx.lesson.goal}`}</p>
          <div className="row">
            <a className="btn primary lg" href={`#/lesson/${nx.lesson.id}/${nx.step}`}>{fresh ? 'Начать первый урок' : 'Продолжить'}</a>
            {due > 0 && <a className="btn lg" href="#/cards">Повторить {due} {plural(due, 'карточку', 'карточки', 'карточек')}</a>}
          </div>
        </div>
        <div className="hero-zh" aria-hidden="true">{nx.lesson.titleZh}</div>
      </section>

      <section className="stats">
        <div className="stat"><b>{state.streak}</b><span>{plural(state.streak, 'день', 'дня', 'дней')} подряд</span></div>
        <div className="stat"><b>{due}</b><span>к повторению</span></div>
        <div className="stat"><b>{doneLessons}/{LESSONS.length}</b><span>уроков пройдено</span></div>
        <div className="stat"><b>{todayN}</b><span>ответов сегодня</span></div>
      </section>

      <section className="worlds">
        {WORLDS.map((w) => (
          <article key={w.p} className={`world world-${w.p}`}>
            <Planet p={w.p} size={92} />
            <div>
              <h3><span className="zh">{w.p === 'earth' ? '地球' : w.p === 'venus' ? '金星' : '火星'}</span> {w.title}</h3>
              <p className="muted small">{w.text}</p>
              <div className="row">{w.links.map(([t, h]) => <a key={h} className="chip" href={h}>{t}</a>)}</div>
            </div>
          </article>
        ))}
      </section>

      <section>
        <div className="row between"><h2 className="serif h2">Курс</h2><a className="link" href="#/course">Все уроки →</a></div>
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
              <span className="lesson-n">Урок {l.n}</span>
              <h3>{l.title} <span className="zh muted">{l.titleZh}</span></h3>
              <p className="muted small">{l.words.length} слов · {l.grammar.length} правил{st.test !== null ? ` · тест ${st.test}%` : ''}</p>
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
      <h1 className="serif h1">Курс</h1>
      <p className="muted lead">Каждый урок — 8 шагов: иероглифы → пиньинь → тоны → аудирование → говорение → грамматика → тест → карточки. Можно идти по порядку или открыть любой шаг.</p>
      {BOOKS.map((b) => (
        <section key={b.id} className="book">
          <h2 className="serif h2">{b.title}</h2>
          <p className="muted">{b.subtitle}</p>
          {b.audio?.map((a) => <a key={a.url} className="chip audio-link" href={a.url} target="_blank" rel="noopener">🎧 {a.label}</a>)}
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

  if (mode) return <div className="page narrow"><button className="back" onClick={() => setMode(null)}>← Колода</button><CardReview cards={session} onFinish={() => setMode(null)} /></div>;

  const groups = { new: 0, learning: 0, known: 0 };
  all.forEach((c) => { if (c.reps === 0) groups.new++; else if (c.interval < 21) groups.learning++; else groups.known++; });

  return (
    <div className="page">
      <h1 className="serif h1">Карточки</h1>
      <p className="muted lead">Интервальные повторения: вспоминаешь слово, переворачиваешь и честно оцениваешь — «Снова», «Трудно», «Хорошо» или «Легко». Сайт сам решит, когда показать его снова.</p>
      <section className="panel cards-top">
        <div><b className="big-num">{due.length}</b><span className="muted"> {plural(due.length, 'карточка', 'карточки', 'карточек')} ждут повторения</span></div>
        <div className="row">
          <button className="btn primary lg" disabled={!due.length} onClick={() => setMode('due')}>Повторить</button>
          <button className="btn lg" disabled={!all.length} onClick={() => setMode('all')}>Свободная практика</button>
        </div>
        <div className="row small muted">
          <span>Новые: {groups.new}</span><span>Учу: {groups.learning}</span><span>Знаю: {groups.known}</span>
          <label className="toggle">Лицевая сторона:
            <select value={state.settings.cardFront} onChange={(e) => actions.setSettings({ cardFront: e.target.value as 'zh' | 'ru' })}>
              <option value="zh">иероглиф</option><option value="ru">перевод</option>
            </select></label>
        </div>
      </section>
      {all.length ? (
        <ul className="wordlist deck">{all.sort((a, b) => (a.due < b.due ? -1 : 1)).map((c) => (
          <li key={c.id}><span className="zh">{c.zh}</span><Py text={c.py} /><span>{c.ru}</span>
            <span className="muted small">{c.due <= today() ? 'сегодня' : c.due.slice(5).split('-').reverse().join('.')}</span><Say text={c.zh} /></li>
        ))}</ul>
      ) : <p className="muted">Колода пока пустая. Слова добавляются на 8-м шаге каждого урока.</p>}
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
  const row = sel ? [1, 2, 3, 4].map((t) => SYL.get(sel)?.get(t) ?? null) : [];
  const first = (b: string) => { const r = SYL.get(b); if (!r) return; for (const t of [1, 2, 3, 4]) { const c = r.get(t); if (c) return c[0]; } };
  return (
    <div className="page">
      <h1 className="serif h1">Пиньинь</h1>
      <p className="muted lead">Каждый слог = инициаль (начало) + финаль (конец) + тон. Нажми на слог, затем на тон, чтобы услышать его.</p>
      <VoiceWarning />
      <section className="panel tone-intro">
        {[1, 2, 3, 4].map((t) => (
          <div key={t} className={`tone-card t${t}`}>
            <svg viewBox="0 0 60 40" aria-hidden="true"><path d={['', 'M6 8 H54', 'M6 28 L54 8', 'M6 16 L28 34 L54 10', 'M6 6 L54 34'][t]} /></svg>
            <b>{t}-й тон</b><span className="small muted">{['', 'ровный, высокий', 'восходящий, как вопрос', 'вниз и вверх', 'резко вниз'][t]}</span>
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
  const list = ALL_GRAMMAR.filter((g) => !q || `${g.title} ${g.formula} ${g.explain} ${g.examples.map((e) => e.zh.join('') + e.ru).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page">
      <h1 className="serif h1">Грамматика</h1>
      <p className="muted lead">Все правила курса в виде формул с примерами. Нажми на динамик, чтобы услышать пример.</p>
      <input className="search" placeholder="Поиск: 是, вопрос, время…" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.map((g) => (
        <div key={`${g.lesson.id}-${g.id}`}>
          <a className="lesson-n" href={`#/lesson/${g.lesson.id}/6`}>Урок {g.lesson.n} · {g.lesson.title}</a>
          <GrammarCard g={g} />
        </div>
      ))}
      {!list.length && <p className="muted">Ничего не найдено.</p>}
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
        <a className="back" href="#/hanzi">← Словарь</a>
        <section className="panel hz-detail">
          <div className="hz-main">
            <div className="zh-xxl">{h.c}</div>
            <Py text={h.py} className="py-l" />
            <p className="hz-ru">{h.ru || h.en}</p>
            <Say text={h.c} big />
            <dl className="facts">
              {h.strokes && <><dt>Черт</dt><dd>{h.strokes}</dd></>}
              {h.radical && <><dt>Ключ</dt><dd className="zh">{h.radical}</dd></>}
              {h.comps.length > 0 && <><dt>Состав</dt><dd className="zh">{h.comps.map((c) => BY_CHAR.has(c) ? <a key={c} href={`#/hanzi/${c}`}>{c}</a> : <span key={c}>{c}</span>)}</dd></>}
              {h.hsk && <><dt>HSK</dt><dd>{h.hsk}</dd></>}
              <dt>Частотность</dt><dd>№ {h.rank}</dd>
            </dl>
          </div>
          <div className="hz-stroke"><StrokeBox char={h.c} size={220} /><WriteToggle c={h.c} /></div>
        </section>
        {h.words.length > 0 && <section className="panel"><h3>Слова с этим знаком</h3>
          <ul className="wordlist">{h.words.slice(0, 12).map((w) => <li key={w.w}><span className="zh">{w.w}</span><Py text={w.p} /><span className="muted">{w.e}</span><Say text={w.w} /></li>)}</ul></section>}
      </div>
    );
  }
  const needle = stripTone(q.trim().toLowerCase());
  const list = CHARACTERS.filter((x) => (!hsk || x.hsk === hsk) && (!needle || x.c === q.trim() || stripTone(x.py).replace(/\s/g, '').startsWith(needle.replace(/\s/g, '')) || x.ru.toLowerCase().includes(needle) || x.en.toLowerCase().includes(needle)));
  return (
    <div className="page">
      <h1 className="serif h1">Иероглифы</h1>
      <p className="muted lead">800 самых частых знаков: порядок черт, значение, слова. Ищи по иероглифу, пиньиню без тонов или переводу.</p>
      <div className="row"><input className="search" placeholder="好, hao, хороший…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="search sel" value={hsk} onChange={(e) => setHsk(+e.target.value)}><option value={0}>Все HSK</option>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>HSK {n}</option>)}</select></div>
      <p className="muted small">Найдено: {list.length}</p>
      <div className="hz-grid">{list.slice(0, 400).map((x) => (
        <a key={x.c} href={`#/hanzi/${x.c}`} className="hz-cell"><span className="zh">{x.c}</span><Py text={x.py.split(' ')[0]} /></a>
      ))}</div>
    </div>
  );
}

function WriteToggle({ c }: { c: string }) {
  const [on, setOn] = useState(false);
  return <>{on && <StrokeBox char={c} size={220} mode="quiz" key="q" />}<button className="chip" onClick={() => setOn(!on)}>{on ? 'Скрыть прописи' : '✍ Прописи'}</button></>;
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
      setMsg('Прогресс восстановлен.');
    } catch { setMsg('Это не файл прогресса bai.kun.'); }
  };

  return (
    <div className="page narrow">
      <h1 className="serif h1">Настройки</h1>
      <section className="panel form">
        <span className="eyebrow">Синхронизация</span>
        <h3>Прогресс на всех устройствах</h3>
        {gh.connected ? (
          <div className="sync">
            <div>
              <div>GitHub: <b>{gh.login}</b></div>
              <div className="sync-state">{gh.status === 'syncing' || gh.status === 'connecting' ? 'Синхронизирую…' : gh.status === 'error' ? 'Ошибка синхронизации' : `Синхронизировано${gh.syncedAt ? ' · ' + gh.syncedAt.toLocaleTimeString().slice(0, 5) : ''}`}</div>
            </div>
            <div className="row">
              <button className="btn" onClick={() => gh.syncNow()}>Синхронизировать</button>
              <button className="btn" onClick={() => gh.disconnect()}>Отключить</button>
            </div>
          </div>
        ) : (
          <>
            <p className="muted small">Прогресс, карточки и тоны будут сохраняться в секретный Gist на твоём GitHub и подтягиваться на любом устройстве, где ты введёшь ключ. Работает в Китае без VPN.</p>
            <ol className="install-steps">
              <li>Открой <a className="link" href="https://github.com/settings/tokens/new?scopes=gist&description=bai.kun" target="_blank" rel="noopener">создание ключа на GitHub</a> (галочка «gist» уже стоит).</li>
              <li>В «Expiration» выбери <b>No expiration</b>, внизу нажми <b>Generate token</b>.</li>
              <li>Скопируй ключ (начинается с <code>ghp_</code>) и вставь сюда.</li>
            </ol>
            <form className="row" onSubmit={(e) => { e.preventDefault(); gh.connect(token); setToken(''); }}>
              <input className="search" type="password" autoComplete="off" placeholder="ghp_…" value={token} onChange={(e) => setToken(e.target.value)} style={{ marginBottom: 0 }} />
              <button className="btn primary" disabled={!token.trim() || gh.status === 'connecting'}>{gh.status === 'connecting' ? 'Подключаю…' : 'Подключить'}</button>
            </form>
          </>
        )}
        {gh.error && <p className="warn">{gh.error}</p>}
      </section>
      {cloudConfigured && (
      <section className="panel form">
          <span className="eyebrow">Аккаунт</span>
          <h3>Сохранение прогресса</h3>
          {cloud.user ? (
            <div className="sync">
              {cloud.user.photo && <img className="avatar" src={cloud.user.photo} alt="" referrerPolicy="no-referrer" />}
              <div>
                <div>{cloud.user.name || cloud.user.email}</div>
                <div className="sync-state">{cloud.status === 'syncing' ? 'Синхронизирую…' : cloud.status === 'error' ? 'Ошибка синхронизации' : `Синхронизировано${cloud.syncedAt ? ' · ' + cloud.syncedAt.toLocaleTimeString().slice(0, 5) : ''}`}</div>
              </div>
              <div className="row">
                <button className="btn" onClick={() => cloud.syncNow()}>Синхронизировать</button>
                <button className="btn" onClick={() => cloud.signOut()}>Выйти</button>
              </div>
            </div>
          ) : (
            <>
              <p className="muted small">Войди через Google — прогресс, карточки и тоны будут сохраняться в облаке и появятся на любом устройстве, где ты войдёшь.</p>
              <button className="btn primary g-btn" onClick={() => cloud.signIn()}>
                <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                Войти через Google
              </button>
            </>
          )}
          {cloud.error && <p className="warn">{cloud.error}</p>}
        </section>
      )}
      <section className="panel form">
        <span className="eyebrow">iPhone</span>
        <h3>Установить как приложение</h3>
        <ol className="install-steps">
          <li>Открой сайт в <b>Safari</b>.</li>
          <li>Нажми кнопку «Поделиться» (квадрат со стрелкой вверх).</li>
          <li>Выбери <b>«На экран „Домой“»</b> → «Добавить».</li>
        </ol>
        <p className="muted small">bai.kun откроется на весь экран, как обычное приложение. {cloudConfigured ? 'Войди там через Google, чтобы подтянуть прогресс.' : ''}</p>
      </section>
      <section className="panel form">
        <h3>Голос</h3>
        <VoiceWarning />
        <label>Голос озвучки
          <select value={state.settings.voiceURI ?? ''} onChange={(e) => actions.setSettings({ voiceURI: e.target.value || null })}>
            <option value="">Автоматически</option>{voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
          </select></label>
        <label>Скорость речи: {state.settings.rate.toFixed(2)}
          <input type="range" min={0.5} max={1.2} step={0.05} value={state.settings.rate} onChange={(e) => actions.setSettings({ rate: +e.target.value })} /></label>
        <button className="btn" onClick={() => say('你好，欢迎！')}>Проверить голос</button>
      </section>
      <section className="panel form">
        <h3>Обучение</h3>
        <label className="check"><input type="checkbox" checked={state.settings.showPinyin} onChange={(e) => actions.setSettings({ showPinyin: e.target.checked })} /> Показывать пиньинь в вопросах «Что значит?»</label>
      </section>
      <section className="panel form">
        <h3>Прогресс</h3>
        <p className="muted small">Прогресс хранится на этом устройстве. Сохрани файл, чтобы перенести его на другой телефон или не потерять при очистке Safari.</p>
        <div className="row">
          <button className="btn" onClick={exportAll}>Сохранить в файл</button>
          <button className="btn" onClick={() => file.current?.click()}>Загрузить из файла</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importAll(e.target.files[0])} />
        </div>
        {msg && <p className="small">{msg}</p>}
        <button className="btn danger" onClick={() => { if (confirm('Удалить весь прогресс курса?')) actions.reset(); }}>Сбросить прогресс курса</button>
      </section>
      <p className="muted small">bai.kun · курс: {LESSONS.length} уроков · карточек: {Object.keys(state.cards).length}</p>
      <Bar value={LESSONS.filter((l) => state.lessons[l.id]?.doneAt).length / LESSONS.length} />
    </div>
  );
}
