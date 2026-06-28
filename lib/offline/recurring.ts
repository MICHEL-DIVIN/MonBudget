import { getDB } from "./db";
import { enqueueSync } from "./sync-queue";
import { v4 as uuidv4 } from "uuid";
import type { Revenu, Depense } from "@/lib/supabase/types";
import {
  parseLocalDate,
  formatLocalDate,
  sameCalendarMonth,
  clampDay,
  monthsBetweenInclusive,
} from "@/lib/utils/dates";
import {
  seriesKey,
  findExistingGroupId,
  groupLegacyRecurring,
  type RecurringRecord,
} from "./recurring-series";

function existsInMonth(
  items: RecurringRecord[],
  year: number,
  month: number,
  key: string
): boolean {
  return items.some(
    (r) =>
      !r._deleted &&
      seriesKey(r) === key &&
      sameCalendarMonth(r.date, year, month)
  );
}

function findAnchorDay(items: RecurringRecord[], key: string): number {
  let minYear = 9999;
  let minMonth = 11;
  let day = 1;
  for (const item of items) {
    if (item._deleted || seriesKey(item) !== key) continue;
    const d = parseLocalDate(item.date);
    if (d.year < minYear || (d.year === minYear && d.month < minMonth)) {
      minYear = d.year;
      minMonth = d.month;
      day = d.day;
    }
  }
  return day;
}

function findAnchorMonth(items: RecurringRecord[], key: string): { year: number; month: number } {
  let minYear = 9999;
  let minMonth = 11;
  for (const item of items) {
    if (item._deleted || seriesKey(item) !== key) continue;
    const d = parseLocalDate(item.date);
    if (d.year < minYear || (d.year === minYear && d.month < minMonth)) {
      minYear = d.year;
      minMonth = d.month;
    }
  }
  return { year: minYear, month: minMonth };
}

async function migrateLegacySeries(
  store: "revenus" | "depenses",
  allItems: RecurringRecord[]
): Promise<number> {
  const db = await getDB();
  const legacyGroups = groupLegacyRecurring(allItems);
  if (legacyGroups.size === 0) return 0;

  let migrated = 0;
  const nowIso = new Date().toISOString();

  for (const members of legacyGroups.values()) {
    const sample = members[0];
    const groupId = findExistingGroupId(allItems, sample) ?? uuidv4();

    for (const member of members) {
      const updated = {
        ...member,
        recurring_group_id: groupId,
        updated_at: nowIso,
        _dirty: true,
      };
      await db.put(store, updated as never);
      await enqueueSync(store, "update", updated as Record<string, unknown>);
      Object.assign(member, {
        recurring_group_id: groupId,
        updated_at: nowIso,
        _dirty: true,
      });
      migrated++;
    }
  }

  return migrated;
}

async function processRecurringStore<T extends RecurringRecord>(
  store: "revenus" | "depenses",
  allItems: T[],
  now: Date
): Promise<number> {
  const db = await getDB();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  let created = 0;

  const recurring = allItems.filter((r) => r.recurring && !r._deleted);
  const seriesKeys = [...new Set(recurring.map(seriesKey))];

  for (const key of seriesKeys) {
    const anchor = findAnchorMonth(recurring, key);
    const anchorDay = findAnchorDay(recurring, key);
    const sample = recurring.find((r) => seriesKey(r) === key)!;
    const groupId = sample.recurring_group_id!;

    const months = monthsBetweenInclusive(
      anchor.year,
      anchor.month,
      currentYear,
      currentMonth
    );

    for (const { year, month } of months) {
      if (existsInMonth(allItems, year, month, key)) continue;

      const dateStr = formatLocalDate(year, month, clampDay(year, month, anchorDay));
      const templateDate = parseLocalDate(dateStr);
      const target = new Date(templateDate.year, templateDate.month, templateDate.day);
      if (target > now) continue;

      const nowIso = new Date().toISOString();
      const base = {
        id: uuidv4(),
        user_id: sample.user_id,
        label: sample.label,
        amount: sample.amount,
        category: sample.category,
        date: dateStr,
        recurring: true,
        recurring_group_id: groupId,
        created_at: nowIso,
        updated_at: nowIso,
        synced_at: null,
        _dirty: true,
        _deleted: false,
      };

      const record =
        store === "revenus"
          ? { ...base, type: (sample as Revenu).type }
          : { ...base, envelope_id: (sample as Depense).envelope_id };

      await db.put(store, record as never);
      await enqueueSync(store, "create", record as Record<string, unknown>);
      allItems.push(record as T);
      created++;
    }
  }

  return created;
}

export async function generateRecurringTransactions(userId?: string): Promise<{ created: number; migrated: number }> {
  const now = new Date();
  const db = await getDB();
  const currentUserId =
    userId ??
    (typeof localStorage !== "undefined"
      ? localStorage.getItem("monbudget-last-user-id")
      : null);

  const allRevenus = ((await db.getAll("revenus")) as RecurringRecord[]).filter(
    (r) => !currentUserId || r.user_id === currentUserId
  );
  const allDepenses = ((await db.getAll("depenses")) as RecurringRecord[]).filter(
    (r) => !currentUserId || r.user_id === currentUserId
  );

  const migratedRev = await migrateLegacySeries("revenus", allRevenus);
  const migratedDep = await migrateLegacySeries("depenses", allDepenses);
  const revCreated = await processRecurringStore("revenus", allRevenus, now);
  const depCreated = await processRecurringStore("depenses", allDepenses, now);
  return {
    created: revCreated + depCreated,
    migrated: migratedRev + migratedDep,
  };
}

export { seriesKey, findExistingGroupId, groupLegacyRecurring } from "./recurring-series";
