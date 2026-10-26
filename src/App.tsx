import { useEffect, useState } from 'react';
import { useCourse, dueCards } from './course/store';
import { useCloud, cloudConfigured } from './course/cloud';
import { CourseCtx, useRoute } from './course/ui';
import Lesson from './course/Lesson';
import Tones from './course/Tones';
import { Cards, Course, Dashboard, Grammar, Hanzi, Pinyin, Settings } from './course/Pages';

const NAV: { href: string; key: string; label: string; zh: string; main?: boolean }[] = [
  { href: '#/', key: '', label: 'Главная', zh: '家', main: true },
  { href: '#/course', key: 'course', label: 'Курс', zh: '课', main: true },
  { href: '#/cards', key: 'cards', label: 'Карточки', zh: '卡', main: true },
  { href: '#/pinyin', key: 'pinyin', label: 'Пиньинь', zh: '拼' },
  { href: '#/tones', key: 'tones', label: 'Тоны', zh: '声' },
  { href: '#/grammar', key: 'grammar', label: 'Грамматика', zh: '法' },
  { href: '#/hanzi', key: 'hanzi', label: 'Иероглифы', zh: '字', main: true },
  { href: '#/settings', key: 'settings', label: 'Настройки', zh: '设' },
];

export default function App() {
  const { state, actions } = useCourse();
  const cloud = useCloud(state, actions.replace);
  const route = useRoute();
  const [more, setMore] = useState(false);

  /*
   * Earlier builds registered a cache-first service worker that kept serving a
   * dead bundle. Any leftover worker and its caches are removed on load.
   */
  useEffect(() => {
    navigator.serviceWorker?.getRegistrations().then((r) => r.forEach((x) => x.unregister())).catch(() => {});
    if ('caches' in window) caches.keys().then((k) => k.forEach((x) => caches.delete(x))).catch(() => {});
    document.documentElement.dataset.theme = 'dark';
    // Ask the browser not to evict saved progress under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
  }, []);
  useEffect(() => setMore(false), [route]);

  const head = route[0] ?? '';
  const active = head === 'lesson' ? 'course' : head;
  const due = state ? dueCards(state.cards).length : 0;

  let page = null;
  if (state) {
    switch (head) {
      case 'course': page = <Course />; break;
      case 'lesson': page = <Lesson id={route[1]} step={Number(route[2]) || 1} />; break;
      case 'cards': page = <Cards />; break;
      case 'pinyin': page = <Pinyin />; break;
      case 'tones': page = <Tones />; break;
      case 'grammar': page = <Grammar />; break;
      case 'hanzi': page = <Hanzi char={route[1]} />; break;
      case 'settings': page = <Settings />; break;
      default: page = <Dashboard />;
    }
  }

  return (
    <div className="x">
      <div className="stars" aria-hidden="true" />
      <header className="x-top">
        <a className="x-logo" href="../" aria-label="bai.kun — на главную">bai<i>.kun</i></a>
        <nav className="x-nav" aria-label="Разделы">
          {NAV.map((n) => <a key={n.key} href={n.href} aria-current={active === n.key ? 'page' : undefined}>{n.label}{n.key === 'cards' && due > 0 && <span className="pill">{due}</span>}</a>)}
        </nav>
        {state && <span className="x-streak" title="Дней подряд">🔥 {state.streak}</span>}
        {cloudConfigured && (
          <a className="x-account" href="#/settings" title={cloud.user ? `Синхронизация: ${cloud.user.email}` : 'Войти через Google'}>
            {cloud.user?.photo ? <img src={cloud.user.photo} alt="" referrerPolicy="no-referrer" /> : <span>{cloud.user ? '☁︎' : 'Войти'}</span>}
          </a>
        )}
      </header>

      <main className="x-main">
        {state ? <CourseCtx.Provider value={{ state, actions, cloud }}>{page}</CourseCtx.Provider> : <div className="page"><div className="sk-block" /></div>}
      </main>

      <nav className="x-tabs" aria-label="Разделы">
        {NAV.filter((n) => n.main).map((n) => (
          <a key={n.key} href={n.href} aria-current={active === n.key ? 'page' : undefined}>
            <span className="zh">{n.zh}</span><span>{n.label}</span>{n.key === 'cards' && due > 0 && <span className="pill">{due}</span>}
          </a>
        ))}
        <button type="button" className={more ? 'on' : ''} aria-expanded={more} onClick={() => setMore(!more)}><span className="zh">多</span><span>Ещё</span></button>
      </nav>
      {more && (
        <div className="x-sheet" role="dialog" aria-label="Другие разделы" onClick={() => setMore(false)}>
          <div className="x-sheet-in" onClick={(e) => e.stopPropagation()}>
            {NAV.filter((n) => !n.main).map((n) => <a key={n.key} href={n.href} aria-current={active === n.key ? 'page' : undefined}><span className="zh">{n.zh}</span>{n.label}</a>)}
            <a href="../"><span className="zh">星</span>Главная страница</a>
          </div>
        </div>
      )}
    </div>
  );
}
