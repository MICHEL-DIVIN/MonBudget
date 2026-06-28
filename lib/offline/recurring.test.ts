import { describe, it, expect } from "vitest";
import {
  seriesKey,
  findExistingGroupId,
  groupLegacyRecurring,
  legacySeriesIdentity,
} from "./recurring-series";
import type { Revenu } from "../supabase/types";

const baseRevenu: Revenu = {
  id: "1",
  user_id: "user-a",
  label: "Netflix",
  amount: 15,
  category: "secondaire",
  type: "autre",
  date: "2026-01-15",
  recurring: true,
  created_at: "",
  updated_at: "",
  synced_at: null,
};

describe("seriesKey", () => {
  it("uses recurring_group_id when present", () => {
    const a = { ...baseRevenu, recurring_group_id: "grp-1" };
    const b = { ...baseRevenu, id: "2", label: "Other", amount: 99, recurring_group_id: "grp-1" };
    expect(seriesKey(a)).toBe(seriesKey(b));
  });

  it("keeps legacy series separate by label and amount", () => {
    const a = { ...baseRevenu };
    const b = { ...baseRevenu, id: "2", label: "Spotify", amount: 15 };
    expect(seriesKey(a)).not.toBe(seriesKey(b));
  });

  it("scopes series per user", () => {
    const a = { ...baseRevenu, recurring_group_id: "grp-1" };
    const b = { ...baseRevenu, user_id: "user-b", recurring_group_id: "grp-1" };
    expect(seriesKey(a)).not.toBe(seriesKey(b));
  });

  it("differentiates two subscriptions via group id", () => {
    const a = { ...baseRevenu, recurring_group_id: "grp-a" };
    const b = { ...baseRevenu, id: "2", recurring_group_id: "grp-b" };
    expect(seriesKey(a)).not.toBe(seriesKey(b));
  });
});

describe("findExistingGroupId", () => {
  it("reuses group id from generated sibling", () => {
    const anchor = { ...baseRevenu, id: "anchor" };
    const generated = {
      ...baseRevenu,
      id: "gen",
      recurring_group_id: "grp-existing",
      date: "2026-02-15",
    };
    expect(findExistingGroupId([anchor, generated], anchor)).toBe("grp-existing");
  });

  it("returns null when no sibling has a group id", () => {
    const anchor = { ...baseRevenu };
    expect(findExistingGroupId([anchor], anchor)).toBeNull();
  });
});

describe("groupLegacyRecurring", () => {
  it("groups anchor records without group id by legacy identity", () => {
    const a = { ...baseRevenu, id: "1" };
    const b = { ...baseRevenu, id: "2", date: "2026-02-01" };
    const grouped = groupLegacyRecurring([a, b]);
    expect(grouped.size).toBe(1);
    expect(grouped.get(legacySeriesIdentity(a))).toHaveLength(2);
  });

  it("ignores records that already have recurring_group_id", () => {
    const migrated = { ...baseRevenu, recurring_group_id: "grp-1" };
    expect(groupLegacyRecurring([migrated]).size).toBe(0);
  });
});
