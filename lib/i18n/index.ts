export { getBackgroundLocale } from '@/lib/background/locale'

export { removeLegacyLocaleSetting } from '@/lib/i18n/locale_migration'
export { createTranslator, getGoToSourceDisplayName } from '@/lib/i18n/translate'
export type {
  Locale,
  MessageKey,
  TranslateFn,
} from '@/lib/i18n/types'

export {
  getNativeLocaleSnapshot,
  observeNativeLocale,
  readNativeLocale,
} from '@/lib/native_locale'
