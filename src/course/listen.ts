/**
 * Speech recognition for the speaking step.
 *
 * Uses the browser's own recogniser (Web Speech API). On iPhone it is Safari's
 * dictation engine, so it needs Siri & Dictation switched on; in Chrome it
 * goes through Google. Either way nothing is uploaded by this site itself.
 */
import { BY_CHAR } from '../lib/syllables';
import { WORD_BY_ZH } from './data';
import { stripTone } from '../lib/pinyin';
import { t } from '../i18n';

interface RecognitionResultLike { 0: { transcript: string }; length: number; isFinal: boolean; [i: number]: { transcript: string } }
interface RecognitionEventLike { results: ArrayLike<RecognitionResultLike> }
interface RecognitionLike {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type Ctor = new () => RecognitionLike;

const Recognition: Ctor | undefined = typeof window !== 'undefined'
  ? ((window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }).SpeechRecognition ??
     (window as unknown as { webkitSpeechRecognition?: Ctor }).webkitSpeechRecognition)
  : undefined;

export const listenSupported = !!Recognition;

export interface ListenHandlers {
  onInterim?: (text: string) => void;
  onFinal: (alternatives: string[]) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

const ERRORS = (): Record<string, string> => ({
  'not-allowed': t('Нет доступа к микрофону. Разреши микрофон для этого сайта в настройках браузера.', 'No access to the microphone. Allow the microphone for this site in your browser settings.'),
  'service-not-allowed': t('Распознавание выключено. На iPhone: Настройки → Siri → включи «Диктовка» (или «Siri и Диктовка»).', 'Speech recognition is off. On iPhone: Settings → Siri → turn on Dictation (or “Siri & Dictation”).'),
  'no-speech': t('Ничего не услышал. Нажми и скажи погромче.', 'Heard nothing. Tap and speak a bit louder.'),
  'audio-capture': t('Микрофон не найден.', 'No microphone found.'),
  network: t('Нет связи с сервисом распознавания. Проверь интернет.', 'Cannot reach the recognition service. Check your connection.'),
  aborted: '',
});

/** Starts listening once; returns a stop function. */
export function listen(h: ListenHandlers): () => void {
  if (!Recognition) { h.onError(t('Этот браузер не умеет распознавать речь. Открой сайт в Safari или Chrome.', 'This browser cannot recognise speech. Open the site in Safari or Chrome.')); h.onEnd(); return () => {}; }
  const r = new Recognition();
  r.lang = 'zh-CN';
  r.interimResults = true;
  r.maxAlternatives = 5;
  r.continuous = false;
  let finished = false;
  r.onresult = (e) => {
    const res = e.results[e.results.length - 1];
    if (!res) return;
    if (res.isFinal) {
      finished = true;
      const alts: string[] = [];
      for (let i = 0; i < res.length; i++) alts.push(res[i].transcript);
      h.onFinal(alts);
    } else h.onInterim?.(res[0].transcript);
  };
  r.onerror = (e) => { const m = ERRORS()[e.error] ?? t(`Ошибка распознавания: ${e.error}`, `Recognition error: ${e.error}`); if (m) h.onError(m); };
  r.onend = () => { if (!finished) h.onFinal([]); h.onEnd(); };
  try { r.start(); } catch { h.onError(t('Не удалось включить микрофон.', 'Could not turn on the microphone.')); h.onEnd(); }
  return () => { try { r.stop(); } catch { /* already stopped */ } };
}

/* ---------- scoring ---------- */

const NON_HAN = /[^\p{Script=Han}]/gu;
export const hanOnly = (s: string) => s.replace(NON_HAN, '');

/** Reading of a character, toneless: from lesson words first, then the 800-character list. */
function readingOf(ch: string): string | null {
  const w = WORD_BY_ZH.get(ch);
  if (w) return stripTone(w.py.split(' ')[0]);
  const h = BY_CHAR.get(ch);
  return h ? stripTone(h.py.split(/\s+/)[0]) : null;
}

export interface Match {
  /** Per expected character: heard exactly, heard a homophone, or missed. */
  marks: ('ok' | 'sound' | 'miss')[];
  score: number; // 0..1
  heard: string;
}

/** LCS alignment of what was expected against one recognised alternative. */
function align(expected: string[], heard: string[]): ('ok' | 'sound' | 'miss')[] {
  const n = expected.length, m = heard.length;
  const same = (a: string, b: string) => (a === b ? 2 : readingOf(a) && readingOf(a) === readingOf(b) ? 1 : 0);
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) {
      const s = same(expected[i], heard[j]);
      dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1], s ? s + dp[i + 1][j + 1] : 0);
    }
  const marks: ('ok' | 'sound' | 'miss')[] = new Array(n).fill('miss');
  let i = 0, j = 0;
  while (i < n && j < m) {
    const s = same(expected[i], heard[j]);
    if (s && dp[i][j] === s + dp[i + 1][j + 1]) { marks[i] = s === 2 ? 'ok' : 'sound'; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return marks;
}

/**
 * Picks the best of the recogniser's alternatives. A homophone counts as
 * nearly right: the recogniser often writes 是 for 事, which says the sound
 * was produced correctly.
 */
export function scoreSpeech(expectedZh: string, alternatives: string[]): Match {
  const exp = [...hanOnly(expectedZh)];
  let best: Match = { marks: exp.map(() => 'miss'), score: 0, heard: alternatives[0] ?? '' };
  for (const alt of alternatives) {
    const marks = align(exp, [...hanOnly(alt)]);
    const score = exp.length ? marks.reduce((s, x) => s + (x === 'ok' ? 1 : x === 'sound' ? 0.85 : 0), 0) / exp.length : 0;
    if (score > best.score) best = { marks, score, heard: alt };
  }
  return best;
}
