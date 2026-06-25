"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useOnlineStatus } from "./hooks";
import { syncAll } from "./sync";

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

  useEffect(() => {
    if (isOnline) {
      if (!hasSynced.current || wasOffline.current) {
        hasSynced.current = true;
        wasOffline.current = false;
        syncAll().catch(() => {});
      }
    } else {
      wasOffline.current = true;
    }
  }, [isOnline]);

  return (
    <OfflineContext.Provider value={{ isOnline }}>
      {children}
    </OfflineContext.Provider>
  );
}
