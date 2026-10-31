import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, NetworkError } from '../api/client'
import {
  subscriptionsApi,
  type Currency,
  type PagedResult,
  type Subscription,
  type SubscriptionInput,
} from '../api/subscriptions'
import { useI18n } from '../i18n/useI18n'
import type { TranslationKey } from '../i18n/translations'
import { Modal } from './Modal'
import { SubscriptionForm } from './SubscriptionForm'
import { SubscriptionChart } from './SubscriptionChart'
import { chargesInMonth, diffDays, parseDate, startOfToday } from './subscriptionDates'

/** Server upper bound for pageSize. */
const PAGE_SIZE = 100
const CANCEL_WARN_DAYS = 7

type Dialog =
  | { kind: 'none' }
  | { kind: 'form'; editing: Subscription | null }
  | { kind: 'delete'; sub: Subscription }

export function SubscriptionsPage({
  onUnauthorized,
}: {
  onUnauthorized: () => void
}) {
  const { t, language } = useI18n()
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' })
  const [data, setData] = useState<PagedResult<Subscription> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [reload, setReload] = useState(0)
  const [deleting, setDeleting] = useState(false)

  const failWith = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) return onUnauthorized()
      if (err instanceof ApiError && err.status === 404) return setError('error.notFound')
      setError(err instanceof NetworkError ? 'error.network' : 'error.generic')
    },
    [onUnauthorized],
  )

  useEffect(() => {
    let cancelled = false
    subscriptionsApi
      .list({ page: 1, pageSize: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoading(false)
        failWith(err)
      })
    return () => {
      cancelled = true
    }
  }, [reload, failWith])

  function refresh() {
    setLoading(true)
    setReload((n) => n + 1)
  }

  async function handleSave(input: SubscriptionInput) {
    if (dialog.kind !== 'form') return
    if (dialog.editing) await subscriptionsApi.update(dialog.editing.id, input)
    else await subscriptionsApi.create(input)
    setDialog({ kind: 'none' })
    refresh()
  }

  async function handleDelete(sub: Subscription) {
    setDeleting(true)
    try {
      await subscriptionsApi.remove(sub.id)
    } catch (err) {
      failWith(err)
    }
    setDeleting(false)
    setDialog({ kind: 'none' })
    refresh()
  }

  const items = useMemo(
    () =>
      [...(data?.items ?? [])].sort(
        (a, b) =>
          a.nextRenewalDate.localeCompare(b.nextRenewalDate) ||
          a.name.localeCompare(b.name),
      ),
    [data],
  )

  const today = startOfToday()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()

  const active = useMemo(() => items.filter((s) => s.isActive), [items])
  const inactive = useMemo(() => items.filter((s) => !s.isActive), [items])

  // Per-currency totals for charges falling in the current month. No FX conversion.
  const monthTotals = new Map<Currency, number>()
  for (const sub of active) {
    const n = chargesInMonth(sub, currentYear, currentMonth)
    if (n > 0) monthTotals.set(sub.currency, (monthTotals.get(sub.currency) ?? 0) + n * sub.amount)
  }

  const nextRenewal = active.find((s) => diffDays(parseDate(s.nextRenewalDate), today) >= 0)

  const money = (amount: number, currency: Currency) =>
    new Intl.NumberFormat(language, { style: 'currency', currency }).format(amount)
  const shortDate = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long' })

  function daysBadge(date: Date): { text: string; tone: 'overdue' | 'soon' | 'normal' } {
    const n = diffDays(date, today)
    if (n < 0) return { text: t('subs.days.overdue', { n: String(-n) }), tone: 'overdue' }
    if (n === 0) return { text: t('subs.days.today'), tone: 'soon' }
    if (n === 1) return { text: t('subs.days.tomorrow'), tone: 'soon' }
    return { text: t('subs.days.left', { n: String(n) }), tone: n <= CANCEL_WARN_DAYS ? 'soon' : 'normal' }
  }

  return (
    <div className="subs-page">
      <div className="page-head">
        <div>
          <h1>{t('subs.title')}</h1>
          <p className="muted">{t('subs.subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setDialog({ kind: 'form', editing: null })}
        >
          {t('subs.add')}
        </button>
      </div>

      {error && (
        <p role="alert" className="banner banner-error">
          {t(error)}
        </p>
      )}

      {loading && !data && <p className="muted">{t('common.loading')}</p>}

      {data && items.length === 0 && (
        <section className="card empty">
          <h2>{t('subs.empty.title')}</h2>
          <p className="muted">{t('subs.empty.text')}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setDialog({ kind: 'form', editing: null })}
          >
            {t('subs.add')}
          </button>
        </section>
      )}

      {data && items.length > 0 && (
        <>
          <section className="summary" aria-live="polite">
            <div className="card stat">
              <span className="stat-label">{t('subs.summary.active')}</span>
              <span className="stat-value">{active.length}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">{t('subs.summary.month')}</span>
              {monthTotals.size === 0 ? (
                <span className="stat-text">{t('subs.summary.monthEmpty')}</span>
              ) : (
                <span className="stat-value stat-money">
                  {[...monthTotals].map(([currency, total]) => (
                    <span key={currency}>{money(total, currency)}</span>
                  ))}
                </span>
              )}
              <span className="stat-hint">{t('subs.summary.monthHint')}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">{t('subs.summary.next')}</span>
              {nextRenewal ? (
                <>
                  <span className="stat-text">{nextRenewal.name}</span>
                  <span className="stat-hint">
                    {shortDate.format(parseDate(nextRenewal.nextRenewalDate))} ·{' '}
                    {daysBadge(parseDate(nextRenewal.nextRenewalDate)).text}
                  </span>
                </>
              ) : (
                <span className="stat-text">{t('subs.summary.nextEmpty')}</span>
              )}
            </div>
          </section>

          <SubscriptionChart
            subs={active}
            onEdit={(sub) => setDialog({ kind: 'form', editing: sub })}
            onDelete={(sub) => setDialog({ kind: 'delete', sub })}
          />

          {inactive.length > 0 && (
            <section aria-labelledby="inactive-title">
              <h2 id="inactive-title" className="section-title">
                {t('chart.inactive.title')}
              </h2>
              <ul className="inactive-list card">
                {inactive.map((sub) => (
                  <li key={sub.id}>
                    <span className="inactive-name">
                      <strong>{sub.name}</strong>
                      <span className="chip">{t('subs.status.inactive')}</span>
                    </span>
                    <span className="row">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setDialog({ kind: 'form', editing: sub })}
                      >
                        {t('subs.edit')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger-ghost btn-sm"
                        onClick={() => setDialog({ kind: 'delete', sub })}
                      >
                        {t('subs.delete')}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {dialog.kind === 'form' && (
        <Modal
          title={t(dialog.editing ? 'subs.form.editTitle' : 'subs.form.createTitle')}
          onClose={() => setDialog({ kind: 'none' })}
        >
          <SubscriptionForm
            initial={dialog.editing}
            onSubmit={handleSave}
            onCancel={() => setDialog({ kind: 'none' })}
            onUnauthorized={onUnauthorized}
          />
        </Modal>
      )}

      {dialog.kind === 'delete' && (
        <Modal
          title={t('subs.confirmDelete.title')}
          onClose={() => !deleting && setDialog({ kind: 'none' })}
        >
          <p>{t('subs.confirmDelete.text', { name: dialog.sub.name })}</p>
          <div className="row form-actions">
            <button
              type="button"
              className="btn btn-danger"
              disabled={deleting}
              onClick={() => void handleDelete(dialog.sub)}
            >
              {deleting ? t('common.loading') : t('subs.delete')}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={deleting}
              onClick={() => setDialog({ kind: 'none' })}
            >
              {t('subs.form.cancel')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
