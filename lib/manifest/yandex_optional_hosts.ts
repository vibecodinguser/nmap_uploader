/**
 * Домены Яндекс ID и Диска, к которым расширение обращается за авторизацией.
 *
 * Раньше они стояли в `host_permissions` манифеста: при установке браузер
 * показывал «доступ ко всем данным на сайтах cloud-api.yandex.net, oauth…»,
 * даже если пользователь никогда не включал Блокнот и НСПД. Теперь это
 * необязательные разрешения, которые запрашиваются в момент включения
 * функции — по тому же принципу, что и доступ к nspd.gov.ru (ADR 0005).
 *
 * Объявление паттернов и перенос в необязательные живут здесь и
 * импортируются из `wxt.config.ts`; проверка выдачи — отдельно, в
 * `lib/yandex/permissions.ts`, потому что она нужна и в рантайме.
 */

import type { Browser } from 'wxt/browser'

type ManifestPermission = Browser.runtime.ManifestPermission

const URI_SCHEME = 'https'

const hostPattern = (host: string): string => `${URI_SCHEME}://${host}`

/**
 * Хосты, нужные для входа и работы с Яндекс.Диском.
 *
 * `cloud-api.yandex.net` — REST API Диска; `*.disk.yandex.ru` — загрузка
 * файлов по выданным ссылкам; `oauth.yandex.ru` и `passport.yandex.ru` —
 * экран согласия и выбор аккаунта; `login.yandex.ru` — профиль пользователя;
 * `avatars.yandex.net` — портрет для панели.
 */
export const YANDEX_HOST_PATTERNS = [
  hostPattern('cloud-api.yandex.net/*'),
  hostPattern('*.disk.yandex.ru/*'),
  hostPattern('oauth.yandex.ru/*'),
  hostPattern('passport.yandex.ru/*'),
  hostPattern('login.yandex.ru/*'),
  hostPattern('avatars.yandex.net/*'),
] as const

/**
 * Хост страницы редактора — единственный обязательный.
 *
 * Он остаётся в `host_permissions`: сюда подключаются доки, панели кнопок и
 * приёмник разрешений. Плюс `launchWebAuthFlow` перехватывает окно входа
 * только для инициатора с ненулевым доступом к домену страницы, а окно
 * открывается из фонового скрипта — без этого хоста вход не сработает.
 */
export const NMAPS_HOST_PATTERN = `${hostPattern('n.maps.yandex.ru/*')}`

/** Широкий доступ к домену карты: без него не работают панели и вход. */
export const NMAPS_ORIGIN_PATTERN = NMAPS_HOST_PATTERN

/**
 * Все необязательные хосты расширения.
 *
 * В MV3 попадают в `optional_host_permissions`, в MV2 — в
 * `optional_permissions` вместе с `identity`: отдельного поля для
 * необязательных хостов в MV2 нет.
 */
export const OPTIONAL_HOST_PERMISSIONS = YANDEX_HOST_PATTERNS

export type ManifestPermissions = {
  manifest_version?: number
  permissions?: string[]
  host_permissions?: string[]
  optional_host_permissions?: string[]
  optional_permissions?: string[]
  [key: string]: unknown
}

const appendUnique = (
  current: readonly string[] | undefined,
  additions: readonly string[],
): string[] => Array.from(new Set([...(current ?? []), ...additions]))

const removeAll = (current: readonly string[] | undefined, removals: readonly string[]): string[] =>
  (current ?? []).filter((value) => !removals.includes(value))

/**
 * Переносит хосты Яндекса и `identity` из обязательных разрешений
 * в необязательные.
 *
 * `identity` тоже необязательное: без него `launchWebAuthFlow` недоступен,
 * а для пользователя это лишняя строка в списке разрешений при установке —
 * вход спрашивается вместе с доступом к Диску, то есть по кнопке.
 *
 * Хук вызывается после того, как WXT добавил в `host_permissions` хосты
 * content scripts, поэтому вычищать нужно уже сгенерированный манифест.
 */
export const moveYandexPermissionsToOptional = (manifest: ManifestPermissions): void => {
  const manifestVersion = manifest.manifest_version ?? 3

  manifest.host_permissions = removeAll(manifest.host_permissions, YANDEX_HOST_PATTERNS)
  manifest.permissions = removeAll(manifest.permissions, ['identity'])

  if (manifestVersion === 2) {
    manifest.optional_permissions = appendUnique(manifest.optional_permissions, [
      'identity',
      ...YANDEX_HOST_PATTERNS,
    ])
    delete manifest.optional_host_permissions
    return
  }

  manifest.optional_permissions = appendUnique(manifest.optional_permissions, ['identity'])
  manifest.optional_host_permissions = appendUnique(
    manifest.optional_host_permissions,
    YANDEX_HOST_PATTERNS,
  )
}

/**
 * Полный набор разрешений для входа: API-хост, экран согласия, профиль,
 * портрет и сам `identity`.
 *
 * `permissions.request` принимает их одним вызовом под жест пользователя:
 * экран согласия браузера появляется один раз, а не четыре.
 */
export const YANDEX_PERMISSION_REQUEST: {
  permissions: ManifestPermission[]
  origins: string[]
} = {
  permissions: ['identity'],
  origins: [...YANDEX_HOST_PATTERNS],
}
