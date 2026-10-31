import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import type { Currency, Subscription } from '../api/subscriptions'
import { useI18n } from '../i18n/useI18n'
import { addMonthsClamped, diffDays, startOfToday } from './subscriptionDates'
import {
  buildRows,
  buildWindow,
  clampOffset,
  dateAtOffset,
  monthTicks,
  renewalsAt,
  spendUpTo,
} from './timelineMath'

/** 120px per ~30-day month. */
const PX_PER_DAY = 4
/** Header month cells narrower than this (in days) get no label. */
const MIN_LABEL_DAYS = 8

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface SubscriptionChartProps {
  /** Active subscriptions only. */
  subs: Subscription[]
  onEdit: (sub: Subscription) => void
  onDelete: (sub: Subscription) => void
}

export function SubscriptionChart({ subs, onEdit, onDelete }: SubscriptionChartProps) {
  const { t, language } = useI18n()
  const [today] = useState(startOfToday)
  const win = useMemo(() => buildWindow(today), [today])
  const rows = useMemo(() => buildRows(subs, win, today), [subs, win, today])
  const ticks = useMemo(() => monthTicks(win), [win])

  const [cursor, setCursor] = useState(win.todayOffset)
  const [pinned, setPinned] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const cornerRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<HTMLDivElement>(null)

  const plotWidth = (win.totalDays + 1) * PX_PER_DAY
  const xOf = (offset: number) => offset * PX_PER_DAY + PX_PER_DAY / 2

  const fmt = useMemo(() => {
    const number = new Intl.NumberFormat(language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return {
      money: (amount: number, currency: Currency) => `${number.format(amount)} ${currency}`,
      month: new Intl.DateTimeFormat(language, { month: 'short', year: 'numeric' }),
      short: new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric' }),
      long: new Intl.DateTimeFormat(language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    }
  }, [language])

  const centerOn = useCallback((offset: number, behavior: ScrollBehavior) => {
    const scroller = scrollRef.current
    const corner = cornerRef.current
    if (!scroller || !corner) return
    const visiblePlot = scroller.clientWidth - corner.offsetWidth
    scroller.scrollTo({
      left: offset * PX_PER_DAY + PX_PER_DAY / 2 - visiblePlot / 2,
      behavior: prefersReducedMotion() ? 'auto' : behavior,
    })
  }, [])

  // "Today" starts in the middle of the visible area.
  useEffect(() => {
    centerOn(win.todayOffset, 'auto')
  }, [centerOn, win.todayOffset])

  // Shift + wheel scrolls horizontally in every browser (needs a non-passive listener).
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey && e.deltaX === 0 && e.deltaY !== 0) {
        e.preventDefault()
        scroller.scrollLeft += e.deltaY
      }
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [])

  function scrollByPage(direction: 1 | -1) {
    const scroller = scrollRef.current
    const corner = cornerRef.current
    if (!scroller || !corner) return
    scroller.scrollBy({
      left: direction * (scroller.clientWidth - corner.offsetWidth) * 0.8,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  function ensureVisible(offset: number) {
    const scroller = scrollRef.current
    const corner = cornerRef.current
    if (!scroller || !corner) return
    const visiblePlot = scroller.clientWidth - corner.offsetWidth
    const x = xOf(offset)
    const margin = 24
    if (x < scroller.scrollLeft + margin) scroller.scrollLeft = x - margin
    else if (x > scroller.scrollLeft + visiblePlot - margin)
      scroller.scrollLeft = x - visiblePlot + margin
  }

  /** Day offset under the pointer, or null when it is over the fixed label column. */
  function offsetFromClientX(clientX: number): number | null {
    const plot = plotRef.current
    const corner = cornerRef.current
    if (!plot || !corner) return null
    if (clientX < corner.getBoundingClientRect().right) return null
    const x = clientX - plot.getBoundingClientRect().left
    return clampOffset(win, Math.floor(x / PX_PER_DAY))
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (pinned) return
    const offset = offsetFromClientX(e.clientX)
    if (offset !== null) setCursor(offset)
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'touch' || pinned) return
    const offset = offsetFromClientX(e.clientX)
    if (offset !== null) setCursor(offset)
  }

  function handlePointerLeave(e: PointerEvent<HTMLDivElement>) {
    if (!pinned && e.pointerType === 'mouse') setCursor(win.todayOffset)
  }

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    const offset = offsetFromClientX(e.clientX)
    if (offset === null) return
    setCursor(offset)
    setPinned((p) => !p)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Escape') return setPinned(false)
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const next = clampOffset(
      win,
      e.shiftKey
        ? diffDays(addMonthsClamped(dateAtOffset(win, cursor), dir), win.start)
        : cursor + dir,
    )
    setCursor(next)
    setPinned(true)
    ensureVisible(next)
  }

  const selectedDate = dateAtOffset(win, cursor)
  const spend = useMemo(() => spendUpTo(rows, cursor), [rows, cursor])
  const renewing = useMemo(() => renewalsAt(rows, cursor), [rows, cursor])
  const totalsText = spend.totals.map(([cur, sum]) => fmt.money(sum, cur)).join(' · ')

  return (
    <section className="chart-section" aria-labelledby="chart-title">
      <div className="chart-head">
        <h2 id="chart-title">{t('subs.timeline')}</h2>
        <div className="chart-controls">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label={t('chart.scrollPrev')}
            onClick={() => scrollByPage(-1)}
          >
            ◀
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => centerOn(win.todayOffset, 'smooth')}
          >
            {t('chart.today')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label={t('chart.scrollNext')}
            onClick={() => scrollByPage(1)}
          >
            ▶
          </button>
        </div>
      </div>

      <p className="muted chart-note">
        {t('chart.estimateNote')} {t('chart.inactiveNote')}
      </p>

      <div className="chart-info card" aria-live={pinned ? 'polite' : 'off'}>
        <div className="chart-info-date">
          <strong>{fmt.long.format(selectedDate)}</strong>
          {pinned ? (
            <span className="chip chip-pinned">{t('chart.pinned')}</span>
          ) : (
            <span className="muted">{t('chart.pinHint')}</span>
          )}
        </div>
        <dl className="chart-info-stats">
          <div>
            <dt>{t('chart.info.total')}</dt>
            <dd>{totalsText || t('chart.info.noSpend')}</dd>
          </div>
          <div>
            <dt>{t('chart.info.count')}</dt>
            <dd>{spend.count}</dd>
          </div>
        </dl>
        <div>
          <h3 className="chart-info-heading">{t('chart.info.renewals')}</h3>
          {renewing.length === 0 ? (
            <p className="muted">{t('chart.info.none')}</p>
          ) : (
            <ul className="chart-info-list">
              {renewing.map((sub) => (
                <li key={sub.id}>
                  <span>{sub.name}</span>
                  <span className="muted">{fmt.money(sub.amount, sub.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="card chart-empty muted">{t('chart.empty')}</p>
      ) : (
        <div
          className="chart card"
          role="application"
          tabIndex={0}
          aria-label={t('chart.aria')}
          aria-describedby="chart-help"
          onKeyDown={handleKeyDown}
        >
          <div className="chart-scroll" ref={scrollRef}>
            <div
              className="chart-grid"
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerDown}
              onPointerLeave={handlePointerLeave}
              onClick={handleClick}
            >
              <div className="chart-label chart-corner" ref={cornerRef} />
              <div className="chart-months" style={{ width: plotWidth }}>
                {ticks.map((tick) => (
                  <span
                    key={tick.offset}
                    className="chart-month"
                    style={{ left: tick.offset * PX_PER_DAY, width: tick.days * PX_PER_DAY }}
                  >
                    {tick.days >= MIN_LABEL_DAYS ? fmt.month.format(tick.date) : ''}
                  </span>
                ))}
              </div>

              {rows.map(({ sub, events }) => (
                <Fragment key={sub.id}>
                  <div className="chart-label chart-row-label">
                    <div className="chart-label-text">
                      <button
                        type="button"
                        className="chart-name"
                        aria-label={t('chart.row.edit', { name: sub.name })}
                        onClick={() => onEdit(sub)}
                      >
                        {sub.name}
                      </button>
                      <span className="chart-meta">
                        {sub.vendor && <span className="chart-vendor">{sub.vendor} · </span>}
                        {fmt.money(sub.amount, sub.currency)} · {t(`billingCycle.${sub.billingCycle}`)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="chart-delete"
                      aria-label={t('chart.row.delete', { name: sub.name })}
                      onClick={() => onDelete(sub)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="chart-track" style={{ width: plotWidth }}>
                    {events.map((ev) => {
                      const kind = ev.isNext ? 'next' : ev.isPast ? 'past' : 'future'
                      return (
                        <Fragment key={ev.offset}>
                          {ev.cancelBy && ev.cancelOffset !== null && (
                            <span
                              className="chart-cancel"
                              style={{ left: xOf(ev.cancelOffset) }}
                              title={t('subs.cancelBy', { date: fmt.short.format(ev.cancelBy) })}
                            />
                          )}
                          <span
                            className={`chart-dot chart-dot-${kind}${
                              ev.offset === cursor ? ' is-selected' : ''
                            }`}
                            style={{ left: xOf(ev.offset) }}
                            title={t('chart.renewalOn', { date: fmt.short.format(ev.date) })}
                          >
                            {ev.isNext && (
                              <span className="chart-next-badge">{t('chart.nextBadge')}</span>
                            )}
                          </span>
                        </Fragment>
                      )
                    })}
                  </div>
                </Fragment>
              ))}

              <div className="chart-layer" ref={plotRef} style={{ width: plotWidth }} aria-hidden="true">
                {ticks.slice(1).map((tick) => (
                  <span
                    key={tick.offset}
                    className="chart-guide"
                    style={{ left: tick.offset * PX_PER_DAY }}
                  />
                ))}
                <span className="chart-today" style={{ left: xOf(win.todayOffset) }}>
                  <span className="chart-today-tag">{t('chart.today')}</span>
                </span>
                <span className="chart-cursor" style={{ left: xOf(cursor) }}>
                  <span className="chart-cursor-tag">{fmt.short.format(selectedDate)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <p id="chart-help" className="muted chart-help">
        {t('chart.help')}
      </p>

      <ul className="chart-legend">
        <li>
          <span className="chart-dot chart-dot-past chart-legend-mark" />
          {t('chart.legend.past')}
        </li>
        <li>
          <span className="chart-dot chart-dot-future chart-legend-mark" />
          {t('chart.legend.future')}
        </li>
        <li>
          <span className="chart-dot chart-dot-next chart-legend-mark" />
          {t('chart.legend.next')}
        </li>
        <li>
          <span className="chart-cancel chart-legend-mark" />
          {t('chart.legend.cancel')}
        </li>
        <li>
          <span className="chart-legend-line chart-legend-today" />
          {t('chart.legend.today')}
        </li>
        <li>
          <span className="chart-legend-line chart-legend-cursor" />
          {t('chart.legend.cursor')}
        </li>
      </ul>
    </section>
  )
}

