"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { getDB } from "./db";
import { enqueueSync } from "./sync";
import { v4 as uuidv4 } from "uuid";
import { useUserId } from "@/lib/auth/provider";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getOnlineSnapshot, getServerSnapshot);
}

export function useOfflineData<T extends { id: string }>(storeName: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = useUserId();

  const loadData = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const db = await getDB();
      const all = await db.getAll(storeName as unknown as never);
      const filtered = all.filter((item: Record<string, unknown>) => {
        if (item._deleted) return false;
        if (storeName === "profiles") return item.id === userId;
        return item.user_id === userId;
      });
      setData(filtered as T[]);
    } catch {
      // DB not ready
    } finally {
      setLoading(false);
    }
  }, [storeName, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addItem = useCallback(
    async (item: Omit<T, "id" | "created_at" | "updated_at">) => {
      const rec = item as Record<string, unknown>;
      if ("amount" in rec && (typeof rec.amount !== "number" || rec.amount <= 0)) return null;
      if ("budgeted" in rec && (typeof rec.budgeted !== "number" || rec.budgeted < 0)) return null;
      if ("target_amount" in rec && (typeof rec.target_amount !== "number" || rec.target_amount < 0)) return null;
      if ("current_amount" in rec && (typeof rec.current_amount !== "number" || rec.current_amount < 0)) return null;

      const db = await getDB();
      const now = new Date().toISOString();
      const newItem = {
        ...item,
        id: uuidv4(),
        created_at: now,
        updated_at: now,
        _dirty: true,
        _deleted: false,
      };
      if (storeName !== "profiles" && !(newItem as Record<string, unknown>).user_id) {
        (newItem as Record<string, unknown>).user_id = userId;
      }
      await db.put(storeName as unknown as never, newItem as never);
      await enqueueSync(storeName, "create", newItem as Record<string, unknown>);
      await loadData();
      return newItem;
    },
    [storeName, loadData, userId]
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<T>) => {
      const upd = updates as Record<string, unknown>;
      if ("amount" in upd && (typeof upd.amount !== "number" || upd.amount <= 0)) return;
      if ("budgeted" in upd && (typeof upd.budgeted !== "number" || upd.budgeted < 0)) return;
      if ("target_amount" in upd && (typeof upd.target_amount !== "number" || upd.target_amount < 0)) return;
      if ("current_amount" in upd && (typeof upd.current_amount !== "number" || upd.current_amount < 0)) return;

      const db = await getDB();
      const existing = await db.get(storeName as unknown as never, id);
      if (!existing) return;
      const updated = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
        _dirty: true,
      };
      await db.put(storeName as unknown as never, updated as never);
      await enqueueSync(storeName, "update", updated as Record<string, unknown>);
      await loadData();
    },
    [storeName, loadData]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const db = await getDB();
      const existing = await db.get(storeName as unknown as never, id);
      if (!existing) return;
      const deleted = { ...existing, _deleted: true, _dirty: true };
      await db.put(storeName as unknown as never, deleted as never);
      await enqueueSync(storeName, "delete", { id });
      await loadData();
    },
    [storeName, loadData]
  );

  return { data, loading, addItem, updateItem, deleteItem, reload: loadData };
}
