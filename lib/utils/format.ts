const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(date: string | Date): string {
  return dateFormatter.format(new Date(date));
}

const monthYearFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

export function formatMonthYear(date: Date): string {
  return monthYearFormatter.format(date);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
