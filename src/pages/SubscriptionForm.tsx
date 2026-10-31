import { useState, type FormEvent } from 'react'
import { ApiError, NetworkError, type FieldErrors } from '../api/client'
import {
  billingCycles,
  currencies,
  type BillingCycle,
  type Currency,
  type Subscription,
  type SubscriptionInput,
} from '../api/subscriptions'
import { useI18n } from '../i18n/useI18n'
import type { TranslationKey } from '../i18n/translations'

interface Props {
  initial: Subscription | null
  onSubmit: (input: SubscriptionInput) => Promise<void>
  onCancel: () => void
  onUnauthorized: () => void
}

function orNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function SubscriptionForm({
  initial,
  onSubmit,
  onCancel,
  onUnauthorized,
}: Props) {
  const { t } = useI18n()
  const [name, setName] = useState(initial?.name ?? '')
  const [vendor, setVendor] = useState(initial?.vendor ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'TRY')
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    initial?.billingCycle ?? 'Monthly',
  )
  const [renewal, setRenewal] = useState(initial?.nextRenewalDate ?? '')
  const [notice, setNotice] = useState(
    initial?.cancellationNoticeDays != null
      ? String(initial.cancellationNoticeDays)
      : '',
  )
  const [category, setCategory] = useState(initial?.category ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [localErrors, setLocalErrors] = useState<
    Partial<Record<string, TranslationKey>>
  >({})

  function validate(): Partial<Record<string, TranslationKey>> {
    const errs: Partial<Record<string, TranslationKey>> = {}
    if (name.trim() === '') errs.name = 'validation.required'
    if (amount.trim() === '') errs.amount = 'validation.required'
    else {
      const n = Number(amount)
      if (!Number.isFinite(n) || n < 0.01) errs.amount = 'validation.amount'
    }
    if (!(currencies as readonly string[]).includes(currency)) {
      errs.currency = 'validation.currency'
    }
    if (renewal === '') errs.nextRenewalDate = 'validation.required'
    else {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(renewal)
      const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
      if (
        !m ||
        !d ||
        d.getFullYear() !== Number(m[1]) ||
        d.getMonth() !== Number(m[2]) - 1 ||
        d.getDate() !== Number(m[3])
      ) {
        errs.nextRenewalDate = 'validation.date'
      }
    }
    if (notice.trim() !== '') {
      const n = Number(notice)
      if (!Number.isInteger(n) || n < 0 || n > 365) {
        errs.cancellationNoticeDays = 'validation.notice'
      }
    }
    return errs
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    setLocalErrors(errs)
    if (Object.keys(errs).length > 0) {
      setError(null)
      setFieldErrors({})
      return
    }
    setSaving(true)
    setError(null)
    setFieldErrors({})
    try {
      await onSubmit({
        name: name.trim(),
        vendor: orNull(vendor),
        amount: Number(amount),
        currency,
        billingCycle,
        nextRenewalDate: renewal,
        cancellationNoticeDays: notice.trim() === '' ? null : Number(notice),
        category: orNull(category),
        notes: orNull(notes),
        isActive,
      })
    } catch (err) {
      setSaving(false)
      if (err instanceof ApiError) {
        if (err.status === 401) return onUnauthorized()
        if (err.status === 404) return setError('error.notFound')
        if (err.status === 409) return setError('error.subscriptionLimit')
        if (err.status === 400) {
          setFieldErrors(err.fieldErrors)
          return setError('error.validation.fields')
        }
      }
      setError(err instanceof NetworkError ? 'error.network' : 'error.generic')
    }
  }

  // Server messages are keyed by camelCase field name.
  function errorsFor(field: string) {
    const local = localErrors[field]
    const messages = local ? [t(local)] : (fieldErrors[field] ?? [])
    return messages.length > 0 ? (
      <span role="alert" className="error field-error">
        {messages.join(' ')}
      </span>
    ) : null
  }

  return (
    <form className="form form-grid" noValidate onSubmit={handleSubmit}>
      <label className="span-2">
        {t('subs.field.name')}
        <input
          aria-invalid={localErrors.name ? true : undefined}
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {errorsFor('name')}
      </label>
      <label>
        {t('subs.field.vendor')}
        <input
          maxLength={100}
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
        />
        {errorsFor('vendor')}
      </label>
      <label>
        {t('subs.field.amount')}
        <input
          type="number"
          aria-invalid={localErrors.amount ? true : undefined}
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {errorsFor('amount')}
      </label>
      <label>
        {t('subs.field.currency')}
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {errorsFor('currency')}
      </label>
      <label>
        {t('subs.field.billingCycle')}
        <select
          value={billingCycle}
          onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
        >
          {billingCycles.map((c) => (
            <option key={c} value={c}>
              {t(`billingCycle.${c}`)}
            </option>
          ))}
        </select>
        {errorsFor('billingCycle')}
      </label>
      <label>
        {t('subs.field.nextRenewalDate')}
        <input
          type="date"
          aria-invalid={localErrors.nextRenewalDate ? true : undefined}
          value={renewal}
          onChange={(e) => setRenewal(e.target.value)}
        />
        {errorsFor('nextRenewalDate')}
      </label>
      <label>
        {t('subs.field.cancellationNoticeDays')}
        <input
          type="number"
          aria-invalid={localErrors.cancellationNoticeDays ? true : undefined}
          min="0"
          max="365"
          step="1"
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
        />
        {errorsFor('cancellationNoticeDays')}
      </label>
      <label>
        {t('subs.field.category')}
        <input
          maxLength={50}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        {errorsFor('category')}
      </label>
      <label className="span-2">
        {t('subs.field.notes')}
        <textarea
          maxLength={500}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {errorsFor('notes')}
      </label>
      <label className="checkbox span-2">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        {t('subs.field.isActive')}
      </label>
      {error && (
        <p role="alert" className="error span-2">
          {t(error)}
        </p>
      )}
      <div className="row form-actions span-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t('common.loading') : t('subs.form.save')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {t('subs.form.cancel')}
        </button>
      </div>
    </form>
  )
}
