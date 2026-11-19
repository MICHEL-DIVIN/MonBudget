import { randomUUID } from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import { db } from './db';
import { dataChanged, localMutation } from './events';
import type { Store, StoreMap } from './types';

/** Colonnes de chaque table (hors deleted_at) et colonnes booléennes stockées en 0/1. */
const COLUMNS: Record<Store, string[]> = {
  envelopes: ['id', 'name', 'budgeted', 'color', 'icon', 'sort_order', 'created_at', 'updated_at'],
  revenus: ['id', 'label', 'amount', 'category', 'type', 'date', 'recurring', 'recurring_group_id', 'created_at', 'updated_at'],
  depenses: ['id', 'label', 'amount', 'category', 'envelope_id', 'date', 'recurring', 'recurring_group_id', 'created_at', 'updated_at'],
  objectifs: ['id', 'label', 'target_amount', 'current_amount', 'deadline', 'created_at', 'updated_at'],
};
const BOOLEANS = new Set(['recurring']);

type Row = Record<string, unknown>;

function fromRow<S extends Store>(row: Row): StoreMap[S] {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'deleted_at') continue;
    out[k] = BOOLEANS.has(k) ? v === 1 : v;
  }
  return out as unknown as StoreMap[S];
}

const toParam = (k: string, v: unknown) => (BOOLEANS.has(k) ? (v ? 1 : 0) : (v ?? null));

const nowIso = () => new Date().toISOString();

// --- Lecture ---

export function listAll<S extends Store>(store: S): StoreMap[S][] {
  return db.getAllSync<Row>(`SELECT * FROM ${store} WHERE deleted_at IS NULL`).map((r) => fromRow<S>(r));
}

/** Avec les suppressions logiques (nécessaire pour ne pas re-générer une récurrence supprimée). */
export function listWithDeleted<S extends Store>(store: S): (StoreMap[S] & { deleted: boolean })[] {
  return db.getAllSync<Row>(`SELECT * FROM ${store}`).map((r) => ({ ...fromRow<S>(r), deleted: r.deleted_at != null }));
}

export function getById<S extends Store>(store: S, id: string): StoreMap[S] | null {
  const row = db.getFirstSync<Row>(`SELECT * FROM ${store} WHERE id = ? AND deleted_at IS NULL`, id);
  return row ? fromRow<S>(row) : null;
}

export function pendingCount(): number {
  return db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox')?.n ?? 0;
}

// --- Écriture locale (enfile une opération d'envoi) ---

function enqueue(store: Store, id: string, op: 'upsert' | 'delete', payload: unknown) {
  db.runSync(
    `INSERT INTO outbox(store, record_id, op, payload, rev) VALUES(?, ?, ?, ?, 0)
     ON CONFLICT(store, record_id) DO UPDATE SET op = excluded.op, payload = excluded.payload, rev = rev + 1`,
    store,
    id,
    op,
    JSON.stringify(payload),
  );
}

function writeRow(store: Store, rec: Row) {
  const cols = COLUMNS[store];
  const placeholders = cols.map(() => '?').join(', ');
  const updates = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');
  db.runSync(
    `INSERT INTO ${store}(${cols.join(', ')}, deleted_at) VALUES(${placeholders}, NULL)
     ON CONFLICT(id) DO UPDATE SET ${updates}, deleted_at = NULL`,
    cols.map((c) => toParam(c, rec[c])) as never,
  );
}

type Input<S extends Store> = Omit<StoreMap[S], 'id' | 'created_at' | 'updated_at'> & { id?: string };

/** Crée ou met à jour un enregistrement (id fourni = mise à jour). */
export function save<S extends Store>(store: S, input: Input<S>): StoreMap[S] {
  const rec = saveNoEmit(store, input);
  dataChanged.emit();
  localMutation.emit();
  return rec;
}

function saveNoEmit<S extends Store>(store: S, input: Input<S>): StoreMap[S] {
  const now = nowIso();
  const existing = input.id ? getById(store, input.id) : null;
  const rec = {
    ...existing,
    ...input,
    id: input.id ?? randomUUID(),
    created_at: existing?.created_at ?? now,
    updated_at: now,
  } as unknown as StoreMap[S];
  db.withTransactionSync(() => {
    writeRow(store, rec as unknown as Row);
    enqueue(store, rec.id, 'upsert', rec);
  });
  return rec;
}

/** Enregistre plusieurs enregistrements en une transaction (import, récurrences) — une seule notification. */
export function saveMany<S extends Store>(store: S, inputs: Input<S>[]): void {
  if (inputs.length === 0) return;
  db.withTransactionSync(() => {
    for (const i of inputs) saveNoEmit(store, i);
  });
  dataChanged.emit();
  localMutation.emit();
}

export function remove(store: Store, id: string): void {
  const now = nowIso();
  db.withTransactionSync(() => {
    db.runSync(`UPDATE ${store} SET deleted_at = ?, updated_at = ? WHERE id = ?`, now, now, id);
    enqueue(store, id, 'delete', { id, updated_at: now });
    if (store === 'envelopes') {
      // Détache localement les dépenses (le serveur fait de même et renvoie la correction).
      const rows = db.getAllSync<Row>('SELECT * FROM depenses WHERE envelope_id = ? AND deleted_at IS NULL', id);
      for (const row of rows) {
        db.runSync('UPDATE depenses SET envelope_id = NULL, updated_at = ? WHERE id = ?', now, row.id as string);
        enqueue('depenses', row.id as string, 'upsert', { ...fromRow(row), envelope_id: null, updated_at: now });
      }
    }
  });
  dataChanged.emit();
  localMutation.emit();
}

// --- Application de données serveur (sans file d'envoi) ---

export interface WireRecord extends Row {
  id: string;
  deleted_at: string | null;
}

/** Applique une ligne reçue du serveur, sauf si une modification locale non envoyée existe (elle sera envoyée puis arbitrée par le serveur). */
export function applyRemote(store: Store, r: WireRecord): boolean {
  const pending = db.getFirstSync('SELECT 1 FROM outbox WHERE store = ? AND record_id = ?', store, r.id);
  if (pending) return false;
  if (r.deleted_at) {
    db.runSync(
      `UPDATE ${store} SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      r.deleted_at,
      (r.updated_at as string) ?? r.deleted_at,
      r.id,
    );
    return true;
  }
  writeRow(store, r);
  return true;
}

// --- Hook React : relit la table quand les données changent ---

let version = 0;
dataChanged.subscribe(() => {
  version++;
});

const cache = new Map<Store, { version: number; data: unknown[] }>();

function snapshot<S extends Store>(store: S): StoreMap[S][] {
  const hit = cache.get(store);
  if (hit && hit.version === version) return hit.data as StoreMap[S][];
  const data = listAll(store);
  cache.set(store, { version, data });
  return data;
}

/** Données d'une collection, rafraîchies automatiquement (écritures locales et synchronisation). */
export function useStore<S extends Store>(store: S): StoreMap[S][] {
  return useSyncExternalStore(dataChanged.subscribe, () => snapshot(store), () => snapshot(store));
}
