import { describe, it, expect } from "vitest";
import { computeAnnualReport, filterByMonth, filterByYear } from "./calculations";

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

describe("computeAnnualReport", () => {
  const env = { id: "e", name: "Courses", budgeted: 100, color: "", icon: "", sort_order: 0, created_at: "2026-09-10T10:00:00Z", updated_at: "" };
  const dep = (date: string, amount: number) => ({ id: date, label: "x", amount, category: "variable" as const, envelope_id: "e", date, recurring: false, recurring_group_id: null, created_at: "", updated_at: "" });
  const rev = (date: string, amount: number) => ({ id: date, label: "s", amount, category: "principal" as const, type: "salaire", date, recurring: false, recurring_group_id: null, created_at: "", updated_at: "" });

  it("budget annuel d'une enveloppe au prorata des mois écoulés depuis sa création", () => {
    const r = computeAnnualReport([], [dep("2026-10-02", 50)], [env], 2026, [], [], new Date(2026, 10, 15));
    expect(r.envelopeAnnual[0].annualBudget).toBe(300); // sept., oct., nov.
  });

  it("compare l'année en cours à la même période de l'année précédente", () => {
    const prev = [rev("2025-03-01", 1000), rev("2025-12-01", 5000)];
    const r = computeAnnualReport([rev("2026-03-01", 1000)], [], [], 2026, prev, [], new Date(2026, 5, 1));
    expect(r.revenuTrend).toBe(0);
    expect(r.monthsElapsed).toBe(6);
  });
});
