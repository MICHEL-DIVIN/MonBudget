import { describe, it, expect } from "vitest";
import { filterByMonth, filterByYear } from "./calculations";

describe("filterByMonth", () => {
  const items = [
    { date: "2026-03-01", amount: 1 },
    { date: "2026-02-28", amount: 2 },
    { date: "2026-03-31", amount: 3 },
  ];

  it("includes dates on month boundaries using local calendar", () => {
    const march = filterByMonth(items, 2, 2026);
    expect(march).toHaveLength(2);
    expect(march.map((i) => i.date)).toEqual(["2026-03-01", "2026-03-31"]);
  });

  it("excludes adjacent month dates", () => {
    const feb = filterByMonth(items, 1, 2026);
    expect(feb).toHaveLength(1);
    expect(feb[0].date).toBe("2026-02-28");
  });
});

describe("filterByYear", () => {
  it("filters by calendar year", () => {
    const items = [{ date: "2026-01-01" }, { date: "2025-12-31" }];
    expect(filterByYear(items, 2026)).toHaveLength(1);
  });
});
