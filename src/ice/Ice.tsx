import { useEffect, useRef, useState } from 'react';
import type { IceField } from './shards';

/**
 * Ice theme pieces. The three.js code is loaded on demand, so the course
 * shows its content first and the 3D arrives a moment later.
 */

/** Follows the light/dark choice the app writes on <html data-theme>. */
export function useDarkTheme() {
  const read = () => document.documentElement.dataset.theme === 'dark';
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

/** The drifting crystal field behind every course page. */
export function IceBackground() {
  const dark = useDarkTheme();
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<IceField | null>(null);
  useEffect(() => {
    let gone = false;
    import('./shards').then(({ createIceField }) => {
      if (gone || !host.current) return;
      try { field.current = createIceField(host.current, dark); } catch (e) { console.error('[ice]', e); }
    }).catch(() => {});
    return () => { gone = true; field.current?.dispose(); field.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { field.current?.setTheme(dark); }, [dark]);
  return <div className="ice-field" ref={host} aria-hidden="true" />;
}
