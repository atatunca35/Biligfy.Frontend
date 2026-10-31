import type { AuthUser } from '../api/client'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { useI18n } from '../i18n/useI18n'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0] ?? '']
  return letters.map((p) => Array.from(p)[0] ?? '').join('').toLocaleUpperCase() || '?'
}

export function AppHeader({
  user,
  onLogout,
}: {
  user: AuthUser
  onLogout: () => void
}) {
  const { t } = useI18n()
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <span className="brand">{t('appName')}</span>
        <div className="header-actions">
          <LanguageSwitcher />
          <div
            className="user"
            title={user.displayName}
            aria-label={t('header.signedInAs', { name: user.displayName })}
            role="group"
          >
            <span className="avatar" aria-hidden="true">
              {initials(user.displayName)}
            </span>
            <span className="user-name">{user.displayName}</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>
            {t('header.logout')}
          </button>
        </div>
      </div>
    </header>
  )
}
