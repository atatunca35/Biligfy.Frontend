import { createContext } from 'react'
import type { Language, TranslationKey } from './translations'

export interface I18nValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey, params?: Record<string, string>) => string
}

export const I18nContext = createContext<I18nValue | null>(null)
