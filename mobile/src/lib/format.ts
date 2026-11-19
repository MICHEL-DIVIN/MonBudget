import { parseLocalDate, toLocalDate } from './dates';

/** « 5 mars » — jour et mois à partir d'une date AAAA-MM-JJ (sans décalage de fuseau). */
export function formatDayMonth(dateStr: string, intl: string): string {
  return toLocalDate(dateStr).toLocaleDateString(intl, { day: 'numeric', month: 'long' });
}

export function formatFullDate(dateStr: string, intl: string): string {
  return toLocalDate(dateStr).toLocaleDateString(intl, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function monthName(intl: string, month: number, style: 'long' | 'short' = 'long'): string {
  const s = new Date(2024, month, 1).toLocaleDateString(intl, { month: style });
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/\.$/, '');
}

export function monthYear(intl: string, month: number, year: number): string {
  return `${monthName(intl, month)} ${year}`;
}

/** Libellé de groupe : Aujourd'hui / Hier / 5 mars. */
export function dayGroupLabel(dateStr: string, intl: string, today: string, yesterday: string, now = new Date()): string {
  const d = parseLocalDate(dateStr);
  const same = (ref: Date) => ref.getFullYear() === d.year && ref.getMonth() === d.month && ref.getDate() === d.day;
  if (same(now)) return today;
  if (same(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return yesterday;
  return formatDayMonth(dateStr, intl);
}

export function todayString(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Saisie décimale tolérante (« 12,5 » ou « 12.5 ») → nombre, ou NaN. */
export function parseDecimal(input: string): number {
  const n = Number(input.trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}
