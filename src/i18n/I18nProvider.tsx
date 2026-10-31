import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, type I18nValue } from './context'
import { languages, translations, type Language } from './translations'

const STORAGE_KEY = 'biligfy.language'

function initialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY)
  return languages.find((l) => l === stored) ?? 'tr'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLanguageState(next)
  }, [])

  const value = useMemo<I18nValue>(
    () => ({
      language,
      setLanguage,
      t: (key, params) => {
        let text: string = translations[language][key]
        for (const [name, v] of Object.entries(params ?? {})) {
          text = text.replace(`{${name}}`, v)
        }
        return text
      },
    }),
    [language, setLanguage],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
