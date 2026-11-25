import { describe, expect, it } from 'vitest'
import {
  type ManifestPermissions,
  moveYandexPermissionsToOptional,
  NMAPS_HOST_PATTERN,
  YANDEX_HOST_PATTERNS,
  YANDEX_PERMISSION_REQUEST,
} from '@/lib/manifest/yandex_optional_hosts'

const buildManifest = (overrides: Partial<ManifestPermissions> = {}): ManifestPermissions => ({
  manifest_version: 3,
  permissions: ['storage', 'scripting', 'activeTab', 'tabs', 'identity'],
  host_permissions: [NMAPS_HOST_PATTERN, ...YANDEX_HOST_PATTERNS],
  ...overrides,
})

describe('yandex_optional_hosts', () => {
  it('в MV3 убирает домены Яндекса и identity из обязательных разрешений', () => {
    const manifest = buildManifest()

    moveYandexPermissionsToOptional(manifest)

    expect(manifest.host_permissions).toEqual([NMAPS_HOST_PATTERN])
    expect(manifest.permissions).toEqual(['storage', 'scripting', 'activeTab', 'tabs'])
    expect(manifest.optional_permissions).toEqual(['identity'])
    expect(manifest.optional_host_permissions).toEqual([...YANDEX_HOST_PATTERNS])
  })

  it('оставляет домен редактора обязательным: без него не работает вход', () => {
    const manifest = buildManifest()

    moveYandexPermissionsToOptional(manifest)

    expect(manifest.host_permissions).toContain(NMAPS_HOST_PATTERN)
  })

  it('в MV2 кладёт identity и хосты в optional_permissions', () => {
    const manifest = buildManifest({ manifest_version: 2, optional_host_permissions: undefined })

    moveYandexPermissionsToOptional(manifest)

    expect(manifest.permissions).not.toContain('identity')
    expect(manifest.optional_permissions).toEqual(['identity', ...YANDEX_HOST_PATTERNS])
    expect(manifest.optional_host_permissions).toBeUndefined()
  })

  it('не дублирует записи при повторном вызове', () => {
    const manifest = buildManifest()

    moveYandexPermissionsToOptional(manifest)
    moveYandexPermissionsToOptional(manifest)

    expect(manifest.optional_permissions).toEqual(['identity'])
    expect(manifest.optional_host_permissions).toEqual([...YANDEX_HOST_PATTERNS])
  })

  it('сохраняет уже объявленные необязательные хосты (НСПД)', () => {
    const manifest = buildManifest({
      optional_host_permissions: ['https://nspd.gov.ru/*'],
    })

    moveYandexPermissionsToOptional(manifest)

    expect(manifest.optional_host_permissions).toEqual([
      'https://nspd.gov.ru/*',
      ...YANDEX_HOST_PATTERNS,
    ])
  })

  it('просит одним вызовом и identity, и все хосты', () => {
    expect(YANDEX_PERMISSION_REQUEST.permissions).toEqual(['identity'])
    expect(YANDEX_PERMISSION_REQUEST.origins).toEqual([...YANDEX_HOST_PATTERNS])
  })
})
