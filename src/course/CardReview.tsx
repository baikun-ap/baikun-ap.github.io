import { useEffect, useState } from 'react';
import { GRADES, previewInterval, type Grade, type WordCard } from './store';
import { Py, Say, useCourseCtx } from './ui';
import { L, plural, t } from '../i18n';

/**
 * Flashcard review: see the front, recall, flip, grade honestly. The queue is
 * fixed when the review starts; a card graded «Снова» comes back at the end.
 */
export default function CardReview({ cards, onFinish }: { cards: WordCard[]; onFinish?: () => void }) {
  const { state, actions } = useCourseCtx();
  const [queue, setQueue] = useState(() => cards.map((c) => c.id));
  const [flipped, setFlipped] = useState(false);
  const [doneN, setDoneN] = useState(0);
  const front = state.settings.cardFront;
  const card = queue.length ? state.cards[queue[0]] : undefined;

  const grade = (g: Grade) => {
    if (!card) return;
    actions.grade(card.id, g);
    setFlipped(false);
    setQueue((q) => (g === 1 ? [...q.slice(1), q[0]] : q.slice(1)));
    if (g !== 1) setDoneN((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(true); }
      const g = GRADES.find((x) => x.key === e.key);
      if (g && flipped) grade(g.g);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!card) {
    return (
      <div className="result">
        <div className="result-num">✓</div>
        <p>{t(`Повторение закончено: ${doneN} ${plural(doneN, 'карточка', 'карточки', 'карточек')}.`, `Review finished: ${doneN} ${doneN === 1 ? 'card' : 'cards'}.`)}</p>
        {onFinish && <button className="btn primary" onClick={onFinish}>{t('Готово', 'Done')}</button>}
      </div>
    );
  }

  return (
    <div className="review">
      <div className="muted small center-text">{t('Осталось', 'Left')}: {queue.length}</div>
      <button type="button" className={`flash ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(true)} aria-label={t('Перевернуть карточку', 'Flip the card')}>
        <div className="flash-front">
          {front === 'zh' ? <div className="zh-xxl">{card.zh}</div> : <div className="q-ru">{L(card.ru)}</div>}
          {!flipped && <span className="muted small">{t('Вспомни и нажми, чтобы перевернуть', 'Recall it, then tap to flip')}</span>}
        </div>
        {flipped && (
          <div className="flash-back">
            {front === 'zh' ? <div className="q-ru">{L(card.ru)}</div> : <div className="zh-xxl">{card.zh}</div>}
            <Py text={card.py} className="py-l" />
          </div>
        )}
      </button>
      {flipped ? (
        <>
          <div className="row center"><Say text={card.zh} auto={card.id} label={t('Прослушать', 'Listen')} /></div>
          <div className="grades">
            {GRADES.map((g) => (
              <button key={g.g} className={`grade g${g.g}`} onClick={() => grade(g.g)}>
                <span>{t(g.label, g.en)}</span><span className="small">{previewInterval(card, g.g)}</span>
              </button>
            ))}
          </div>
        </>
      ) : <div className="row center"><button className="btn primary" onClick={() => setFlipped(true)}>{t('Показать ответ', 'Show answer')}</button></div>}
    </div>
  );
}
