import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import de from '@/locales/de.json'

const messages = {
  en,
  de,
}

export type SupportedLocale = keyof typeof messages

export function getSupportedLocale(input: string | null | undefined): SupportedLocale | undefined {
  if (!input) return undefined

  const lower = input.toLowerCase()

  if (lower.startsWith('de')) return 'de'
  if (lower.startsWith('en')) return 'en'

  return undefined
}

export function normalizeLocale(input: string | null | undefined): SupportedLocale {
  return getSupportedLocale(input) ?? 'en'
}

export function getBrowserLocale(): SupportedLocale | undefined {
  const languages = [
    ...(navigator.languages ?? []),
    navigator.language,
  ]

  for (const language of languages) {
    const locale = getSupportedLocale(language)
    if (locale) return locale
  }

  return undefined
}

export function resolveLocale(configLanguage: string | null | undefined): SupportedLocale {
  return getBrowserLocale() ?? normalizeLocale(configLanguage)
}

export const i18n = createI18n({
  legacy: false,
  locale: resolveLocale(null),
  fallbackLocale: 'en',
  messages,
})

export function setI18nLanguage(language: string | null | undefined) {
  const locale = normalizeLocale(language)

  i18n.global.locale.value = locale
  document.documentElement.lang = locale

  return locale
}

export function setI18nLanguageFromConfig(language: string | null | undefined) {
  const locale = resolveLocale(language)

  i18n.global.locale.value = locale
  document.documentElement.lang = locale

  return locale
}
