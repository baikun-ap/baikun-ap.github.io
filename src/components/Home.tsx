import { useMemo } from 'react';
import type { AppState } from '../lib/types';
import { dueCards, maturity } from '../lib/srs';
import { attemptQuota, newQuota, pickNewSyllables, DRILL_NAMES, type DrillKind } from '../lib/drill';
import { TONE_NAMES, TONE_CONTOUR, type Tone } from '../lib/pinyin';
import { t as tx } from '../i18n';
import { levelFromXp } from '../lib/format';
import { today, addDays } from '../lib/date';
import ToneStaff from './ToneStaff';
import { VoiceNotice } from './Speaker';

interface Props {
  state: AppState;
  onStart: () => void;
}

export default function Home({ state, onStart }: Props) {
  const { profile } = state;
  const due = useMemo(() => dueCards(state.cards), [state.cards]);
  const fresh = useMemo(
    () => pickNewSyllables(state, newQuota(profile.sessionMinutes, profile.dailyNewCap)),
    [state, profile.sessionMinutes, profile.dailyNewCap],
  );
  const { level, into, span } = levelFromXp(profile.xp);
  const enabled = (Object.keys(profile.drills) as DrillKind[]).filter((k) => profile.drills[k]);

  const counts = useMemo(() => {
    const all = Object.values(state.cards);
    return {
      total: all.length,
      mature: all.filter((c) => maturity(c) === 'mature').length,
      young: all.filter((c) => maturity(c) === 'young').length,
      learning: all.filter((c) => maturity(c) === 'learning' || maturity(c) === 'new').length,
    };
  }, [state.cards]);

  const earAccuracy = useMemo(() => {
    const all = Object.values(state.cards);
    const ok = all.reduce((s, c) => s + c.earOk, 0);
    const total = all.reduce((s, c) => s + c.earTotal, 0);
    return total ? Math.round((ok / total) * 100) : null;
  }, [state.cards]);

  const sayAccuracy = useMemo(() => {
    const all = Object.values(state.cards);
    const ok = all.reduce((s, c) => s + c.sayOk, 0);
    const total = all.reduce((s, c) => s + c.sayTotal, 0);
    return total ? Math.round((ok / total) * 100) : null;
  }, [state.cards]);

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">{tx('Мандарин · тоны и пиньинь', 'Mandarin · tones and pinyin')}</p>
        <h1>{greeting(due.length, fresh.length)}</h1>
        <p className="lede">
          {due.length
            ? tx(`${due.length} ${plural(due.length, 'повторение', 'повторения', 'повторений')} готово`, `${due.length} ${due.length === 1 ? 'review' : 'reviews'} ready`)
            : tx('Повторений на сегодня нет', 'No reviews for today')}
          {fresh.length ? ` · ${tx(`${fresh.length} ${plural(fresh.length, 'новый слог', 'новых слога', 'новых слогов')}`, `${fresh.length} new ${fresh.length === 1 ? 'syllable' : 'syllables'}`)}` : ''}
          {' · '}{tx(`до ${attemptQuota(profile.sessionMinutes)} ответов за ${profile.sessionMinutes} мин`, `up to ${attemptQuota(profile.sessionMinutes)} answers in ${profile.sessionMinutes} min`)}
        </p>
        <button className="btn primary big" onClick={onStart}>{tx('Начать занятие', 'Start a session')}</button>
      </div>

      <VoiceNotice />

      <section className="card">
        <div className="row between" style={{ marginBottom: '.9rem' }}>
          <h2 style={{ margin: 0 }}>{tx('Четыре тона', 'The four tones')}</h2>
          <span className="tiny">{tx('контур высоты голоса по пятиуровневой шкале', 'pitch contour on a five-level scale')}</span>
        </div>
        <div className="tone-grid">
          {([1, 2, 3, 4] as Tone[]).map((t) => (
            <div key={t} className={`tone-btn tone-${t}`} style={{ cursor: 'default' }}>
              <ToneStaff size="glyph" tone={t} solo label={`${tx('Тон', 'Tone')} ${t}: ${TONE_NAMES[t]}`} />
              <span className="n">{t} · {TONE_CONTOUR[t]}</span>
              <span className="name">{TONE_NAMES[t]}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid three">
        <div className="card stat">
          <span className="v">{profile.streak}</span>
          <span className="k">{tx('дней подряд · рекорд', 'day streak · best')} {profile.bestStreak}</span>
        </div>
        <div className="card stat">
          <span className="v">{level}</span>
          <span className="k">{tx('уровень', 'level')} · {into}/{span} XP</span>
        </div>
        <div className="card stat">
          <span className="v">{counts.total}</span>
          <span className="k">{tx('карточек в колоде', 'cards in the deck')}</span>
        </div>
      </div>

      <div className="grid two">
        <section className="card">
          <h3>{tx('Точность', 'Accuracy')}</h3>
          <Bar label={tx('На слух', 'By ear')} value={earAccuracy} tone={1} />
          <Bar label={tx('Голосом', 'By voice')} value={sayAccuracy} tone={2} />
          <p className="tiny" style={{ marginTop: '.6rem', marginBottom: 0 }}>
            {tx('«Голосом» считает микрофон по контуру высоты — не по распознаванию слов.', '“By voice” is measured by the microphone from the pitch contour, not by word recognition.')}
          </p>
        </section>

        <section className="card">
          <h3>{tx('Колода', 'Deck')}</h3>
          <Bar label={tx('Зрелые', 'Mature')} value={pct(counts.mature, counts.total)} tone={2} />
          <Bar label={tx('Молодые', 'Young')} value={pct(counts.young, counts.total)} tone={3} />
          <Bar label={tx('В работе', 'Learning')} value={pct(counts.learning, counts.total)} tone={4} />
        </section>
      </div>

      <section className="card">
        <h3>{tx('Ближайшая неделя', 'Next 7 days')}</h3>
        <Forecast cards={state.cards} />
      </section>

      <p className="tiny">
        {tx('Включены упражнения', 'Drills on')}: {enabled.map((k) => DRILL_NAMES[k]).join(' · ') || '—'}
      </p>
    </div>
  );
}

function pct(part: number, total: number): number | null {
  return total ? Math.round((part / total) * 100) : null;
}

function Bar({ label, value, tone }: { label: string; value: number | null; tone: Tone }) {
  return (
    <div className={`bar-row tone-${tone}`}>
      <span className="tiny">{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${value ?? 0}%` }} />
      </div>
      <span className="bar-val">{value === null ? '—' : `${value}%`}</span>
    </div>
  );
}

function Forecast({ cards }: { cards: AppState['cards'] }) {
  const days = useMemo(() => {
    const start = today();
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i);
      const n = Object.values(cards).filter((c) => (i === 0 ? c.due <= day : c.due === day)).length;
      return { day, n };
    });
  }, [cards]);
  const max = Math.max(1, ...days.map((d) => d.n));

  return (
    <div style={{ display: 'grid', gap: '.35rem' }}>
      {days.map((d, i) => (
        <div key={d.day} className="bar-row tone-1">
          <span className="tiny num">{i === 0 ? tx('сегодня', 'today') : d.day.slice(5)}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.n / max) * 100}%` }} />
          </div>
          <span className="bar-val">{d.n}</span>
        </div>
      ))}
    </div>
  );
}

function greeting(due: number, fresh: number): string {
  if (due === 0 && fresh === 0) return tx('Всё повторено', 'All caught up');
  if (due === 0) return tx('Пора за новые слоги', 'Time for new syllables');
  if (due > 40) return tx('Накопилось повторений', 'Reviews have piled up');
  return tx('Готов слушать', 'Ready to listen');
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
