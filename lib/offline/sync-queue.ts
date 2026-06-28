import { getDB } from "./db";
import { supabase } from "@/lib/supabase/client";
import { v4 as uuidv4 } from "uuid";
import type { SyncQueueItem } from "@/lib/supabase/types";

export interface SyncQueueResult {
  failed: number;
  lastMessage: string | null;
}

function isAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  if (e.status === 401 || e.status === 403) return true;
  if (typeof e.message === "string" && (e.message.includes("JWT") || e.message.includes("token"))) return true;
  return false;
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && typeof (err as { message?: string }).message === "string") {
    return (err as { message: string }).message;
  }
  return "Erreur de synchronisation";
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

export async function processQueue(): Promise<SyncQueueResult> {
  const db = await getDB();
  const items = await db.getAll("sync_queue");
  const userId = getCurrentUserId();
  let failed = 0;
  let lastMessage: string | null = null;

  for (const item of items) {
    try {
      const table = item.store;
      const itemUserId = item.data.user_id as string | undefined;
      if (userId && itemUserId && itemUserId !== userId) {
        await db.delete("sync_queue", item.id);
        continue;
      }

      let syncError: unknown = null;

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
        failed++;
        lastMessage = isAuthError(syncError)
          ? "Session expirée — reconnectez-vous pour synchroniser"
          : errorMessage(syncError);
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
      failed++;
      lastMessage = errorMessage(err);
    }
  }

  return { failed, lastMessage };
}
