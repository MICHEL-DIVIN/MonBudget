/** Parse YYYY-MM-DD as local calendar date (no UTC shift). */
export function parseLocalDate(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

/** Format local calendar date as YYYY-MM-DD. */
export function formatLocalDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function sameCalendarMonth(dateStr: string, year: number, month: number): boolean {
  const d = parseLocalDate(dateStr);
  return d.year === year && d.month === month;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

/** Inclusive date range filter for YYYY-MM-DD strings. */
export function filterByDateRange<T extends { date: string }>(
  items: T[],
  start: string,
  end: string
): T[] {
  return items.filter((item) => {
    const d = item.date.slice(0, 10);
    return d >= start && d <= end;
  });
}

/** Previous complete Mon–Sun week ending before the current week. */
export function getLastWeekRange(reference = new Date()): { start: string; end: string } {
  const ref = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const daysFromMonday = (ref.getDay() + 6) % 7;
  const thisMonday = new Date(ref);
  thisMonday.setDate(ref.getDate() - daysFromMonday);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);
  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6);
  return {
    start: formatLocalDate(lastMonday.getFullYear(), lastMonday.getMonth(), lastMonday.getDate()),
    end: formatLocalDate(lastSunday.getFullYear(), lastSunday.getMonth(), lastSunday.getDate()),
  };
}

export function sameCalendarYear(dateStr: string, year: number): boolean {
  return parseLocalDate(dateStr).year === year;
}

/** Sort YYYY-MM-DD strings descending (newest first). */
export function compareDateStrings(a: string, b: string): number {
  return b.slice(0, 10).localeCompare(a.slice(0, 10));
}

export function toLocalDate(dateStr: string): Date {
  const { year, month, day } = parseLocalDate(dateStr);
  return new Date(year, month, day);
}

function* iterateMonths(fromYear: number, fromMonth: number, toYear: number, toMonth: number) {
  let y = fromYear;
  let m = fromMonth;
  while (y < toYear || (y === toYear && m <= toMonth)) {
    yield { year: y, month: m };
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
}

export function monthsBetweenInclusive(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number
): { year: number; month: number }[] {
  return [...iterateMonths(fromYear, fromMonth, toYear, toMonth)];
}
