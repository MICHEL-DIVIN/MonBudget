"use client";

import { useState } from "react";
import { useCurrency } from "@/lib/currency/provider";
import Icon from "@/app/_components/ui/Icon";

interface IncomeRowProps {
  icon: string;
  iconBg: string;
  label: string;
  amount: number;
  editable?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function IncomeRow({
  icon,
  iconBg,
  label,
  amount,
  editable = false,
  onEdit,
  onDelete,
}: IncomeRowProps) {
  const { formatAmount, currency } = useCurrency();
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : currency;
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="flex items-center gap-4 p-4 bg-surface-container rounded-2xl relative"
      onClick={() => (onEdit || onDelete) && setShowActions(!showActions)}
    >
      <div
        className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}
      >
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="flex-1">
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="text-lg font-semibold text-on-surface" suppressHydrationWarning>
          {formatAmount(amount)}
        </p>
      </div>
      <span className="text-on-surface-variant text-lg">{symbol}</span>

      {/* Action buttons - visible on tap */}
      {(onEdit || onDelete) && showActions && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-surface-container rounded-xl p-1 z-10">
          {onEdit && (
            <button onClick={(e) => { e.stopPropagation(); onEdit(); setShowActions(false); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-primary transition-colors">
              <Icon name="edit" size={16} />
            </button>
          )}
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); setShowActions(false); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-error-container text-error transition-colors">
              <Icon name="delete" size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
