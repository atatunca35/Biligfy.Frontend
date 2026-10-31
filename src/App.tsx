import { useState } from 'react'
import { clearSession, loadUser, saveSession } from './api/session'
import type { AuthResponse, AuthUser } from './api/client'
import { useI18n } from './i18n/useI18n'
import { LanguageSwitcher } from './i18n/LanguageSwitcher'
import { AppHeader } from './pages/AppHeader'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import './App.css'

function App() {
  const { t } = useI18n()
  const [user, setUser] = useState<AuthUser | null>(loadUser)
  const [view, setView] = useState<'login' | 'register'>('login')

  function handleAuth(auth: AuthResponse) {
    saveSession(auth.accessToken, auth.user)
    setUser(auth.user)
  }

  function handleLogout() {
    clearSession()
    setUser(null)
    setView('login')
  }

  if (user) {
    return (
      <>
        <AppHeader user={user} onLogout={handleLogout} />
        <main className="app-main">
          <SubscriptionsPage onUnauthorized={handleLogout} />
        </main>
      </>
    )
  }

  return (
    <main className="auth-shell">
      <div className="auth-lang">
        <LanguageSwitcher />
      </div>
      <div className="auth-box">
        <span className="brand brand-lg">{t('appName')}</span>
        {view === 'login' ? (
          <LoginPage onSuccess={handleAuth} onSwitch={() => setView('register')} />
        ) : (
          <RegisterPage onSuccess={handleAuth} onSwitch={() => setView('login')} />
        )}
      </div>
    </main>
  )
}

export default App
