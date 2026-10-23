import { useEffect, useState } from 'react';
import { GRADES, previewInterval, type Grade, type WordCard } from './store';
import { Py, Say, useCourseCtx } from './ui';

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
        <p>Повторение закончено: {doneN} {doneN === 1 ? 'карточка' : 'карточек'}.</p>
        {onFinish && <button className="btn primary" onClick={onFinish}>Готово</button>}
      </div>
    );
  }

  return (
    <div className="review">
      <div className="muted small center-text">Осталось: {queue.length}</div>
      <button type="button" className={`flash ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(true)} aria-label="Перевернуть карточку">
        <div className="flash-front">
          {front === 'zh' ? <div className="zh-xxl">{card.zh}</div> : <div className="q-ru">{card.ru}</div>}
          {!flipped && <span className="muted small">Вспомни и нажми, чтобы перевернуть</span>}
        </div>
        {flipped && (
          <div className="flash-back">
            {front === 'zh' ? <div className="q-ru">{card.ru}</div> : <div className="zh-xxl">{card.zh}</div>}
            <Py text={card.py} className="py-l" />
          </div>
        )}
      </button>
      {flipped ? (
        <>
          <div className="row center"><Say text={card.zh} auto={card.id} label="Прослушать" /></div>
          <div className="grades">
            {GRADES.map((g) => (
              <button key={g.g} className={`grade g${g.g}`} onClick={() => grade(g.g)}>
                <span>{g.label}</span><span className="small">{previewInterval(card, g.g)}</span>
              </button>
            ))}
          </div>
        </>
      ) : <div className="row center"><button className="btn primary" onClick={() => setFlipped(true)}>Показать ответ</button></div>}
    </div>
  );
}
