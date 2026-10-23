import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { CourseActions, CourseState } from './store';
import { speak, stopSpeaking } from '../lib/speech';
import { useVoiceStatus } from '../components/Speaker';
import { VOICE_HELP } from '../lib/speech';
import { parsePinyin } from '../lib/pinyin';

/* ---------- context ---------- */

interface Ctx { state: CourseState; actions: CourseActions }
export const CourseCtx = createContext<Ctx | null>(null);
export function useCourseCtx(): Ctx {
  const c = useContext(CourseCtx);
  if (!c) throw new Error('CourseCtx missing');
  return c;
}

/* ---------- hash router ---------- */

export function useRoute(): string[] {
  const read = () => (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => { setParts(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}
export const go = (path: string) => { location.hash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`; };

/* ---------- pinyin with tone colours ---------- */

export function Py({ text, className = '' }: { text: string; className?: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <span className={`py ${className}`}>
      {parts.map((p, i) => {
        if (/^\s+$/.test(p) || !p) return p;
        // A token may hold several syllables ("xièxie"): colour by the first marked vowel.
        const t = parsePinyin(p)[0]?.tone ?? 5;
        return <span key={i} className={`t${t}`}>{p}</span>;
      })}
    </span>
  );
}

/* ---------- audio ---------- */

export function useSay() {
  const { state } = useCourseCtx();
  const status = useVoiceStatus();
  return {
    status,
    say(text: string, cb?: { onStart?: () => void; onEnd?: () => void }) {
      return speak(text, { voiceURI: state.settings.voiceURI, rate: state.settings.rate, ...cb });
    },
  };
}

export function Say({ text, label, big = false, auto }: { text: string; label?: string; big?: boolean; auto?: string | number }) {
  const { say, status } = useSay();
  const [on, setOn] = useState(false);
  const play = () => { say(text, { onStart: () => setOn(true), onEnd: () => setOn(false) }); };
  useEffect(() => {
    if (auto === undefined || status !== 'ready') return;
    const id = window.setTimeout(play, 250);
    return () => { window.clearTimeout(id); stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, status]);
  return (
    <button type="button" className={`say ${big ? 'say-big' : ''} ${on ? 'on' : ''}`} onClick={play}
      aria-label={label ?? 'Прослушать'} title={status === 'ready' ? 'Прослушать' : VOICE_HELP[status]}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        {on && <path d="M18.5 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      </svg>
      {label && <span>{label}</span>}
    </button>
  );
}

export function VoiceWarning() {
  const status = useVoiceStatus();
  if (status === 'ready' || status === 'loading') return null;
  return <p className="warn">{VOICE_HELP[status]}</p>;
}

/* ---------- stroke order (Hanzi Writer, data served from /strokes) ---------- */

const STROKE_BASE = `${import.meta.env.BASE_URL}strokes/`;

export function StrokeBox({ char, size = 200, mode = 'animate' }: { char: string; size?: number; mode?: 'animate' | 'quiz' }) {
  const ref = useRef<HTMLDivElement>(null);
  const writer = useRef<{ animateCharacter: () => void; quiz: (o?: object) => void; cancelQuiz?: () => void } | null>(null);
  const [state, setState] = useState<'load' | 'ok' | 'none'>('load');
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    setState('load'); setDone(null);
    import('hanzi-writer').then(({ default: HanziWriter }) => {
      type Loader = Parameters<typeof HanziWriter.create>[2] extends infer O ? O extends { charDataLoader?: infer L } ? L : never : never;
      if (!alive) return;
      const css = getComputedStyle(document.documentElement);
      const w = HanziWriter.create(el, char, {
        width: size, height: size, padding: 8,
        strokeColor: css.getPropertyValue('--ink').trim() || '#fff',
        radicalColor: css.getPropertyValue('--cyan').trim() || '#79dce8',
        outlineColor: 'rgba(255,255,255,.12)',
        drawingColor: css.getPropertyValue('--cyan').trim() || '#79dce8',
        highlightColor: '#79dce8',
        strokeAnimationSpeed: 1.1, delayBetweenStrokes: 180,
        showOutline: true, showCharacter: mode === 'animate',
        charDataLoader: ((c: string, onLoad: (d: object) => void, onError: () => void) => {
          fetch(`${STROKE_BASE}${encodeURIComponent(c)}.json`).then((r) => (r.ok ? r.json() : Promise.reject())).then(onLoad, onError);
        }) as unknown as Loader,
        onLoadCharDataSuccess: () => alive && setState('ok'),
        onLoadCharDataError: () => alive && setState('none'),
      });
      writer.current = w as unknown as typeof writer.current;
      if (mode === 'quiz') w.quiz({ onComplete: (s: { totalMistakes: number }) => alive && setDone(s.totalMistakes === 0 ? 'Идеально!' : `Готово, ошибок: ${s.totalMistakes}`) });
    });
    return () => { alive = false; };
  }, [char, size, mode]);

  return (
    <div className="stroke">
      <div className={`stroke-grid ${state}`} style={{ width: size, height: size }} ref={ref} />
      {state === 'none' && <p className="muted small">Порядок черт для 「{char}」 пока нет.</p>}
      {state === 'ok' && mode === 'animate' && (
        <button type="button" className="chip" onClick={() => writer.current?.animateCharacter()}>▶ Порядок черт</button>
      )}
      {state === 'ok' && mode === 'quiz' && <p className="small muted">{done ?? 'Обведи черты пальцем по порядку'}</p>}
    </div>
  );
}

/* ---------- bits ---------- */

export function Ring({ value, size = 44, children }: { value: number; size?: number; children?: ReactNode }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value))} />
      </svg>
      <span className="ring-in">{children}</span>
    </span>
  );
}

export function Bar({ value }: { value: number }) {
  return <span className="bar"><span style={{ width: `${Math.round(Math.min(1, value) * 100)}%` }} /></span>;
}

export const PLANETS = {
  earth: { zh: '地球', ru: 'Земля', img: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260827_202005_3346cc4d-ec3b-44ab-825c-b18e49f5021a.png' },
  venus: { zh: '金星', ru: 'Венера', img: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260827_202012_640b239a-d08a-4200-adb2-741bbe129ac8.png' },
  mars: { zh: '火星', ru: 'Марс', img: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260827_202018_3d559490-f613-4ed7-a3bb-3b7e9fc90fb8.png' },
} as const;
export type PlanetKey = keyof typeof PLANETS;

export function Planet({ p, size = 64 }: { p: PlanetKey; size?: number }) {
  return <span className={`planet-dot planet-${p}`} style={{ width: size, height: size }}><img src={PLANETS[p].img} alt="" loading="lazy" decoding="async" /></span>;
}
