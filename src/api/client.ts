import type { Language } from '../i18n/translations'

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5080'

export type AccountType = 'Individual' | 'Company'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  preferredLanguage: Language
  accountType: AccountType
}

export interface AuthResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresAtUtc: string
  user: AuthUser
}

export interface RegisterRequest {
  email: string
  password: string
  displayName: string
  accountType: AccountType
  preferredLanguage: Language
}

/** ValidationProblemDetails.errors: field name (camelCase) -> messages. */
export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors
  constructor(status: number, fieldErrors: FieldErrors = {}) {
    super(`API error ${status}`)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

async function readFieldErrors(response: Response): Promise<FieldErrors> {
  try {
    const body = (await response.json()) as { errors?: FieldErrors } | null
    return body?.errors ?? {}
  } catch {
    return {}
  }
}

/** Thrown when the request never reached the server. */
export class NetworkError extends Error {}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
  } catch {
    throw new NetworkError('Network error')
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      response.status === 400 ? await readFieldErrors(response) : {},
    )
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (data: RegisterRequest) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
