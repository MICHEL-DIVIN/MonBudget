"use client";

import { useEffect } from "react";
import Icon from "./Icon";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 animate-fade-in" />

      {/* Panel */}
      <div
        className={`
          relative w-full ${sizeClasses[size]}
          bg-surface-container-lowest rounded-2xl shadow-elevated p-6
          animate-scale-in
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          <Icon name="close" size={20} />
        </button>

        {/* Title */}
        {title && (
          <h2 className="text-lg font-semibold text-on-surface mb-4 pr-8">
            {title}
          </h2>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  );
}
