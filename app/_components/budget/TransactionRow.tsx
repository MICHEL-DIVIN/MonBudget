"use client";

import { useState } from "react";
import { useCurrency } from "@/lib/currency/provider";
import Icon from "@/app/_components/ui/Icon";

interface TransactionRowProps {
  label: string;
  amount: number;
  date: string;
  icon: string;
  iconBg: string;
  type?: "expense" | "income";
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function TransactionRow({ label, amount, date, icon, iconBg, type = "expense", onEdit, onDelete }: TransactionRowProps) {
  const { formatAmount } = useCurrency();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex items-center gap-3 px-4 py-3.5" onClick={() => (onEdit || onDelete) && setExpanded(!expanded)}>
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        <span className="material-symbols-outlined text-[18px] text-on-surface/70">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-on-surface truncate">{label}</p>
        <p className="text-[11px] text-on-surface-variant">{date}</p>
      </div>

      {expanded && (onEdit || onDelete) ? (
        <div className="flex items-center gap-1">
          {onEdit && (
            <button onClick={(e) => { e.stopPropagation(); onEdit(); setExpanded(false); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-primary transition-colors">
              <Icon name="edit" size={16} />
            </button>
          )}
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); setExpanded(false); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-error transition-colors">
              <Icon name="delete" size={16} />
            </button>
          )}
        </div>
      ) : (
        <span className={`text-[15px] font-semibold tabular-nums ${type === "income" ? "text-success" : "text-on-surface"}`} suppressHydrationWarning>
          {type === "income" ? "+" : "−"}{formatAmount(amount)}
        </span>
      )}
    </div>
  );
}
