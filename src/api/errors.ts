import type { TranslationKey } from '../i18n/translations'
import { ApiError, NetworkError } from './client'

export function errorKey(
  error: unknown,
  kind: 'login' | 'register',
): TranslationKey {
  if (error instanceof NetworkError) return 'error.network'
  if (error instanceof ApiError) {
    if (kind === 'login' && error.status === 401) return 'error.invalidCredentials'
    if (kind === 'register' && error.status === 409) return 'error.emailTaken'
    if (kind === 'register' && error.status === 400) return 'error.validation'
  }
  return 'error.generic'
}
