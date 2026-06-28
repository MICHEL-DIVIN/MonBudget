import type { Depense, Revenu } from "@/lib/supabase/types";

export type RecurringRecord = (Revenu | Depense) & { _dirty?: boolean; _deleted?: boolean };

export function legacySeriesIdentity(item: RecurringRecord): string {
  return `${item.user_id}|legacy|${item.label}|${Number(item.amount)}`;
}

export function seriesKey(item: RecurringRecord): string {
  if (item.recurring_group_id) {
    return `${item.user_id}|${item.recurring_group_id}`;
  }
  return legacySeriesIdentity(item);
}

/** Reuse group id from generated siblings when backfilling legacy anchor records. */
export function findExistingGroupId(
  allItems: RecurringRecord[],
  sample: RecurringRecord
): string | null {
  const match = allItems.find(
    (r) =>
      !r._deleted &&
      r.user_id === sample.user_id &&
      r.label === sample.label &&
      Number(r.amount) === Number(sample.amount) &&
      !!r.recurring_group_id
  );
  return match?.recurring_group_id ?? null;
}

export function groupLegacyRecurring(
  items: RecurringRecord[]
): Map<string, RecurringRecord[]> {
  const map = new Map<string, RecurringRecord[]>();
  for (const item of items) {
    if (!item.recurring || item._deleted || item.recurring_group_id) continue;
    const key = legacySeriesIdentity(item);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}
