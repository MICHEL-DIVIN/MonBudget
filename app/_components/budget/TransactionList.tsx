"use client";

import TransactionRow from "./TransactionRow";

interface Transaction {
  id: string;
  label: string;
  amount: number;
  date: string;
  icon: string;
  iconBg: string;
  type?: "expense" | "income";
}

interface TransactionListProps {
  title: string;
  transactions: Transaction[];
  className?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function TransactionList({
  title,
  transactions,
  className = "",
  onEdit,
  onDelete,
}: TransactionListProps) {
  return (
    <section className={className}>
      <h2 className="text-[13px] font-medium text-on-surface-variant mb-2 md:mb-3">{title}</h2>
      <div className="flex flex-col gap-2 md:gap-3">
        {transactions.map((tx) => (
          <TransactionRow
            key={tx.id}
            label={tx.label}
            amount={tx.amount}
            date={tx.date}
            icon={tx.icon}
            iconBg={tx.iconBg}
            type={tx.type}
            onEdit={onEdit ? () => onEdit(tx.id) : undefined}
            onDelete={onDelete ? () => onDelete(tx.id) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
