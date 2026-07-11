// Deterministic date helpers shared by the new CSV-coverage spec files.
// Existing spec files keep their own local copies of similar helpers — not touched here.

function hashSeed(seedId: string): number {
  let h = 2166136261;
  for (const c of seedId) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function skipWeekends(d: Date): Date {
  const result = new Date(d);
  while ([0, 6].includes(result.getDay())) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

export function todayStr(): string {
  return toYYYYMMDD(new Date());
}

/**
 * True on Saturday/Sunday. getWorkingDaysOfMonth() on the backend excludes
 * weekends from GET /presence entirely, so a test that opens "today's" day-card
 * on a weekend finds no such card and hangs on scrollIntoViewIfNeeded() until
 * the full test timeout — skip gracefully instead, there's no real "today"
 * office day to exercise.
 */
export function isTodayWeekend(): boolean {
  return [0, 6].includes(new Date().getDay());
}

/**
 * A stable future weekday for a given test ID, always inside the real 30-day
 * rolling planning window (see H-20). Two different IDs may collide on the
 * same date — harmless, since every test sets/overwrites its own day's
 * status at the start rather than relying on ambient state.
 */
export function futureTestDate(seedId: string, withinDays = 25): string {
  const offset = 1 + (hashSeed(seedId) % withinDays);
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toYYYYMMDD(skipWeekends(d));
}

/**
 * A stable weekday inside the real previous calendar month — required by
 * retrofitStatus(), which rejects any date outside date.slice(0,7) === prevMonth.
 */
export function prevMonthTestDate(seedId: string): string {
  const now = new Date();
  const dayOfMonth = 2 + (hashSeed(seedId) % 20); // 2..21, safe for every month length
  const d = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth);
  return toYYYYMMDD(skipWeekends(d));
}
