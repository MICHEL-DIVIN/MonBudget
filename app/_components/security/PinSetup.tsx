"use client";

import { useState } from "react";
import Button from "@/app/_components/ui/Button";
import { setPin, removePin, isPinEnabled } from "@/lib/security/pin";
import { useToast } from "@/app/_components/ui/Toast";
import { useI18n } from "@/lib/i18n/provider";

interface PinSetupProps {
  onClose: () => void;
}

export default function PinSetup({ onClose }: PinSetupProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [firstPin, setFirstPin] = useState("");
  const [pin, setPin] = useState("");
  const [enabled] = useState(isPinEnabled());

  function handleDigit(d: string) {
    const target = step === "enter" ? setFirstPin : setPin;
    const current = step === "enter" ? firstPin : pin;
    if (d === "del") {
      target(current.slice(0, -1));
      return;
    }
    if (current.length >= 4) return;
    const next = current + d;
    target(next);
    if (next.length === 4) {
      if (step === "enter") {
        setTimeout(() => setStep("confirm"), 200);
      } else {
        setTimeout(async () => {
          if (next !== firstPin) {
            toast(t.pin.mismatch, "error");
            setStep("enter");
            setFirstPin("");
            setPin("");
          } else {
            await setPin(next);
            toast("PIN activé", "success");
            onClose();
          }
        }, 200);
      }
    }
  }

  async function handleRemove() {
    removePin();
    toast("PIN désactivé", "info");
    onClose();
  }

  const displayPin = step === "enter" ? firstPin : pin;

  return (
    <div className="space-y-4">
      {enabled && (
        <Button variant="outline" size="md" onClick={handleRemove} className="w-full">
          {t.settings.pinRemove}
        </Button>
      )}
      <p className="text-sm text-on-surface-variant text-center">
        {step === "enter" ? t.pin.setup : t.pin.confirm}
      </p>
      <div className="flex gap-3 justify-center mb-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`w-3 h-3 rounded-full ${displayPin.length > i ? "bg-primary" : "bg-outline-variant"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => {
          if (key === "") return <div key="empty" />;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleDigit(key)}
              className="w-16 h-16 rounded-2xl bg-surface-container-high text-on-surface text-xl font-medium active:scale-95 transition-transform mx-auto"
            >
              {key === "del" ? <span className="material-symbols-outlined text-xl">backspace</span> : key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
