import { useState, type FormEvent } from 'react'
import { authApi, type AccountType, type AuthResponse } from '../api/client'
import { errorKey } from '../api/errors'
import { useI18n } from '../i18n/useI18n'
import type { TranslationKey } from '../i18n/translations'

interface Props {
  onSuccess: (auth: AuthResponse) => void
  onSwitch: () => void
}

export function RegisterPage({ onSuccess, onSwitch }: Props) {
  const { t, language } = useI18n()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('Individual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<TranslationKey | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      onSuccess(
        await authApi.register({
          email,
          password,
          displayName,
          accountType,
          preferredLanguage: language,
        }),
      )
    } catch (err) {
      setError(errorKey(err, 'register'))
      setLoading(false)
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h1>{t('register.title')}</h1>
      <label>
        {t('field.displayName')}
        <input
          type="text"
          required
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </label>
      <label>
        {t('field.email')}
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        {t('field.password')}
        <input
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label>
        {t('field.accountType')}
        <select
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as AccountType)}
        >
          <option value="Individual">{t('accountType.Individual')}</option>
          <option value="Company">{t('accountType.Company')}</option>
        </select>
      </label>
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
        {loading ? t('common.loading') : t('register.submit')}
      </button>
      <p className="switch">
        {t('register.haveAccount')}{' '}
        <button type="button" className="btn-link" onClick={onSwitch}>
          {t('register.toLogin')}
        </button>
      </p>
    </form>
  )
}
