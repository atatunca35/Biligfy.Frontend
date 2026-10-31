import type { AuthUser } from './client'

const TOKEN_KEY = 'biligfy.accessToken'
const USER_KEY = 'biligfy.user'

// TODO: localStorage is a temporary choice for the token (XSS-exposed).
export function saveSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function loadUser(): AuthUser | null {
  if (!localStorage.getItem(TOKEN_KEY)) return null
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as AuthUser | null
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
