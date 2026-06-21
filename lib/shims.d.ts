declare module '@/lib/i18n/locale' {
  import type { Locale, LocaleOption } from '@/lib/i18n/locale.types'

  export type { Locale, LocaleOption }

  export const DEFAULT_LOCALE: Locale

  export const LOCALE_STORAGE_KEY: string

  export const LOCALE_OPTIONS: readonly LocaleOption[]

  export function isLocale(value: unknown): value is Locale

  export function localeFromUiLanguage(uiLanguage: string): Locale
}

declare module '@/lib/i18n/translate' {
  import type { Locale } from '@/lib/i18n/locale.types'
  import type { TranslateFn } from '@/lib/i18n/types'

  export function createTranslator(locale: Locale): TranslateFn
  export function getGoToSourceDisplayName(name: string, locale: Locale): string
}

declare module '@/lib/i18n/upload_complete' {
  import type { Locale } from '@/lib/i18n/locale.types'

  export function getUploadCompletePrefixes(locale: Locale): string[]
  export function isUploadCompleteMessage(message: string, locale: Locale): boolean
}

declare module '@/lib/i18n/upload_auth_logs' {
  export const sessionInvalidMarkers: readonly string[]
  export function hasUploadAuthErrorInLogs(messages: string[]): boolean
}

declare module '@/lib/i18n/locale_state' {
  import type { Locale } from '@/lib/i18n/locale.types'

  export function getRuntimeLocale(): Locale
  export function setRuntimeLocale(locale: Locale): void
}

declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson'

  function shp(input: ArrayBuffer | string): Promise<FeatureCollection | FeatureCollection[]>
  export default shp
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module 'topojson-client' {
  import type { Feature, FeatureCollection } from 'geojson'
  import type { Topology } from 'topojson-specification'

  type TopoJsonObject = Topology['objects'][string]

  export function feature(topology: Topology, object: TopoJsonObject): Feature | FeatureCollection
}
