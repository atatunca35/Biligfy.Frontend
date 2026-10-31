import type { Subscription } from '../api/subscriptions'

const DAY_MS = 86_400_000

/** Parses YYYY-MM-DD as a local date so the day never shifts with time zone. */
export function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function diffDays(to: Date, from: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS)
}

/**
 * Date in the given month (month may overflow/underflow; it is normalised) with
 * the day clamped to that month's last day, e.g. day 31 in February -> 28/29.
 */
export function clampedDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
}

/** Adds calendar months, clamping the day to the target month's length. */
export function addMonthsClamped(date: Date, months: number): Date {
  return clampedDate(date.getFullYear(), date.getMonth() + months, date.getDate())
}

/**
 * Number of times a subscription charges inside the given month, based on its
 * stored renewal date. Weekly plans repeat every 7 days from that date;
 * others charge once if the date falls in the month.
 */
export function chargesInMonth(sub: Subscription, year: number, month: number): number {
  const first = parseDate(sub.nextRenewalDate)
  if (sub.billingCycle !== 'Weekly') {
    return first.getFullYear() === year && first.getMonth() === month ? 1 : 0
  }
  let count = 0
  for (
    let d = first;
    d.getFullYear() < year || (d.getFullYear() === year && d.getMonth() <= month);
    d = addDays(d, 7)
  ) {
    if (d.getFullYear() === year && d.getMonth() === month) count++
  }
  return count
}
