import { describe, it, expect } from "vitest";
import {
  parseLocalDate,
  formatLocalDate,
  sameCalendarMonth,
  sameCalendarYear,
  compareDateStrings,
  getLastWeekRange,
  clampDay,
} from "./dates";

describe("parseLocalDate / formatLocalDate", () => {
  it("parses YYYY-MM-DD without UTC shift", () => {
    expect(parseLocalDate("2026-03-01")).toEqual({ year: 2026, month: 2, day: 1 });
  });

  it("round-trips calendar dates", () => {
    expect(formatLocalDate(2026, 2, 1)).toBe("2026-03-01");
  });
});

describe("sameCalendarMonth", () => {
  it("matches local month regardless of Date parsing quirks", () => {
    expect(sameCalendarMonth("2026-03-01", 2026, 2)).toBe(true);
    expect(sameCalendarMonth("2026-03-01", 2026, 1)).toBe(false);
  });
});

describe("sameCalendarYear", () => {
  it("matches year from date string", () => {
    expect(sameCalendarYear("2026-12-31", 2026)).toBe(true);
    expect(sameCalendarYear("2026-01-01", 2025)).toBe(false);
  });
});

describe("compareDateStrings", () => {
  it("sorts newest first", () => {
    expect(compareDateStrings("2026-03-01", "2026-02-01")).toBeLessThan(0);
    expect(compareDateStrings("2026-02-01", "2026-03-01")).toBeGreaterThan(0);
  });
});

describe("getLastWeekRange", () => {
  it("returns Mon–Sun of the previous week", () => {
    const ref = new Date(2026, 5, 24); // Wednesday
    const { start, end } = getLastWeekRange(ref);
    expect(start).toBe("2026-06-15");
    expect(end).toBe("2026-06-21");
  });

  it("on Monday returns the week before the current one", () => {
    const ref = new Date(2026, 5, 22); // Monday
    const { start, end } = getLastWeekRange(ref);
    expect(start).toBe("2026-06-15");
    expect(end).toBe("2026-06-21");
  });
});

describe("clampDay", () => {
  it("clamps day to month length", () => {
    expect(clampDay(2026, 1, 31)).toBe(28);
    expect(clampDay(2024, 1, 31)).toBe(29);
  });
});
