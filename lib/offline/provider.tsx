"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useOnlineStatus } from "./hooks";
import { scheduleSyncAll, isPullInProgress } from "./sync";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/provider";

interface OfflineContextValue {
  isOnline: boolean;
}

const OfflineContext = createContext<OfflineContextValue>({ isOnline: true });

export function useOffline() {
  return useContext(OfflineContext);
}

export default function OfflineProvider({ children }: { children: ReactNode }) {
  const isOnline = useOnlineStatus();
  const hasSynced = useRef(false);
  const wasOffline = useRef(false);
  const { user } = useAuth();

  useEffect(() => {
    if (isOnline) {
      if (!hasSynced.current || wasOffline.current) {
        hasSynced.current = true;
        wasOffline.current = false;
        scheduleSyncAll().catch(() => {});
      }
    } else {
      wasOffline.current = true;
    }
  }, [isOnline]);

  useEffect(() => {
    if (!user || !isOnline) return;

    const channel = supabase
      .channel(`sync-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "revenus", filter: `user_id=eq.${user.id}` },
        () => { if (!isPullInProgress()) scheduleSyncAll().catch(() => {}); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "depenses", filter: `user_id=eq.${user.id}` },
        () => { if (!isPullInProgress()) scheduleSyncAll().catch(() => {}); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "envelopes", filter: `user_id=eq.${user.id}` },
        () => { if (!isPullInProgress()) scheduleSyncAll().catch(() => {}); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "objectifs", filter: `user_id=eq.${user.id}` },
        () => { if (!isPullInProgress()) scheduleSyncAll().catch(() => {}); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => { if (!isPullInProgress()) scheduleSyncAll().catch(() => {}); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isOnline]);

  return (
    <OfflineContext.Provider value={{ isOnline }}>
      {children}
    </OfflineContext.Provider>
  );
}
