/**
 * Необязательный доступ к nspd.gov.ru.
 *
 * Браузер отключает расширение при обновлении, если в новой версии появились новые
 * обязательные разрешения — включая `host_permissions` и `content_scripts.matches`.
 * Поэтому доступ к НСПД объявляется необязательным и запрашивается в рантайме,
 * а content scripts на этом домене регистрируются динамически.
 *
 * Модуль не импортирует `wxt/browser`: он используется и в `wxt.config.ts` при сборке.
 */

const URI_SCHEME = 'https'

// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
const hostPattern = (host: string): string => URI_SCHEME + '://' + host

/** Паттерны, которые раньше стояли в `host_permissions` и `content_scripts.matches`. */
export const NSPD_HOST_PATTERNS = [
  hostPattern('nspd.gov.ru/*'),
  hostPattern('*.nspd.gov.ru/*'),
] as const

const NSPD_HOST_PATTERN_REGEX = /^https:\/\/(?:\*\.)?nspd\.gov\.ru\//

export const isNspdHostPattern = (pattern: string): boolean => NSPD_HOST_PATTERN_REGEX.test(pattern)

export type ManifestWithPermissions = {
  manifest_version?: number
  permissions?: string[]
  host_permissions?: string[]
  optional_host_permissions?: string[]
  optional_permissions?: string[]
  [key: string]: unknown
}

const withoutNspdPatterns = (patterns: readonly string[] | undefined): string[] =>
  (patterns ?? []).filter((pattern) => !isNspdHostPattern(pattern))

const withNspdPatterns = (patterns: readonly string[] | undefined): string[] =>
  Array.from(new Set([...withoutNspdPatterns(patterns), ...NSPD_HOST_PATTERNS]))

/**
 * Переносит доступ к НСПД из обязательных разрешений в необязательные.
 *
 * В MV3 используется `optional_host_permissions`, в MV2 (Firefox) — `optional_permissions`:
 * отдельного поля для необязательных хостов в MV2 нет, а WXT не конвертирует
 * `optional_host_permissions` при понижении версии манифеста.
 *
 * Вызывать в хуке `build:manifestGenerated`: к этому моменту WXT уже добавил
 * в `host_permissions` паттерны content scripts с `registration: 'runtime'`.
 */
export const moveNspdHostPermissionsToOptional = (manifest: ManifestWithPermissions): void => {
  const manifestVersion = manifest.manifest_version ?? 3

  manifest.host_permissions = withoutNspdPatterns(manifest.host_permissions)

  if (manifest.permissions) {
    manifest.permissions = withoutNspdPatterns(manifest.permissions)
  }

  if (manifestVersion === 2) {
    manifest.optional_permissions = withNspdPatterns(manifest.optional_permissions)
    // В MV2 нет отдельного поля для необязательных хостов.
    delete manifest.optional_host_permissions
    return
  }

  manifest.optional_host_permissions = withNspdPatterns(manifest.optional_host_permissions)
}
