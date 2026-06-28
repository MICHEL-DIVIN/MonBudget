"use client";

import { createContext, useContext, type ReactNode } from "react";

interface TransactionFormContextValue {
  openForm: (type: "expense" | "income") => void;
}

const TransactionFormContext = createContext<TransactionFormContextValue>({
  openForm: () => {},
});

export function useTransactionForm() {
  return useContext(TransactionFormContext);
}

export function TransactionFormProvider({
  children,
  openForm,
}: {
  children: ReactNode;
  openForm: (type: "expense" | "income") => void;
}) {
  return (
    <TransactionFormContext.Provider value={{ openForm }}>
      {children}
    </TransactionFormContext.Provider>
  );
}
