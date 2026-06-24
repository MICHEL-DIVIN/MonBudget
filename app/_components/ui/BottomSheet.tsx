"use client";

import { useEffect } from "react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 animate-fade-in" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-surface-container-high rounded-t-[20px] animate-slide-up max-h-[88dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center pt-3 pb-2 px-5 shrink-0">
          <div className="w-10 h-1 bg-outline-variant/40 rounded-full" />
          {title && <h2 className="text-base font-semibold text-on-surface mt-3 self-start">{title}</h2>}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}
