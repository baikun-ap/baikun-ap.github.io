import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppState } from '../lib/types';
import type { Drill } from '../lib/drill';
import { planSession } from '../lib/drill';
import { gradeChoice, gradeSpoken } from '../lib/srs';
import { TONE_NAMES, type Tone } from '../lib/pinyin';
import { t as tx } from '../i18n';
import { BY_CHAR } from '../lib/syllables';
import { gloss } from '../lib/format';
import ToneStaff from './ToneStaff';
import Speaker, { VoiceNotice } from './Speaker';
import SayTone from './SayTone';

interface Props {
  state: AppState;
  onAnswer: (drill: Drill, quality: number) => void;
  onFinish: () => void;
  onExit: () => void;
}

interface Tally { seen: number; right: number; }

export default function Session({ state, onAnswer, onFinish, onExit }: Props) {
  // Planned once: the queue must not reshuffle when state updates mid-session.
  const plan = useMemo(() => planSession(state), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [tally, setTally] = useState<Tally>({ seen: 0, right: 0 });
  const [answered, setAnswered] = useState<{ picked: string | null; correct: boolean } | null>(null);
  const shownAt = useRef(performance.now());

  const drill = plan.drills[i];
  const done = i >= plan.drills.length;

  useEffect(() => {
    shownAt.current = performance.now();
    setAnswered(null);
  }, [i]);

  useEffect(() => {
    if (done) onFinish();
  }, [done, onFinish]);

  if (!plan.drills.length) {
    return (
      <div className="stack">
        <div className="card">
          <h2>{tx('На сегодня всё', 'That is all for today')}</h2>
          <p className="subtle">{tx('Повторений не осталось, а новые слоги закончились в настройках. Вернись завтра или подними дневной лимит.', 'No reviews left and the daily limit for new syllables is used up. Come back tomorrow or raise the limit.')}</p>
          <button className="btn" onClick={onExit}>{tx('На главную', 'Back')}</button>
        </div>
      </div>
    );
  }

  if (done) {
    const pct = tally.seen ? Math.round((tally.right / tally.seen) * 100) : 0;
    return (
      <div className="stack">
        <div className="card">
          <p className="eyebrow">{tx('Занятие закончено', 'Session complete')}</p>
          <h1>{tally.right} {tx('из', 'of')} {tally.seen}</h1>
          <p className="subtle">{tx(`Точность ${pct}%. Новых слогов за сессию: ${plan.introduced.length}.`, `Accuracy ${pct}%. New syllables this session: ${plan.introduced.length}.`)}</p>
          <div className="row" style={{ marginTop: '1rem' }}>
            <button className="btn primary" onClick={onExit}>{tx('На главную', 'Back')}</button>
          </div>
        </div>
      </div>
    );
  }

  const record = (quality: number, correct: boolean) => {
    onAnswer(drill, quality);
    setTally((t) => ({ seen: t.seen + 1, right: t.right + (correct ? 1 : 0) }));
  };

  const advance = () => setI((n) => n + 1);

  return (
    <div className="stage">
      <div className="stage-head">
        <button className="btn ghost sm" onClick={onExit}>← {tx('Выйти', 'Exit')}</button>
        <div className="progress-track" role="progressbar" aria-valuenow={i} aria-valuemin={0} aria-valuemax={plan.drills.length}>
          <div className="progress-fill" style={{ width: `${(i / plan.drills.length) * 100}%` }} />
        </div>
        <span className="badge num">{i + 1}/{plan.drills.length}</span>
      </div>

      <VoiceNotice />

      {drill.kind === 'hearTone' && (
        <HearTone
          key={`${drill.cardId}-${i}`}
          drill={drill}
          state={state}
          answered={answered}
          onPick={(tone, ms) => {
            const correct = Number(tone) === drill.syllable.tone;
            setAnswered({ picked: tone, correct });
            record(gradeChoice(correct, false, ms), correct);
          }}
          onNext={advance}
        />
      )}

      {drill.kind === 'minimalPair' && (
        <MinimalPair
          key={`${drill.cardId}-${i}`}
          drill={drill}
          state={state}
          answered={answered}
          onPick={(id, ms) => {
            const correct = id === drill.syllable.id;
            setAnswered({ picked: id, correct });
            record(gradeChoice(correct, false, ms), correct);
          }}
          onNext={advance}
        />
      )}

      {drill.kind === 'readPinyin' && (
        <ReadPinyin
          key={`${drill.cardId}-${i}`}
          drill={drill}
          state={state}
          answered={answered}
          onPick={(id, ms) => {
            const correct = id === drill.syllable.id;
            setAnswered({ picked: id, correct });
            record(gradeChoice(correct, false, ms), correct);
          }}
          onNext={advance}
        />
      )}

      {drill.kind === 'sayTone' && (
        <SayStage
          key={`${drill.cardId}-${i}`}
          drill={drill}
          state={state}
          onDone={(passed, confidence, retries) => record(gradeSpoken(confidence, passed, retries), passed)}
          onNext={advance}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function DrillHint({ text }: { text: string }) {
  return <p className="eyebrow" style={{ textAlign: 'center' }}>{text}</p>;
}

function NextButton({ onNext, label = tx('Дальше', 'Next') }: { onNext: () => void; label?: string }) {
  return (
    <div className="row" style={{ justifyContent: 'center' }}>
      <button className="btn primary" onClick={onNext} autoFocus>{label} →</button>
    </div>
  );
}

type Answered = { picked: string | null; correct: boolean } | null;

interface StageProps<D> {
  drill: D;
  state: AppState;
  answered: Answered;
  onPick: (value: string, ms: number) => void;
  onNext: () => void;
}

function HearTone({ drill, state, answered, onPick, onNext }: StageProps<Extract<Drill, { kind: 'hearTone' }>>) {
  const start = useRef(performance.now());
  const { profile } = state;

  return (
    <>
      <DrillHint text={tx('Послушай и определи тон', 'Listen and name the tone')} />
      <div className="prompt">
        <Speaker
          text={drill.char}
          voiceURI={profile.ttsVoice}
          rate={profile.ttsRate}
          autoPlayKey={drill.cardId}
          label={tx('Ещё раз', 'Again')}
          className="big"
        />
        {answered && (
          <>
            <div className={`prompt-char zh tone-${drill.syllable.tone}`}>{drill.char}</div>
            <div className={`prompt-py py tone-${drill.syllable.tone}`}>{drill.syllable.marked}</div>
          </>
        )}
      </div>

      <div className="tone-grid">
        {drill.options.map((t) => {
          const picked = answered?.picked === String(t);
          const isRight = t === drill.syllable.tone;
          const cls = !answered ? '' : isRight ? 'right' : picked ? 'wrong' : '';
          return (
            <button
              key={t}
              className={`tone-btn tone-${t} ${cls}`}
              disabled={Boolean(answered)}
              onClick={() => onPick(String(t), performance.now() - start.current)}
            >
              <ToneStaff size="glyph" tone={t as Tone} solo label={`${tx('Тон', 'Tone')} ${t}`} />
              <span className="n">{t}</span>
              <span className="name">{TONE_NAMES[t as Tone]}</span>
            </button>
          );
        })}
      </div>

      {answered && <NextButton onNext={onNext} />}
    </>
  );
}

function MinimalPair({ drill, state, answered, onPick, onNext }: StageProps<Extract<Drill, { kind: 'minimalPair' }>>) {
  const start = useRef(performance.now());
  const { profile } = state;

  return (
    <>
      <DrillHint text={tx('Один слог — разные тоны. Что прозвучало?', 'One syllable, different tones. Which one was it?')} />
      <div className="prompt">
        <Speaker
          text={drill.char}
          voiceURI={profile.ttsVoice}
          rate={profile.ttsRate}
          autoPlayKey={drill.cardId}
          label={tx('Ещё раз', 'Again')}
          className="big"
        />
        <p className="tiny" style={{ margin: 0 }}>{tx('основа', 'base')} «{drill.syllable.base}»</p>
      </div>

      <div className="choices">
        {drill.options.map((o) => {
          const picked = answered?.picked === o.id;
          const isRight = o.id === drill.syllable.id;
          const cls = !answered ? '' : isRight ? 'right' : picked ? 'wrong' : '';
          return (
            <button
              key={o.id}
              className={`choice tone-${o.tone} ${cls}`}
              disabled={Boolean(answered)}
              onClick={() => onPick(o.id, performance.now() - start.current)}
            >
              <span className="py" style={{ color: 'var(--tone)' }}>{o.marked}</span>
              <span className="tn">{o.tone === 5 ? '·' : o.tone}</span>
              {answered && <span className="zh">{o.chars[0]}</span>}
            </button>
          );
        })}
      </div>

      {answered && <NextButton onNext={onNext} />}
    </>
  );
}

function ReadPinyin({ drill, state, answered, onPick, onNext }: StageProps<Extract<Drill, { kind: 'readPinyin' }>>) {
  const start = useRef(performance.now());
  const h = BY_CHAR.get(drill.char);

  return (
    <>
      <DrillHint text={tx('Как читается этот иероглиф?', 'How is this character read?')} />
      <div className="prompt">
        <div className="prompt-char zh">{drill.char}</div>
        {answered && h && <p className="prompt-gloss">{gloss(h)}</p>}
      </div>

      <div className="choices">
        {drill.options.map((o) => {
          const picked = answered?.picked === o.id;
          const isRight = o.id === drill.syllable.id;
          const cls = !answered ? '' : isRight ? 'right' : picked ? 'wrong' : '';
          return (
            <button
              key={o.id}
              className={`choice tone-${o.tone} ${cls}`}
              disabled={Boolean(answered)}
              onClick={() => onPick(o.id, performance.now() - start.current)}
            >
              <span className="py" style={{ color: 'var(--tone)' }}>{o.marked}</span>
              <span className="tn">{o.tone === 5 ? '·' : o.tone}</span>
            </button>
          );
        })}
      </div>

      {answered && (
        <>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Speaker text={drill.char} voiceURI={state.profile.ttsVoice} rate={state.profile.ttsRate} label={tx('Послушать', 'Listen')} className="ghost sm" />
          </div>
          <NextButton onNext={onNext} />
        </>
      )}
    </>
  );
}

function SayStage({
  drill,
  state,
  onDone,
  onNext,
}: {
  drill: Extract<Drill, { kind: 'sayTone' }>;
  state: AppState;
  onDone: (passed: boolean, confidence: number, retries: number) => void;
  onNext: () => void;
}) {
  const [attempted, setAttempted] = useState(false);
  const h = BY_CHAR.get(drill.char);

  return (
    <>
      <DrillHint text={tx('Произнеси вслух', 'Say it out loud')} />
      <div className="prompt">
        <div className={`prompt-char zh sm tone-${drill.syllable.tone}`}>{drill.char}</div>
        <div className={`prompt-py py tone-${drill.syllable.tone}`}>{drill.syllable.marked}</div>
        {h && <p className="prompt-gloss">{gloss(h)}</p>}
        <Speaker text={drill.char} voiceURI={state.profile.ttsVoice} rate={state.profile.ttsRate} label={tx('Как звучит', 'How it sounds')} className="ghost sm" />
      </div>

      <SayTone
        syllable={drill.syllable}
        strictness={state.profile.sayStrictness}
        onDone={(passed, confidence, retries) => {
          if (!attempted) {
            setAttempted(true);
            onDone(passed, confidence, retries);
          }
        }}
      />

      <NextButton onNext={onNext} label={attempted ? tx('Дальше', 'Next') : tx('Пропустить', 'Skip')} />
    </>
  );
}
