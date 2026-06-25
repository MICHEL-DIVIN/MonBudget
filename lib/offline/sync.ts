import { getDB } from "./db";
import { supabase } from "@/lib/supabase/client";
import { v4 as uuidv4 } from "uuid";
import type { SyncQueueItem } from "@/lib/supabase/types";

const SYNCABLE_STORES = ["revenus", "depenses", "envelopes", "objectifs"] as const;

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

export async function enqueueSync(
  store: string,
  operation: SyncQueueItem["operation"],
  data: Record<string, unknown>
): Promise<void> {
  const db = await getDB();
  const item: SyncQueueItem = {
    id: uuidv4(),
    store,
    operation,
    data,
    created_at: new Date().toISOString(),
  };
  await db.put("sync_queue", item);
}

export async function processQueue(): Promise<void> {
  const db = await getDB();
  const items = await db.getAll("sync_queue");
  const userId = getCurrentUserId();

  for (const item of items) {
    try {
      const table = item.store;
      const itemUserId = item.data.user_id as string | undefined;
      if (userId && itemUserId && itemUserId !== userId) {
        await db.delete("sync_queue", item.id);
        continue;
      }

      let syncError = null;

      if (item.operation === "create") {
        const { _dirty, _deleted, ...cleanData } = item.data as Record<string, unknown>;
        const { error } = await supabase.from(table).upsert(cleanData);
        syncError = error;
      } else if (item.operation === "update") {
        const { _dirty, _deleted, id, created_at, user_id, ...updates } = item.data as Record<string, unknown>;
        const { error } = await supabase.from(table).update(updates).eq("id", id);
        syncError = error;
      } else if (item.operation === "delete") {
        const { error } = await supabase.from(table).delete().eq("id", item.data.id as string);
        syncError = error;
      }

      if (syncError) {
        if (isAuthError(syncError)) { await supabase.auth.signOut(); return; }
        continue;
      }

      if (item.operation !== "delete" && item.data.id) {
        try {
          const record = await db.get(table as unknown as never, item.data.id as string);
          if (record) {
            (record as Record<string, unknown>)._dirty = false;
            await db.put(table as unknown as never, record as never);
          }
        } catch { /* non-critical */ }
      }

      await db.delete("sync_queue", item.id);
    } catch (err) {
      if (isAuthError(err)) {
        await supabase.auth.signOut();
        return;
      }
    }
  }
}

export async function pullFromSupabase(): Promise<void> {
  const db = await getDB();
  const userId = getCurrentUserId();
  if (!userId) return;

  for (const store of SYNCABLE_STORES) {
    try {
      const { data, error } = await supabase
        .from(store)
        .select("*")
        .eq("user_id", userId) as { data: Record<string, unknown>[] | null; error: { status?: number; message?: string } | null };

      if (error) {
        if (isAuthError(error)) {
          await supabase.auth.signOut();
          return;
        }
        continue;
      }
      if (!data) continue;

      const tx = db.transaction(store, "readwrite");
      for (const row of data) {
        if (row.user_id !== userId) continue;
        const existing = await tx.store.get(row.id as string);
        if (!existing || !existing._dirty) {
          await tx.store.put({ ...row, _dirty: false, _deleted: false } as never);
        }
      }
      await tx.done;
    } catch (err) {
      if (isAuthError(err)) {
        await supabase.auth.signOut();
        return;
      }
    }
  }
}

export async function syncAll(): Promise<void> {
  await processQueue();
  await pullFromSupabase();
}
