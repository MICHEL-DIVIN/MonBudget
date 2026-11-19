import { daysInMonth, formatLocalDate } from './dates';
import { planRecurring, type RecurringRow } from './recurring';

export interface UpcomingItem {
  id: string;
  label: string;
  amount: number;
  date: string;
  kind: 'income' | 'expense';
}

/**
 * Occurrences récurrentes attendues dans l'intervalle ]aujourd'hui ; until] (pas encore générées
 * parce que leur date n'est pas arrivée) : loyer du 28, salaire du 30…
 */
export function upcomingBetween(revenus: RecurringRow[], depenses: RecurringRow[], now: Date, until: Date): UpcomingItem[] {
  const today = formatLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
  const end = formatLocalDate(until.getFullYear(), until.getMonth(), until.getDate());

  const pick = (rows: RecurringRow[], kind: UpcomingItem['kind']) =>
    planRecurring(rows, until)
      .create.filter((c) => c.date > today && c.date <= end)
      .map((c) => ({ id: c.id, label: c.template.label, amount: c.template.amount, date: c.date, kind }));

  return [...pick(revenus, 'income'), ...pick(depenses, 'expense')].sort((a, b) => a.date.localeCompare(b.date));
}

/** Échéances récurrentes encore attendues d'ici la fin du mois courant. */
export function upcomingRecurring(revenus: RecurringRow[], depenses: RecurringRow[], now = new Date()): UpcomingItem[] {
  return upcomingBetween(revenus, depenses, now, new Date(now.getFullYear(), now.getMonth(), daysInMonth(now.getFullYear(), now.getMonth())));
}

export interface MonthForecast {
  /** Revenus déjà perçus + attendus d'ici la fin du mois. */
  expectedIncome: number;
  /** Dépenses déjà faites + récurrentes encore à venir. */
  expectedExpenses: number;
  upcomingIncome: number;
  upcomingExpenses: number;
  /** Ce qu'il reste réellement pour le reste du mois, une fois les échéances connues payées. */
  leftToSpend: number;
  /** Jours restants, aujourd'hui compris. */
  daysLeft: number;
  perDay: number;
}

export function monthForecast(income: number, expenses: number, upcoming: UpcomingItem[], now = new Date()): MonthForecast {
  const upcomingIncome = upcoming.filter((u) => u.kind === 'income').reduce((s, u) => s + u.amount, 0);
  const upcomingExpenses = upcoming.filter((u) => u.kind === 'expense').reduce((s, u) => s + u.amount, 0);
  const expectedIncome = income + upcomingIncome;
  const expectedExpenses = expenses + upcomingExpenses;
  const leftToSpend = expectedIncome - expectedExpenses;
  const daysLeft = daysInMonth(now.getFullYear(), now.getMonth()) - now.getDate() + 1;
  return {
    expectedIncome,
    expectedExpenses,
    upcomingIncome,
    upcomingExpenses,
    leftToSpend,
    daysLeft,
    perDay: leftToSpend > 0 ? leftToSpend / daysLeft : 0,
  };
}
