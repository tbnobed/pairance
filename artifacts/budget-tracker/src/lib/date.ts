/**
 * Parse a date value from the API as a LOCAL calendar date.
 *
 * Transaction dates are date-only ("2026-08-01" or "2026-08-01T00:00:00.000Z").
 * `new Date("2026-08-01")` parses as midnight UTC, which renders as the
 * previous day in any timezone west of UTC (e.g. July 31 in PST).
 * Extracting Y/M/D and constructing a local date avoids the shift.
 */
export function parseLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}
