import type { BillingCycle, Currency, Subscription } from '../api/subscriptions'
import {
  addDays,
  addMonthsClamped,
  clampedDate,
  diffDays,
  parseDate,
} from './subscriptionDates'

/** Months shown before and after today. */
export const WINDOW_MONTHS = 12

/**
 * Visible time range. Everything is addressed by an integer "offset": the
 * number of calendar days since `start` (0 .. totalDays inclusive).
 */
export interface TimelineWindow {
  start: Date
  end: Date
  totalDays: number
  todayOffset: number
}

export interface RenewalEvent {
  date: Date
  offset: number
  /** Last day to cancel before this renewal; null when no notice period is set. */
  cancelBy: Date | null
  /** Offset of `cancelBy` when it falls inside the window, otherwise null. */
  cancelOffset: number | null
  isPast: boolean
  /** First renewal on or after today. */
  isNext: boolean
}

export interface TimelineRow {
  sub: Subscription
  events: RenewalEvent[]
}

export interface MonthTick {
  date: Date
  offset: number
  /** Days from this tick to the next one (or to the end of the window). */
  days: number
}

export interface SpendSummary {
  /** Per-currency sums, sorted by currency code. No FX conversion. */
  totals: [Currency, number][]
  count: number
}

export function buildWindow(today: Date): TimelineWindow {
  const start = addMonthsClamped(today, -WINDOW_MONTHS)
  const end = addMonthsClamped(today, WINDOW_MONTHS)
  return {
    start,
    end,
    totalDays: diffDays(end, start),
    todayOffset: diffDays(today, start),
  }
}

export function clampOffset(win: TimelineWindow, offset: number): number {
  return Math.min(win.totalDays, Math.max(0, offset))
}

export function dateAtOffset(win: TimelineWindow, offset: number): Date {
  return addDays(win.start, offset)
}

/**
 * Renewal dates of a subscription inside [start, end] (inclusive), derived from
 * its anchor date in both directions. Generation never leaves the window, so it
 * always terminates.
 *
 * - Weekly: every 7 days from the anchor.
 * - Monthly / Yearly: the anchor's day-of-month is kept; in shorter months the
 *   date is clamped to the month's last day (31 -> 28/29/30). The day is always
 *   taken from the anchor, so a clamped month never drifts later months.
 */
export function renewalDates(
  anchor: Date,
  cycle: BillingCycle,
  start: Date,
  end: Date,
): Date[] {
  if (Number.isNaN(anchor.getTime())) return []
  const result: Date[] = []

  if (cycle === 'Weekly') {
    for (let k = Math.ceil(diffDays(start, anchor) / 7); ; k++) {
      const date = addDays(anchor, k * 7)
      if (date > end) break
      result.push(date)
    }
    return result
  }

  const step = cycle === 'Yearly' ? 12 : 1
  const monthsFromAnchor =
    (start.getFullYear() - anchor.getFullYear()) * 12 + start.getMonth() - anchor.getMonth()
  // Start one step early; the >= start check below drops anything before the window.
  for (let k = Math.floor(monthsFromAnchor / step) - 1; ; k++) {
    const date = clampedDate(
      anchor.getFullYear(),
      anchor.getMonth() + k * step,
      anchor.getDate(),
    )
    if (date > end) break
    if (date >= start) result.push(date)
  }
  return result
}

export function buildRows(
  subs: Subscription[],
  win: TimelineWindow,
  today: Date,
): TimelineRow[] {
  return subs.map((sub) => {
    const dates = renewalDates(parseDate(sub.nextRenewalDate), sub.billingCycle, win.start, win.end)
    const nextIndex = dates.findIndex((d) => d >= today)
    const events = dates.map<RenewalEvent>((date, index) => {
      const cancelBy =
        sub.cancellationNoticeDays == null ? null : addDays(date, -sub.cancellationNoticeDays)
      const cancelOffset = cancelBy ? diffDays(cancelBy, win.start) : null
      return {
        date,
        offset: diffDays(date, win.start),
        cancelBy,
        cancelOffset:
          cancelOffset !== null && cancelOffset >= 0 && cancelOffset <= win.totalDays
            ? cancelOffset
            : null,
        isPast: date < today,
        isNext: index === nextIndex,
      }
    })
    return { sub, events }
  })
}

/** Month boundaries inside the window; the first tick is the (partial) start month. */
export function monthTicks(win: TimelineWindow): MonthTick[] {
  const starts: Date[] = [win.start]
  for (
    let d = new Date(win.start.getFullYear(), win.start.getMonth() + 1, 1);
    d <= win.end;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  ) {
    starts.push(d)
  }
  return starts.map((date, i) => {
    const offset = diffDays(date, win.start)
    const nextOffset =
      i + 1 < starts.length ? diffDays(starts[i + 1], win.start) : win.totalDays + 1
    return { date, offset, days: nextOffset - offset }
  })
}

/** Estimated spend and payment count from window start through `offset` (inclusive). */
export function spendUpTo(rows: TimelineRow[], offset: number): SpendSummary {
  const sums = new Map<Currency, number>()
  let count = 0
  for (const { sub, events } of rows) {
    for (const event of events) {
      if (event.offset > offset) break
      count++
      sums.set(sub.currency, (sums.get(sub.currency) ?? 0) + sub.amount)
    }
  }
  const totals = [...sums].sort(([a], [b]) => a.localeCompare(b))
  return { totals, count }
}

/** Subscriptions renewing exactly at `offset`. */
export function renewalsAt(rows: TimelineRow[], offset: number): Subscription[] {
  return rows.filter((row) => row.events.some((e) => e.offset === offset)).map((r) => r.sub)
}
