import { useSyncExternalStore } from 'react';
import { api, ApiError, hasTokens } from './api';
import { db, getMeta, setMeta } from './db';
import { dataChanged } from './events';
import { applyRemote, pendingCount, type WireRecord } from './repo';
import { generateRecurring } from './recurring-runner';
import { reportError } from './monitoring';
import type { Store } from './types';

const STORES: Store[] = ['envelopes', 'revenus', 'depenses', 'objectifs'];
const PUSH_BATCH = 200;
const CURSOR_KEY = 'sync.cursor';

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error';
  pending: number;
  lastSyncAt: string | null;
  error: string | null;
  /** Éléments refusés par le serveur lors du dernier envoi (données invalides) : abandonnés. */
  rejected: number;
}

let status: SyncStatus = {
  state: 'idle',
  pending: 0,
  lastSyncAt: getMeta('sync.lastAt'),
  error: null,
  rejected: 0,
};
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export const refreshPending = () => setStatus({ pending: pendingCount() });

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => status,
  );
}

interface PushResponse {
  applied: number;
  stale: number;
  rejected: { id: string | null; store: string; reason: string }[];
}

interface PullResponse extends Record<Store, WireRecord[]> {
  server_time: string;
  has_more: boolean;
  next_since: string;
}

interface OutboxRow {
  id: number;
  store: Store;
  op: 'upsert' | 'delete';
  payload: string;
  rev: number;
}

async function push(): Promise<number> {
  let rejected = 0;
  for (;;) {
    const rows = db.getAllSync<OutboxRow>(
      `SELECT id, store, op, payload, rev FROM outbox
       ORDER BY CASE store WHEN 'envelopes' THEN 0 ELSE 1 END, id LIMIT ${PUSH_BATCH}`,
    );
    if (rows.length === 0) return rejected;

    const res = await api.post<PushResponse>('/sync/push', {
      changes: rows.map((r) => ({ store: r.store, op: r.op, data: JSON.parse(r.payload) })),
    });
    rejected += res.rejected.length;
    if (res.rejected.length) reportError(new Error(`Sync: ${res.rejected.length} élément(s) refusé(s)`), { area: 'sync-push', reasons: [...new Set(res.rejected.map((r) => r.reason))].join(' | ') });

    // On retire ce qui a été traité, sauf si l'élément a été modifié pendant l'envoi (rev différent) :
    // il restera dans la file avec sa version la plus récente.
    db.withTransactionSync(() => {
      for (const r of rows) db.runSync('DELETE FROM outbox WHERE id = ? AND rev = ?', r.id, r.rev);
    });
    if (rows.length < PUSH_BATCH) return rejected;
  }
}

async function pull(): Promise<boolean> {
  let since = getMeta(CURSOR_KEY);
  let changed = false;
  for (;;) {
    const res = await api.get<PullResponse>(`/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`);
    db.withTransactionSync(() => {
      for (const store of STORES) {
        for (const row of res[store] ?? []) if (applyRemote(store, row)) changed = true;
      }
    });
    since = res.has_more ? res.next_since : res.server_time;
    if (!res.has_more) break;
  }
  // Le curseur n'avance qu'une fois toutes les pages appliquées.
  setMeta(CURSOR_KEY, since);
  return changed;
}

let running: Promise<void> | null = null;
let again = false;

/** Synchronise (envoi puis réception). Appels concurrents regroupés ; sans effet si non connecté. */
export function syncNow(): Promise<void> {
  if (!hasTokens()) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    setStatus({ state: 'syncing', error: null });
    try {
      let rejected = await push();
      const changed = await pull();
      // Récurrences : crée les occurrences manquantes (identifiants déterministes → pas de doublon entre appareils).
      const created = generateRecurring();
      if (created > 0) rejected += await push();
      if (changed) dataChanged.emit();

      const now = new Date().toISOString();
      setMeta('sync.lastAt', now);
      setStatus({ state: 'idle', lastSyncAt: now, rejected, pending: pendingCount() });
    } catch (e) {
      const offline = e instanceof ApiError && e.isNetwork;
      // Hors ligne = normal. Session expirée = géré ailleurs. Le reste mérite d'être su.
      if (!offline && !(e instanceof ApiError && e.status === 401)) reportError(e, { area: 'sync' });
      setStatus({
        state: offline ? 'offline' : 'error',
        error: offline ? null : e instanceof Error ? e.message : 'Erreur de synchronisation',
        pending: pendingCount(),
      });
    } finally {
      running = null;
      if (again) {
        again = false;
        void syncNow();
      }
    }
  })();
  return running;
}

let debounce: ReturnType<typeof setTimeout> | null = null;

/** Planifie une synchronisation peu après une modification locale (regroupe les saisies rapprochées). */
export function scheduleSync(delayMs = 1500) {
  refreshPending();
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    void syncNow();
  }, delayMs);
}
