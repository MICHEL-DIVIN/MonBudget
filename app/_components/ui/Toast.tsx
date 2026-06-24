"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  toast: (message: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const iconMap = { success: "check_circle", error: "error", info: "info" };
  const colorMap = { success: "#22c55e", error: "#ef4444", info: "#8b5cf6" };
  const bgMap = { success: "rgba(34,197,94,0.12)", error: "rgba(239,68,68,0.12)", info: "rgba(139,92,246,0.12)" };

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
              maxWidth: 360,
              background: "#252530",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              pointerEvents: "auto",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              animation: "slideUp 0.25s ease-out",
              boxSizing: "border-box",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 20,
                color: colorMap[t.type],
                background: bgMap[t.type],
                borderRadius: 8,
                padding: 4,
                flexShrink: 0,
                fontVariationSettings: "'FILL' 1",
              }}
            >
              {iconMap[t.type]}
            </span>
            <span style={{ fontSize: 13, color: "#f0f0f4", lineHeight: 1.4, flex: 1, wordBreak: "break-word" }}>
              {t.message}
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
