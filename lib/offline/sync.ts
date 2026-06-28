import { getDB } from "./db";
import { processQueue } from "./sync-queue";
import { generateRecurringTransactions } from "./recurring";
import { notifyDataChanged, notifySyncError } from "./events";
import { supabase } from "@/lib/supabase/client";

const SYNCABLE_STORES = ["revenus", "depenses", "envelopes", "objectifs", "profiles"] as const;
const SYNC_DEBOUNCE_MS = 800;

let syncInProgress = false;
let syncPending = false;
let pullInProgress = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let debounceResolvers: Array<() => void> = [];

export { enqueueSync } from "./sync-queue";

export function isPullInProgress(): boolean {
  return pullInProgress;
}

function isAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  if (e.status === 401 || e.status === 403) return true;
  if (typeof e.message === "string" && (e.message.includes("JWT") || e.message.includes("token"))) return true;
  return false;
}

function getCurrentUserId(): string | null {
  try {
    return localStorage.getItem("monbudget-last-user-id");
  } catch {
    return null;
  }
}

const SYNC_META_KEYS = new Set(["_dirty", "_deleted"]);

function remoteRowsEqual(
  existing: Record<string, unknown> | undefined,
  row: Record<string, unknown>
): boolean {
  const keys = new Set([
    ...Object.keys(existing ?? {}),
    ...Object.keys(row),
  ]);
  for (const key of keys) {
    if (SYNC_META_KEYS.has(key)) continue;
    if (JSON.stringify(existing?.[key]) !== JSON.stringify(row[key])) return false;
  }
  return true;
}

export async function pullFromSupabase(): Promise<boolean> {
  const db = await getDB();
  const userId = getCurrentUserId();
  if (!userId) return false;

  pullInProgress = true;
  let changed = false;

  try {
    for (const store of SYNCABLE_STORES) {
      try {
        const isProfile = store === "profiles";
        const query = supabase.from(store).select("*");
        const { data, error } = (isProfile
          ? await query.eq("id", userId)
          : await query.eq("user_id", userId)) as { data: Record<string, unknown>[] | null; error: { status?: number; message?: string } | null };

        if (error) {
          if (isAuthError(error)) continue;
          continue;
        }
        if (!data) continue;

        const tx = db.transaction(store, "readwrite");
        for (const row of data) {
          if (!isProfile && row.user_id !== userId) continue;
          if (isProfile && row.id !== userId) continue;
          const rowId = row.id as string;
          const existing = await tx.store.get(rowId) as Record<string, unknown> | undefined;
          if (!existing || !existing._dirty) {
            const next = { ...row, _dirty: false, _deleted: false };
            if (!remoteRowsEqual(existing, row)) {
              changed = true;
              await tx.store.put(next as never);
            }
          }
        }
        await tx.done;
      } catch {
        /* continue other stores */
      }
    }
  } finally {
    pullInProgress = false;
  }

  return changed;
}

export async function syncAll(): Promise<void> {
  if (syncInProgress) {
    syncPending = true;
    return;
  }

  syncInProgress = true;
  try {
    const queueResult = await processQueue();
    if (queueResult.failed > 0 && queueResult.lastMessage) {
      notifySyncError(queueResult.lastMessage);
    }
    const pulled = await pullFromSupabase();
    let recurringCreated = 0;
    let recurringMigrated = 0;
    try {
      const recurringResult = await generateRecurringTransactions(getCurrentUserId() ?? undefined);
      recurringCreated = recurringResult.created;
      recurringMigrated = recurringResult.migrated;
    } catch { /* not critical */ }

    if (pulled || recurringCreated > 0 || recurringMigrated > 0) {
      notifyDataChanged();
    }
  } finally {
    syncInProgress = false;
    if (syncPending) {
      syncPending = false;
      await syncAll();
    }
  }
}

/** Debounced entry point for Realtime / online events. */
export function scheduleSyncAll(): Promise<void> {
  return new Promise((resolve) => {
    debounceResolvers.push(resolve);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      const resolvers = debounceResolvers;
      debounceResolvers = [];
      try {
        await syncAll();
      } finally {
        resolvers.forEach((r) => r());
      }
    }, SYNC_DEBOUNCE_MS);
  });
}
