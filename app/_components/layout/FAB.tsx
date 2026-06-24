"use client";

import { useState } from "react";

interface FABProps {
  onAddExpense?: () => void;
  onAddIncome?: () => void;
}

export default function FAB({ onAddExpense, onAddIncome }: FABProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed md:hidden right-5 z-40" style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}>
      {/* Menu options */}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-14 right-0 z-40 flex flex-col gap-2 items-end animate-slide-up">
            <button
              onClick={() => { onAddIncome?.(); setOpen(false); }}
              className="flex items-center gap-2 bg-success rounded-xl px-4 py-2.5 text-white active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-lg">arrow_downward</span>
              <span className="text-[13px] font-medium">Revenu</span>
            </button>
            <button
              onClick={() => { onAddExpense?.(); setOpen(false); }}
              className="flex items-center gap-2 bg-error rounded-xl px-4 py-2.5 text-white active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-lg">arrow_upward</span>
              <span className="text-[13px] font-medium">Dépense</span>
            </button>
          </div>
        </>
      )}

      {/* Main FAB */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-12 h-12 rounded-2xl bg-primary text-on-primary shadow-elevated flex items-center justify-center active:scale-90 transition-all duration-200 ${open ? "rotate-45" : ""}`}
        aria-label="Ajouter"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>
    </div>
  );
}
