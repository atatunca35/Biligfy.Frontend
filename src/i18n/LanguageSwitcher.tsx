import { useI18n } from './useI18n'
import { languages, type Language } from './translations'

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n()
  return (
    <select
      className="lang-select"
      aria-label={t('language')}
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
    >
      {languages.map((l) => (
        <option key={l} value={l}>
          {l.toUpperCase()}
        </option>
      ))}
    </select>
  )
}
