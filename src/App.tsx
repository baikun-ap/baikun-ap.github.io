import { useEffect, useState } from 'react';
import { useCourse, dueCards } from './course/store';
import { useCloud, cloudConfigured } from './course/cloud';
import { useGithubSync } from './course/ghsync';
import { CourseCtx, useRoute } from './course/ui';
import Lesson from './course/Lesson';
import Tones from './course/Tones';
import { Cards, Course, Dashboard, Grammar, Hanzi, Pinyin, Settings } from './course/Pages';
import { setLang, t, useLang } from './i18n';

const nav = (): { href: string; key: string; label: string; zh: string; main?: boolean }[] => [
  { href: '#/', key: '', label: t('Главная', 'Home'), zh: '家', main: true },
  { href: '#/course', key: 'course', label: t('Курс', 'Course'), zh: '课', main: true },
  { href: '#/cards', key: 'cards', label: t('Карточки', 'Cards'), zh: '卡', main: true },
  { href: '#/pinyin', key: 'pinyin', label: t('Пиньинь', 'Pinyin'), zh: '拼' },
  { href: '#/tones', key: 'tones', label: t('Тоны', 'Tones'), zh: '声' },
  { href: '#/grammar', key: 'grammar', label: t('Грамматика', 'Grammar'), zh: '法' },
  { href: '#/hanzi', key: 'hanzi', label: t('Иероглифы', 'Characters'), zh: '字', main: true },
  { href: '#/settings', key: 'settings', label: t('Настройки', 'Settings'), zh: '设' },
];

export default function App() {
  const { state, actions } = useCourse();
  const cloud = useCloud(state, actions.replace);
  const gh = useGithubSync(state, actions.replace);
  const route = useRoute();
  const [more, setMore] = useState(false);
  const lang = useLang();
  const NAV = nav();

  /*
   * Earlier builds registered a cache-first service worker that kept serving a
   * dead bundle. Any leftover worker and its caches are removed on load.
   */
  useEffect(() => {
    navigator.serviceWorker?.getRegistrations().then((r) => r.forEach((x) => x.unregister())).catch(() => {});
    if ('caches' in window) caches.keys().then((k) => k.forEach((x) => caches.delete(x))).catch(() => {});
    // Ask the browser not to evict saved progress under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
  }, []);
  useEffect(() => setMore(false), [route]);
  useEffect(() => { document.title = t('bai.kun (baikun) — курс китайского', 'bai.kun (baikun) — Chinese course'); }, [lang]);

  // Light or dark: the learner's choice, or the system's when set to auto.
  const themePref = state?.settings.theme ?? 'auto';
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq?.addEventListener('change', on);
    return () => mq?.removeEventListener('change', on);
  }, []);
  const theme = themePref === 'auto' ? (systemDark ? 'dark' : 'light') : themePref;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#161617' : '#ffffff');
    try { localStorage.setItem('baikun-theme', theme); } catch { /* ignore */ }
  }, [theme]);

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
        <a className="x-logo" href="../" aria-label={t('bai.kun — на главную', 'bai.kun — home page')}>bai<i>.kun</i></a>
        <nav className="x-nav" aria-label={t('Разделы', 'Sections')}>
          {NAV.map((n) => <a key={n.key} href={n.href} aria-current={active === n.key ? 'page' : undefined}>{n.label}{n.key === 'cards' && due > 0 && <span className="pill">{due}</span>}</a>)}
        </nav>
        {state && <span className="x-streak" title={t('Дней подряд', 'Day streak')}>🔥 {state.streak}</span>}
        <button type="button" className="lang-btn" onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
          aria-label={t('Switch to English', 'Переключить на русский')} title={t('Switch to English', 'Переключить на русский')}>{lang === 'en' ? 'RU' : 'EN'}</button>
        {state && (
          <button type="button" className="theme-btn" aria-label={theme === 'dark' ? t('Светлая тема', 'Light theme') : t('Тёмная тема', 'Dark theme')} title={theme === 'dark' ? t('Светлая тема', 'Light theme') : t('Тёмная тема', 'Dark theme')}
            onClick={() => actions.setSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}>
            {theme === 'dark'
              ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>}
          </button>
        )}
        {gh.connected && <a className="x-account" href="#/settings" title={t(`Прогресс синхронизируется с GitHub: ${gh.login}`, `Progress syncs with GitHub: ${gh.login}`)}><span>{gh.status === 'syncing' ? '⟳' : gh.status === 'error' ? '!' : '☁︎'}</span></a>}
        {cloudConfigured && (
          <a className="x-account" href="#/settings" title={cloud.user ? t(`Синхронизация: ${cloud.user.email}`, `Sync: ${cloud.user.email}`) : t('Войти через Google', 'Sign in with Google')}>
            {cloud.user?.photo ? <img src={cloud.user.photo} alt="" referrerPolicy="no-referrer" /> : <span>{cloud.user ? '☁︎' : t('Войти', 'Sign in')}</span>}
          </a>
        )}
      </header>

      <main className="x-main">
        {state ? <CourseCtx.Provider value={{ state, actions, cloud, gh }}>{page}</CourseCtx.Provider> : <div className="page"><div className="sk-block" /></div>}
      </main>

      <nav className="x-tabs" aria-label={t('Разделы', 'Sections')}>
        {NAV.filter((n) => n.main).map((n) => (
          <a key={n.key} href={n.href} aria-current={active === n.key ? 'page' : undefined}>
            <span className="zh">{n.zh}</span><span>{n.label}</span>{n.key === 'cards' && due > 0 && <span className="pill">{due}</span>}
          </a>
        ))}
        <button type="button" className={more ? 'on' : ''} aria-expanded={more} onClick={() => setMore(!more)}><span className="zh">多</span><span>{t('Ещё', 'More')}</span></button>
      </nav>
      {more && (
        <div className="x-sheet" role="dialog" aria-label={t('Другие разделы', 'Other sections')} onClick={() => setMore(false)}>
          <div className="x-sheet-in" onClick={(e) => e.stopPropagation()}>
            {NAV.filter((n) => !n.main).map((n) => <a key={n.key} href={n.href} aria-current={active === n.key ? 'page' : undefined}><span className="zh">{n.zh}</span>{n.label}</a>)}
            <a href="../"><span className="zh">星</span>{t('Главная страница', 'Landing page')}</a>
          </div>
        </div>
      )}
    </div>
  );
}
