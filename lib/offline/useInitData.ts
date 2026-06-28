"use client";

import { useEffect, useRef } from "react";
import { getDB, clearAllData } from "./db";
import { supabase } from "@/lib/supabase/client";
import { generateRecurringTransactions } from "./recurring";
import { notifyDataChanged } from "./events";
import { useAuth } from "@/lib/auth/provider";

const LAST_USER_KEY = "monbudget-last-user-id";

export function useInitData() {
  const { user } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const lastUserId = localStorage.getItem(LAST_USER_KEY);
    const userChanged = lastUserId !== null && lastUserId !== userId;

    if (initialized.current && !userChanged) return;
    initialized.current = true;

    async function init() {
      if (userChanged) {
        await clearAllData();
      }

      localStorage.setItem(LAST_USER_KEY, userId!);

      const db = await getDB();

      const existingEnvelopes = await db.getAll("envelopes");
      const userEnvelopes = existingEnvelopes.filter(
        (e: Record<string, unknown>) => e.user_id === userId && !e._deleted
      );
      const needsBootstrap = userEnvelopes.length === 0;

      if (needsBootstrap) try {
        const [envelopesRes, revenusRes, depensesRes, objectifsRes, profilesRes] =
          await Promise.all([
            supabase.from("envelopes").select("*").eq("user_id", userId),
            supabase.from("revenus").select("*").eq("user_id", userId),
            supabase.from("depenses").select("*").eq("user_id", userId),
            supabase.from("objectifs").select("*").eq("user_id", userId),
            supabase.from("profiles").select("*").eq("id", userId),
          ]);

        const txP = db.transaction("profiles", "readwrite");
        for (const row of profilesRes.data ?? []) {
          await txP.store.put({ ...row, _dirty: false, _deleted: false });
        }
        await txP.done;

        const tx1 = db.transaction("envelopes", "readwrite");
        for (const row of envelopesRes.data ?? []) {
          await tx1.store.put({ ...row, _dirty: false, _deleted: false });
        }
        await tx1.done;

        const tx2 = db.transaction("revenus", "readwrite");
        for (const row of revenusRes.data ?? []) {
          await tx2.store.put({ ...row, _dirty: false, _deleted: false });
        }
        await tx2.done;

        const tx3 = db.transaction("depenses", "readwrite");
        for (const row of depensesRes.data ?? []) {
          await tx3.store.put({ ...row, _dirty: false, _deleted: false });
        }
        await tx3.done;

        const tx4 = db.transaction("objectifs", "readwrite");
        for (const row of objectifsRes.data ?? []) {
          await tx4.store.put({ ...row, _dirty: false, _deleted: false });
        }
        await tx4.done;
      } catch {
        // Offline
      }

      try {
        const created = await generateRecurringTransactions(userId);
        if (created.created > 0 || created.migrated > 0) notifyDataChanged();
      } catch {
        // Not critical
      }
    }

    init();
  }, [user]);
}
