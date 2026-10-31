import { useState, type FormEvent } from 'react'
import { authApi, type AuthResponse } from '../api/client'
import { errorKey } from '../api/errors'
import { useI18n } from '../i18n/useI18n'
import type { TranslationKey } from '../i18n/translations'

interface Props {
  onSuccess: (auth: AuthResponse) => void
  onSwitch: () => void
}

export function LoginPage({ onSuccess, onSwitch }: Props) {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<TranslationKey | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      onSuccess(await authApi.login(email, password))
    } catch (err) {
      setError(errorKey(err, 'login'))
      setLoading(false)
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h1>{t('login.title')}</h1>
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
        {loading ? t('common.loading') : t('login.submit')}
      </button>
      <p className="switch">
        {t('login.noAccount')}{' '}
        <button type="button" className="btn-link" onClick={onSwitch}>
          {t('login.toRegister')}
        </button>
      </p>
    </form>
  )
}
