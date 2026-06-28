"use client";

import { useState, useEffect, useCallback } from "react";
import { isPinEnabled, verifyPin, isPinLockedOut, getPinLockoutRemainingMs } from "@/lib/security/pin";
import { useI18n } from "@/lib/i18n/provider";

export default function PinLock({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [lockoutMs, setLockoutMs] = useState(0);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setLocked(isPinEnabled());
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!locked) return;
    const tick = () => setLockoutMs(getPinLockoutRemainingMs());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [locked, error]);

  const tryUnlock = useCallback(async (value: string) => {
    if (value.length < 4 || isPinLockedOut()) return;
    const ok = await verifyPin(value);
    if (ok) {
      setLocked(false);
      setPin("");
      setError(false);
      setLockoutMs(0);
    } else {
      setError(true);
      setPin("");
      setLockoutMs(getPinLockoutRemainingMs());
      setTimeout(() => setError(false), 1500);
    }
  }, []);

  useEffect(() => {
    if (pin.length === 4) tryUnlock(pin);
  }, [pin, tryUnlock]);

  if (checking || !locked) return <>{children}</>;

  const lockedOut = lockoutMs > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-primary text-3xl">lock</span>
      </div>
      <h2 className="text-lg font-bold text-on-surface mb-2">{t.pin.title}</h2>
      <div className="flex gap-3 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors ${pin.length > i ? "bg-primary" : "bg-outline-variant"} ${error ? "bg-error" : ""}`}
          />
        ))}
      </div>
      {lockedOut && (
        <p className="text-sm text-on-surface-variant mb-4">
          Réessayez dans {Math.ceil(lockoutMs / 1000)} s
        </p>
      )}
      {error && !lockedOut && <p className="text-sm text-error mb-4">Code incorrect</p>}
      <div className="grid grid-cols-3 gap-3 max-w-[240px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => {
          if (key === "") return <div key="empty" />;
          return (
            <button
              key={key}
              type="button"
              disabled={lockedOut}
              onClick={() => {
                if (lockedOut) return;
                if (key === "del") setPin((p) => p.slice(0, -1));
                else if (pin.length < 4) setPin((p) => p + key);
              }}
              className="w-16 h-16 rounded-2xl bg-surface-container-high text-on-surface text-xl font-medium active:scale-95 transition-transform disabled:opacity-40"
            >
              {key === "del" ? (
                <span className="material-symbols-outlined text-xl">backspace</span>
              ) : key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
