import { Component, type ReactNode } from 'react';
import { t } from '../i18n';

/**
 * Keeps one broken part from blanking the whole site: the error is shown in
 * place (so it can be reported) and everything around it keeps working.
 */
export default class Guard extends Component<{ children: ReactNode; quiet?: boolean; resetKey?: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error) { console.error('[bai.kun]', error); }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Moving to another page gives it a fresh try.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.quiet) return null;
    return (
      <div className="page">
        <div className="panel">
          <h2 className="h3">{t('Эта страница не открылась', 'This page failed to open')}</h2>
          <p className="muted small">{t('Остальной сайт работает: выбери другой раздел в меню. Пришли скриншот этого блока, чтобы ошибку исправили.', 'The rest of the site works: pick another section in the menu. Send a screenshot of this box so the bug can be fixed.')}</p>
          <pre className="small" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{String(error?.message ?? error)}{'\n'}{(error?.stack ?? '').split('\n').slice(0, 4).join('\n')}</pre>
          <button className="btn" onClick={() => location.reload()}>{t('Перезагрузить', 'Reload')}</button>
        </div>
      </div>
    );
  }
}
