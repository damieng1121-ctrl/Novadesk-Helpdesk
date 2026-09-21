export interface OutOfHoursConfig {
  outOfHoursEnabled: boolean;
  outOfHoursStart: string; // "HH:MM", tenant's local clock (no timezone conversion — small schools, single timezone)
  outOfHoursEnd: string;
  outOfHoursWeekendOnly: boolean;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** "YYYY-MM-DD" in the server's local calendar date — matches how Holiday.date is stored/compared. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isOutsideBusinessHours(
  config: OutOfHoursConfig,
  at: Date = new Date(),
  holidayDates: Set<string> = new Set(),
): boolean {
  if (!config.outOfHoursEnabled) return false;

  // A bank/school holiday counts as out-of-hours all day, same as a weekend.
  if (holidayDates.has(dateKey(at))) return true;

  const day = at.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = day === 0 || day === 6;
  if (config.outOfHoursWeekendOnly) return isWeekend;
  if (isWeekend) return true;

  const nowMinutes = at.getHours() * 60 + at.getMinutes();
  const start = toMinutes(config.outOfHoursStart);
  const end = toMinutes(config.outOfHoursEnd);

  // Window can wrap midnight (e.g. 17:00 -> 08:00)
  if (start > end) return nowMinutes >= start || nowMinutes < end;
  return nowMinutes >= start && nowMinutes < end;
}
