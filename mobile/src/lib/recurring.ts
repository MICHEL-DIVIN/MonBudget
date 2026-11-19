import { v5 as uuidv5 } from 'uuid';
import { clampDay, formatLocalDate, monthsBetweenInclusive, parseLocalDate, sameCalendarMonth } from './dates';

/**
 * Transactions récurrentes (salaire, loyer, abonnements).
 *
 * Les occurrences d'un mois reçoivent un identifiant DÉTERMINISTE (uuid v5 du groupe + mois).
 * Deux appareils hors ligne qui génèrent le même mois produisent donc le même enregistrement :
 * à la synchronisation, il n'y a pas de doublon (le serveur fait un simple upsert).
 */

const NAMESPACE = '6f1c2b0e-8a54-4b7e-9d3a-2f0c5e7b1a90';

export interface RecurringRow {
  id: string;
  label: string;
  amount: number;
  date: string;
  recurring: boolean;
  recurring_group_id: string | null;
  /** Suppression logique (tombstone) : n'est plus compté, mais empêche de re-générer l'occurrence. */
  deleted: boolean;
}

export interface RecurringPlan<T extends RecurringRow> {
  /** Séries « historiques » sans groupe : on leur en attribue un (stable d'un appareil à l'autre). */
  assignGroups: { id: string; groupId: string }[];
  /** Occurrences manquantes à créer, copiées depuis le dernier élément de la série. */
  create: { template: T; id: string; date: string; groupId: string }[];
}

export function legacyGroupId(label: string, amount: number): string {
  return uuidv5(`legacy|${label}|${Number(amount)}`, NAMESPACE);
}

export function occurrenceId(groupId: string, year: number, month: number): string {
  return uuidv5(`${groupId}|${year}-${month + 1}`, NAMESPACE);
}

export function planRecurring<T extends RecurringRow>(rows: T[], now: Date): RecurringPlan<T> {
  const plan: RecurringPlan<T> = { assignGroups: [], create: [] };
  const knownIds = new Set(rows.map((r) => r.id));

  // Mois déjà « occupés » par une occurrence, supprimée ou non : une suppression volontaire ne doit pas ressusciter.
  const occupied = new Map<string, T[]>();
  for (const r of rows) {
    if (!r.recurring_group_id) continue;
    occupied.set(r.recurring_group_id, [...(occupied.get(r.recurring_group_id) ?? []), r]);
  }

  const groups = new Map<string, T[]>();
  for (const r of rows) {
    if (!r.recurring || r.deleted) continue;
    let groupId = r.recurring_group_id;
    if (!groupId) {
      groupId = legacyGroupId(r.label, r.amount);
      plan.assignGroups.push({ id: r.id, groupId });
    }
    const list = groups.get(groupId) ?? [];
    list.push(r);
    groups.set(groupId, list);
  }

  const today = formatLocalDate(now.getFullYear(), now.getMonth(), now.getDate());

  for (const [groupId, members] of groups) {
    const sorted = [...members].sort((a, b) => a.date.localeCompare(b.date));
    const anchor = parseLocalDate(sorted[0].date);
    const template = sorted[sorted.length - 1];

    for (const { year, month } of monthsBetweenInclusive(anchor.year, anchor.month, now.getFullYear(), now.getMonth())) {
      if (members.some((m) => sameCalendarMonth(m.date, year, month))) continue;
      if ((occupied.get(groupId) ?? []).some((m) => m.deleted && sameCalendarMonth(m.date, year, month))) continue;
      const date = formatLocalDate(year, month, clampDay(year, month, anchor.day));
      if (date > today) continue;
      const id = occurrenceId(groupId, year, month);
      if (knownIds.has(id)) continue; // déjà générée (éventuellement supprimée par l'utilisateur)
      knownIds.add(id);
      plan.create.push({ template, id, date, groupId });
    }
  }

  return plan;
}
