import { describe, expect, it } from 'vitest'
import {
  isNspdHostPattern,
  type ManifestWithPermissions,
  moveNspdHostPermissionsToOptional,
  NSPD_HOST_PATTERNS,
} from '@/lib/manifest/nspd_optional_hosts'

const OTHER_HOST = 'https://n.maps.yandex.ru/*'

const buildManifest = (overrides: Partial<ManifestWithPermissions> = {}) => {
  const manifest: ManifestWithPermissions = {
    manifest_version: 3,
    host_permissions: [OTHER_HOST, 'https://nspd.gov.ru/*', 'https://*.nspd.gov.ru/*'],
    ...overrides,
  }
  return manifest
}

describe('nspd_optional_hosts', () => {
  it('распознаёт паттерны НСПД и не трогает чужие хосты', () => {
    expect(isNspdHostPattern('https://nspd.gov.ru/*')).toBe(true)
    expect(isNspdHostPattern('https://*.nspd.gov.ru/*')).toBe(true)
    expect(isNspdHostPattern(OTHER_HOST)).toBe(false)
    expect(isNspdHostPattern('https://nspd.gov.ru.example.com/*')).toBe(false)
  })

  it('в MV3 переносит хосты НСПД из host_permissions в optional_host_permissions', () => {
    const manifest = buildManifest()

    moveNspdHostPermissionsToOptional(manifest)

    expect(manifest.host_permissions).toEqual([OTHER_HOST])
    expect(manifest.optional_host_permissions).toEqual([...NSPD_HOST_PATTERNS])
  })

  it('в MV3 не дублирует паттерны при повторном вызове', () => {
    const manifest = buildManifest()

    moveNspdHostPermissionsToOptional(manifest)
    moveNspdHostPermissionsToOptional(manifest)

    expect(manifest.optional_host_permissions).toEqual([...NSPD_HOST_PATTERNS])
  })

  it('в MV2 использует optional_permissions и не оставляет optional_host_permissions', () => {
    const manifest = buildManifest({
      manifest_version: 2,
      permissions: ['storage', OTHER_HOST, 'https://nspd.gov.ru/*'],
      optional_host_permissions: undefined,
    })

    moveNspdHostPermissionsToOptional(manifest)

    expect(manifest.permissions).toEqual(['storage', OTHER_HOST])
    expect(manifest.optional_permissions).toEqual([...NSPD_HOST_PATTERNS])
    expect(manifest.optional_host_permissions).toBeUndefined()
  })

  it('сохраняет уже объявленные необязательные хосты', () => {
    const manifest = buildManifest({ optional_host_permissions: ['https://example.com/*'] })

    moveNspdHostPermissionsToOptional(manifest)

    expect(manifest.optional_host_permissions).toEqual([
      'https://example.com/*',
      ...NSPD_HOST_PATTERNS,
    ])
  })

  it('не падает на манифесте без host_permissions', () => {
    const manifest: ManifestWithPermissions = { manifest_version: 3 }

    moveNspdHostPermissionsToOptional(manifest)

    expect(manifest.host_permissions).toEqual([])
    expect(manifest.optional_host_permissions).toEqual([...NSPD_HOST_PATTERNS])
  })
})
