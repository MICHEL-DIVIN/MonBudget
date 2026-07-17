"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { SYNC_ERROR_EVENT } from "@/lib/offline/events";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

const DURATION: Record<ToastType, number> = {
  success: 3000,
  info: 3000,
  warning: 4000,
  error: 5000,
};

const ICON: Record<ToastType, string> = {
  success: "check_circle",
  error: "error",
  info: "info",
  warning: "warning",
};

const COLOR: Record<ToastType, string> = {
  success: "#22c55e",
  error: "#ef4444",
  info: "#8b5cf6",
  warning: "#f59e0b",
};

const BG: Record<ToastType, string> = {
  success: "rgba(34,197,94,0.12)",
  error: "rgba(239,68,68,0.12)",
  info: "rgba(139,92,246,0.12)",
  warning: "rgba(245,158,11,0.12)",
};

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), DURATION[type]);
  }, []);

  useEffect(() => {
    function onSyncError(e: Event) {
      const message = (e as CustomEvent<string>).detail;
      if (message) toast(message, "error");
    }
    window.addEventListener(SYNC_ERROR_EVENT, onSyncError);
    return () => window.removeEventListener(SYNC_ERROR_EVENT, onSyncError);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 60,
          left: 0,
          right: 0,
          zIndex: 80,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          pointerEvents: "none",
          padding: "0 16px",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              width: "100%",
              maxWidth: 380,
              background: "#252530",
              border: `1px solid ${COLOR[t.type]}22`,
              borderRadius: 14,
              padding: "11px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              pointerEvents: "auto",
              boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${COLOR[t.type]}11`,
              animation: "slideUp 0.25s ease-out",
              boxSizing: "border-box",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 20,
                color: COLOR[t.type],
                background: BG[t.type],
                borderRadius: 8,
                padding: 4,
                flexShrink: 0,
                fontVariationSettings: "'FILL' 1",
              }}
            >
              {ICON[t.type]}
            </span>
            <span
              style={{
                fontSize: 13,
                color: "#f0f0f4",
                lineHeight: 1.4,
                flex: 1,
                wordBreak: "break-word",
              }}
            >
              {t.message}
            </span>
            <button
              onClick={() => dismiss(t.id)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.06)",
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
                color: "#6b6b80",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
