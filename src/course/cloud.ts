/**
 * Cloud progress: sign in with Google and keep course progress (and the tone
 * trainer's state) in Firestore under users/{uid}, so it follows the learner
 * between phone, home-screen app and computer.
 *
 * Firebase is loaded only when a config exists, and only after first paint,
 * so the site stays fast and fully usable without an account.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { FIREBASE_CONFIG } from '../firebase-config';
import type { CourseState, LessonProgress, WordCard } from './store';
import { loadState, saveState } from '../lib/db';
import type { AppState } from '../lib/types';

export const cloudConfigured = !!FIREBASE_CONFIG;

type Fb = Awaited<ReturnType<typeof loadFirebase>>;
let fbPromise: Promise<Fb> | null = null;

async function loadFirebase() {
  const [{ initializeApp }, auth, store] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = initializeApp(FIREBASE_CONFIG!);
  const a = auth.getAuth(app);
  await auth.setPersistence(a, auth.browserLocalPersistence).catch(() => {});
  return { auth, store, a, db: store.getFirestore(app) };
}
const fb = () => (fbPromise ??= loadFirebase());

/* ---------- merging two copies of the progress ---------- */

function mergeLessons(a: Record<string, LessonProgress>, b: Record<string, LessonProgress>) {
  const out: Record<string, LessonProgress> = { ...a };
  for (const [id, p] of Object.entries(b)) {
    const q = out[id];
    if (!q) { out[id] = p; continue; }
    const steps = [...new Set([...q.steps, ...p.steps])].sort((x, y) => x - y);
    const tests = [q.test, p.test].filter((t): t is number => t !== null);
    const done = [q.doneAt, p.doneAt].filter((d): d is string => !!d).sort();
    out[id] = { steps, test: tests.length ? Math.max(...tests) : null, doneAt: done[0] ?? null };
  }
  return out;
}

/** The copy that has been reviewed more is the more recent one. */
function mergeCards(a: Record<string, WordCard>, b: Record<string, WordCard>) {
  const out: Record<string, WordCard> = { ...a };
  for (const [id, c] of Object.entries(b)) {
    const d = out[id];
    if (!d || c.history.length > d.history.length || (c.history.length === d.history.length && c.due > d.due)) out[id] = c;
  }
  return out;
}

export function mergeCourse(local: CourseState, remote: CourseState): CourseState {
  const newer = (remote.lastDay ?? '') > (local.lastDay ?? '') ? remote : local;
  const days = { ...remote.days };
  for (const [d, n] of Object.entries(local.days)) days[d] = Math.max(days[d] ?? 0, n);
  return {
    ...local,
    lessons: mergeLessons(local.lessons, remote.lessons),
    cards: mergeCards(local.cards, remote.cards),
    last: newer.last ?? local.last ?? remote.last,
    xp: Math.max(local.xp, remote.xp),
    streak: newer.streak,
    bestStreak: Math.max(local.bestStreak, remote.bestStreak),
    lastDay: newer.lastDay,
    days,
    settings: local.settings,
  };
}

export const pickTones = (a: AppState | null, b: AppState | null) =>
  !a ? b : !b ? a : (b.profile.totalReviews > a.profile.totalReviews ? b : a);

const plain = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/* ---------- hook ---------- */

export interface CloudUser { name: string; email: string; photo: string | null }
export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'error';

export function useCloud(state: CourseState | null, replace: (s: CourseState) => void) {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [status, setStatus] = useState<SyncStatus>(cloudConfigured ? 'signed-out' : 'off');
  const [error, setError] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const uid = useRef<string | null>(null);
  const ready = useRef(false);          // first merge done, safe to upload
  const latest = useRef(state);
  latest.current = state;

  const upload = useCallback(async () => {
    if (!uid.current || !latest.current) return;
    const { store, db } = await fb();
    setStatus('syncing');
    try {
      const tones = await loadState().catch(() => null);
      await store.setDoc(store.doc(db, 'users', uid.current), plain({ course: latest.current, tones, updatedAt: Date.now() }));
      setStatus('synced'); setSyncedAt(new Date()); setError('');
    } catch (e) { setStatus('error'); setError(String((e as Error).message ?? e)); }
  }, []);

  // Restore an existing session after first paint.
  useEffect(() => {
    if (!cloudConfigured) return;
    let unsub: (() => void) | undefined;
    const start = () => fb().then(({ auth, a }) => {
      auth.getRedirectResult(a).catch(() => {});
      unsub = auth.onAuthStateChanged(a, async (u) => {
        if (!u) { uid.current = null; ready.current = false; setUser(null); setStatus('signed-out'); return; }
        uid.current = u.uid;
        setUser({ name: u.displayName ?? '', email: u.email ?? '', photo: u.photoURL });
        setStatus('syncing');
        try {
          const { store, db } = await fb();
          const snap = await store.getDoc(store.doc(db, 'users', u.uid));
          const remote = snap.exists() ? (snap.data() as { course?: CourseState; tones?: AppState }) : {};
          if (remote.course && latest.current) replace(mergeCourse(latest.current, remote.course));
          const tones = pickTones(await loadState().catch(() => null), remote.tones ?? null);
          if (tones && remote.tones && tones === remote.tones) await saveState(tones);
          ready.current = true;
          setTimeout(upload, 300);
        } catch (e) { setStatus('error'); setError(String((e as Error).message ?? e)); }
      });
    });
    const id = window.setTimeout(start, 600);
    return () => { window.clearTimeout(id); unsub?.(); };
  }, [replace, upload]);

  // Upload a few seconds after the last change, and when the page is hidden.
  useEffect(() => {
    if (!ready.current || !uid.current || !state) return;
    const id = window.setTimeout(upload, 2500);
    return () => window.clearTimeout(id);
  }, [state, upload]);
  useEffect(() => {
    const onHide = () => { if (ready.current && document.visibilityState === 'hidden') upload(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [upload]);

  const signIn = useCallback(async () => {
    setError('');
    const { auth, a } = await fb();
    const provider = new auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await auth.signInWithPopup(a, provider);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      // Home-screen apps on iPhone may block popups; fall back to a full-page redirect.
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') await auth.signInWithRedirect(a, provider);
      else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') setError(code || String(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    await upload();
    const { auth, a } = await fb();
    await auth.signOut(a);
  }, [upload]);

  return { user, status, error, syncedAt, signIn, signOut, syncNow: upload };
}

export type Cloud = ReturnType<typeof useCloud>;
