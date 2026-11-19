import * as SQLite from 'expo-sqlite';

/**
 * Base locale (source de vérité de l'UI). Toute lecture/écriture de l'app passe par ici,
 * la synchronisation avec l'API se fait en arrière-plan (voir sync.ts).
 */
export const db = SQLite.openDatabaseSync('monbudget.db');

const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE envelopes (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    budgeted REAL NOT NULL DEFAULT 0,
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE revenus (
    id TEXT PRIMARY KEY NOT NULL,
    label TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'autre',
    date TEXT NOT NULL,
    recurring INTEGER NOT NULL DEFAULT 0,
    recurring_group_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX idx_revenus_date ON revenus(date);
  CREATE TABLE depenses (
    id TEXT PRIMARY KEY NOT NULL,
    label TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    envelope_id TEXT,
    date TEXT NOT NULL,
    recurring INTEGER NOT NULL DEFAULT 0,
    recurring_group_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX idx_depenses_date ON depenses(date);
  CREATE TABLE objectifs (
    id TEXT PRIMARY KEY NOT NULL,
    label TEXT NOT NULL,
    target_amount REAL NOT NULL DEFAULT 0,
    current_amount REAL NOT NULL DEFAULT 0,
    deadline TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  -- File d'envoi : une seule entrée par enregistrement (la dernière opération gagne),
  -- l'ordre d'insertion est conservé pour envoyer une enveloppe avant les dépenses qui la référencent.
  CREATE TABLE outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store TEXT NOT NULL,
    record_id TEXT NOT NULL,
    op TEXT NOT NULL,
    payload TEXT NOT NULL,
    rev INTEGER NOT NULL DEFAULT 0,
    UNIQUE(store, record_id)
  );
  CREATE TABLE meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );
  `,
];

export function migrate(): void {
  db.execSync('PRAGMA journal_mode = WAL;');
  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.withTransactionSync(() => {
      db.execSync(MIGRATIONS[v]);
      db.execSync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

migrate();

// --- Préférences / métadonnées (lecture synchrone : pas de « flash » au démarrage) ---

export function getMeta(key: string): string | null {
  return db.getFirstSync<{ value: string | null }>('SELECT value FROM meta WHERE key = ?', key)?.value ?? null;
}

export function setMeta(key: string, value: string | null): void {
  if (value === null) db.runSync('DELETE FROM meta WHERE key = ?', key);
  else db.runSync('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

export function getJsonMeta<T>(key: string, fallback: T): T {
  try {
    const raw = getMeta(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function setJsonMeta(key: string, value: unknown): void {
  setMeta(key, JSON.stringify(value));
}

/** Efface toutes les données de l'utilisateur (changement de compte / déconnexion). Garde les préférences d'affichage. */
export function wipeUserData(): void {
  db.withTransactionSync(() => {
    for (const t of ['envelopes', 'revenus', 'depenses', 'objectifs', 'outbox']) db.runSync(`DELETE FROM ${t}`);
    db.runSync(`DELETE FROM meta WHERE key LIKE 'sync.%' OR key LIKE 'notif.%' OR key = 'user.profile'`);
  });
}
