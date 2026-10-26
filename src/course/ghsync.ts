/**
 * Progress sync through the learner's own GitHub account.
 *
 * Progress lives in one secret Gist ("bai.kun progress") as a JSON file. Each
 * device is connected once with a personal access token that may only touch
 * Gists; the token stays in this browser's localStorage and is sent nowhere
 * except api.github.com. No server of our own is involved, and it works from
 * China without a VPN.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CourseState } from './store';
import { mergeCourse, pickTones } from './cloud';
import { loadState, saveState } from '../lib/db';
import type { AppState } from '../lib/types';
import { t } from '../i18n';

const TOKEN_KEY = 'baikun-gh-token';
const GIST_KEY = 'baikun-gh-gist';
const DESCRIPTION = 'bai.kun progress';
const FILE = 'baikun-progress.json';
const API = 'https://api.github.com';

interface Payload { app: 'bai.kun'; savedAt: string; course: CourseState; tones: AppState | null }

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } };

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (r.status === 401) throw new Error(t('Ключ не подходит или истёк. Создай новый и подключи заново.', 'The token is invalid or expired. Create a new one and connect again.'));
  if (r.status === 403 || r.status === 404) throw new Error(t('У ключа нет доступа к Gist. При создании ключа отметь право «gist».', 'The token has no Gist access. Tick the “gist” scope when you create it.'));
  if (!r.ok) throw new Error(t(`GitHub ответил ошибкой ${r.status}.`, `GitHub returned error ${r.status}.`));
  return r.json() as Promise<T>;
}

interface GistFile { content?: string; truncated?: boolean; raw_url?: string }
interface Gist { id: string; description: string | null; files: Record<string, GistFile> }

async function readGist(token: string, id: string): Promise<Payload | null> {
  const g = await gh<Gist>(token, `/gists/${id}`);
  const f = g.files[FILE];
  if (!f) return null;
  const text = f.truncated && f.raw_url ? await (await fetch(f.raw_url)).text() : f.content ?? '';
  try { return JSON.parse(text) as Payload; } catch { return null; }
}

/** Finds the progress Gist in the account, creating it on first use. */
async function findGist(token: string): Promise<{ id: string; created: boolean }> {
  const known = read(GIST_KEY);
  if (known) {
    try { await gh(token, `/gists/${known}`); return { id: known, created: false }; } catch { write(GIST_KEY, null); }
  }
  for (let page = 1; page <= 5; page++) {
    const list = await gh<Gist[]>(token, `/gists?per_page=100&page=${page}`);
    const hit = list.find((g) => g.description === DESCRIPTION && g.files[FILE]);
    if (hit) return { id: hit.id, created: false };
    if (list.length < 100) break;
  }
  const g = await gh<Gist>(token, '/gists', {
    method: 'POST',
    body: JSON.stringify({ description: DESCRIPTION, public: false, files: { [FILE]: { content: '{}' } } }),
  });
  return { id: g.id, created: true };
}

export type GhStatus = 'off' | 'connecting' | 'syncing' | 'synced' | 'error';

export function useGithubSync(state: CourseState | null, replace: (s: CourseState) => void) {
  const [login, setLogin] = useState<string | null>(null);
  const [status, setStatus] = useState<GhStatus>('off');
  const [error, setError] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const token = useRef<string | null>(read(TOKEN_KEY));
  const gist = useRef<string | null>(null);
  const ready = useRef(false);
  const latest = useRef(state);
  latest.current = state;

  const upload = useCallback(async () => {
    if (!token.current || !gist.current || !latest.current || !ready.current) return;
    setStatus('syncing');
    try {
      const payload: Payload = { app: 'bai.kun', savedAt: new Date().toISOString(), course: latest.current, tones: await loadState().catch(() => null) };
      await gh(token.current, `/gists/${gist.current}`, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(payload) } } }) });
      setStatus('synced'); setSyncedAt(new Date()); setError('');
    } catch (e) { setStatus('error'); setError((e as Error).message); }
  }, []);

  /** Pulls the stored copy, merges it into this device, then pushes the result. */
  const pull = useCallback(async () => {
    if (!token.current || !latest.current) return;
    setStatus('syncing');
    try {
      const me = await gh<{ login: string }>(token.current, '/user');
      setLogin(me.login);
      const g = await findGist(token.current);
      gist.current = g.id; write(GIST_KEY, g.id);
      const remote = g.created ? null : await readGist(token.current, g.id);
      if (remote?.course) replace(mergeCourse(latest.current, remote.course));
      const localTones = await loadState().catch(() => null);
      const tones = pickTones(localTones, remote?.tones ?? null);
      if (tones && tones !== localTones) await saveState(tones);
      ready.current = true;
      setTimeout(upload, 400);
    } catch (e) { setStatus('error'); setError((e as Error).message); }
  }, [replace, upload]);

  // Reconnect automatically on load if this device already has a token.
  useEffect(() => {
    if (!token.current || !state || ready.current || status !== 'off') return;
    setStatus('connecting');
    pull();
  }, [state, status, pull]);

  // Push a few seconds after the last change, and when the page goes to the background.
  useEffect(() => {
    if (!ready.current || !state) return;
    const id = window.setTimeout(upload, 4000);
    return () => window.clearTimeout(id);
  }, [state, upload]);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') upload(); else if (ready.current) pull(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [upload, pull]);

  const connect = useCallback(async (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    token.current = t; write(TOKEN_KEY, t);
    ready.current = false; setError(''); setStatus('connecting');
    await pull();
  }, [pull]);

  const disconnect = useCallback(async () => {
    await upload();
    token.current = null; gist.current = null; ready.current = false;
    write(TOKEN_KEY, null); write(GIST_KEY, null);
    setLogin(null); setStatus('off'); setSyncedAt(null);
  }, [upload]);

  return { connected: !!login, login, status, error, syncedAt, connect, disconnect, syncNow: pull };
}

export type GithubSync = ReturnType<typeof useGithubSync>;
