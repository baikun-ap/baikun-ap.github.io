import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { watchRightAnswers } from './snow';
import type { IceField, IceSection } from './shards';

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

/** Which piece of the landing's story stands behind a section of the course. */
const SECTION: Record<string, IceSection> = {
  course: 'bricks', lesson: 'bricks', grammar: 'bricks',
  cards: 'ring', pinyin: 'ring', tones: 'ring',
  midterm: 'portal', micro: 'portal',
  hanzi: 'stones', write: 'stones', parts: 'stones',
};

/** The drifting ice field behind every course page; `route` is the first part of the address. */
export function IceBackground({ route = '' }: { route?: string }) {
  const section = SECTION[route] ?? 'shards';
  const dark = useDarkTheme();
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<IceField | null>(null);
  const latest = useRef(section);
  latest.current = section;
  useEffect(() => {
    let gone = false;
    import('./shards').then(({ createIceField }) => {
      if (gone || !host.current) return;
      try { field.current = createIceField(host.current, dark, latest.current); } catch (e) { console.error('[ice]', e); }
    }).catch(() => {});
    return () => { gone = true; field.current?.dispose(); field.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { field.current?.setTheme(dark); }, [dark]);
  useEffect(() => { field.current?.setSection(section); }, [section]);
  // Snowflakes fly from every right answer, on any page.
  useEffect(() => watchRightAnswers(), []);
  return <div className="ice-field" ref={host} aria-hidden="true" />;
}

/**
 * Tilt for a 3D ice card: the card leans towards the pointer and its gloss
 * follows it. Spread the result on the card: `<button {...iceTilt} />`.
 * Touch has no hover, so there the card just sways (ice.css).
 */
const tiltTo = (e: ReactPointerEvent<HTMLElement>) => {
  if (e.pointerType !== 'mouse') return;
  const el = e.currentTarget, r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  el.style.setProperty('--ry', `${((x - 0.5) * 14).toFixed(2)}deg`);
  el.style.setProperty('--rx', `${((0.5 - y) * 10).toFixed(2)}deg`);
  el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
  el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
};
const tiltBack = (e: ReactPointerEvent<HTMLElement>) => {
  const el = e.currentTarget;
  for (const k of ['--rx', '--ry', '--gx', '--gy']) el.style.removeProperty(k);
};
export const iceTilt = { onPointerMove: tiltTo, onPointerLeave: tiltBack };
