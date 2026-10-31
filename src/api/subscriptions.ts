import { request } from './client'
import { getToken } from './session'

export type BillingCycle = 'Monthly' | 'Yearly' | 'Weekly'
export type Currency = 'TRY' | 'USD' | 'EUR' | 'GBP'

export const billingCycles: BillingCycle[] = ['Monthly', 'Yearly', 'Weekly']
export const currencies: Currency[] = ['TRY', 'USD', 'EUR', 'GBP']

export interface Subscription {
  id: string
  name: string
  vendor: string | null
  amount: number
  currency: Currency
  billingCycle: BillingCycle
  /** YYYY-MM-DD */
  nextRenewalDate: string
  cancellationNoticeDays: number | null
  category: string | null
  notes: string | null
  isActive: boolean
  createdAtUtc: string
  updatedAtUtc: string
}

export interface SubscriptionInput {
  name: string
  vendor: string | null
  amount: number
  currency: Currency
  billingCycle: BillingCycle
  nextRenewalDate: string
  cancellationNoticeDays: number | null
  category: string | null
  notes: string | null
  isActive: boolean
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}

export interface ListParams {
  page?: number
  pageSize?: number
  isActive?: boolean
}

function authed(init: RequestInit = {}): RequestInit {
  return { ...init, headers: { Authorization: `Bearer ${getToken() ?? ''}` } }
}

export const subscriptionsApi = {
  list: ({ page = 1, pageSize = 20, isActive }: ListParams = {}) => {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    if (isActive !== undefined) query.set('isActive', String(isActive))
    return request<PagedResult<Subscription>>(
      `/api/subscriptions?${query.toString()}`,
      authed(),
    )
  },
  get: (id: string) =>
    request<Subscription>(`/api/subscriptions/${id}`, authed()),
  create: (input: SubscriptionInput) =>
    request<Subscription>(
      '/api/subscriptions',
      authed({ method: 'POST', body: JSON.stringify(input) }),
    ),
  update: (id: string, input: SubscriptionInput) =>
    request<Subscription>(
      `/api/subscriptions/${id}`,
      authed({ method: 'PUT', body: JSON.stringify(input) }),
    ),
  remove: (id: string) =>
    request<void>(`/api/subscriptions/${id}`, authed({ method: 'DELETE' })),
}
