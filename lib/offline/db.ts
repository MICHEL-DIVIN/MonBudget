import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "monbudget-db";
const DB_VERSION = 1;

export interface MonBudgetDB {
  revenus: { key: string; value: import("@/lib/supabase/types").Revenu & { _dirty?: boolean; _deleted?: boolean } };
  depenses: { key: string; value: import("@/lib/supabase/types").Depense & { _dirty?: boolean; _deleted?: boolean } };
  envelopes: { key: string; value: import("@/lib/supabase/types").Envelope & { _dirty?: boolean; _deleted?: boolean } };
  objectifs: { key: string; value: import("@/lib/supabase/types").Objectif & { _dirty?: boolean; _deleted?: boolean } };
  profiles: { key: string; value: import("@/lib/supabase/types").Profile & { _dirty?: boolean; _deleted?: boolean } };
  sync_queue: { key: string; value: import("@/lib/supabase/types").SyncQueueItem };
}

let dbPromise: Promise<IDBPDatabase<MonBudgetDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<MonBudgetDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MonBudgetDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("revenus")) {
          db.createObjectStore("revenus", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("depenses")) {
          db.createObjectStore("depenses", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("envelopes")) {
          db.createObjectStore("envelopes", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("objectifs")) {
          db.createObjectStore("objectifs", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("profiles")) {
          db.createObjectStore("profiles", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("sync_queue")) {
          db.createObjectStore("sync_queue", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

const DATA_STORES = ["revenus", "depenses", "envelopes", "objectifs", "profiles"] as const;

export async function clearAllData() {
  const db = await getDB();
  for (const store of DATA_STORES) {
    await db.clear(store as unknown as never);
  }
  await db.clear("sync_queue" as unknown as never);
}
