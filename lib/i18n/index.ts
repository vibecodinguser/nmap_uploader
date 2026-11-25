export { getBackgroundLocale } from '@/lib/background/locale'
export { DEFAULT_LOCALE, isLocale, localeFromUiLanguage } from '@/lib/i18n/locale'
export { removeLegacyLocaleSetting } from '@/lib/i18n/locale_migration'
export { createTranslator, getGoToSourceDisplayName } from '@/lib/i18n/translate'
export type {
  InterpolationParams,
  Locale,
  MessageKey,
  Messages,
  TranslateFn,
} from '@/lib/i18n/types'
export { hasUploadAuthErrorInLogs, sessionInvalidMarkers } from '@/lib/i18n/upload_auth_logs'
export { getUploadCompletePrefixes, isUploadCompleteMessage } from '@/lib/i18n/upload_complete'
export { initNativeLocaleBridge, observeLocale } from '@/lib/locale_bootstrap'
export {
  NATIVE_LOCALE_MESSAGE,
  NATIVE_LOCALE_QUERY_PARAM,
  withNativeLocaleParam,
} from '@/lib/locale_bridge'
export {
  getNativeLocaleSnapshot,
  observeNativeLocale,
  readNativeLocale,
  setNativeLocale,
  subscribeNativeLocale,
  toNativeLocale,
} from '@/lib/native_locale'
