import { useState } from 'react';
import { t } from '../i18n';
import { useAppState } from '../lib/store';
import Home from '../components/Home';
import Session from '../components/Session';
import Library from '../components/Library';
import ToneSettings from '../components/Settings';

/**
 * The earlier tone trainer, kept whole: hearing tones, minimal pairs and the
 * pitch tracker that draws your voice against the model contour.
 */
export default function Tones() {
  const { state, actions } = useAppState();
  const [tab, setTab] = useState<'home' | 'session' | 'library' | 'settings'>('home');
  if (!state) return <div className="page"><p className="muted">{t('Загружаю…', 'Loading…')}</p></div>;
  return (
    <div className="page tones-page">
      {tab !== 'session' && (
        <>
          <h1 className="serif h1">{t('Тоны', 'Tones')}</h1>
          <div className="seg">
            {([['home', t('Тренировка', 'Practice')], ['library', t('Слоги', 'Syllables')], ['settings', t('Настройки тонов', 'Tone settings')]] as const).map(([k, label]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
        </>
      )}
      <div className="legacy">
        {tab === 'home' && <Home state={state} onStart={() => setTab('session')} />}
        {tab === 'session' && <Session state={state} onAnswer={actions.answer} onFinish={actions.finishSession} onExit={() => setTab('home')} />}
        {tab === 'library' && <Library state={state} />}
        {tab === 'settings' && <ToneSettings state={state} onPatch={actions.setProfile} onReplace={actions.replaceAll} onReset={actions.reset} />}
      </div>
    </div>
  );
}
