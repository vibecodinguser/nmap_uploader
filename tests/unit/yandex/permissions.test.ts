import { describe, expect, it } from 'vitest'
import { YANDEX_PERMISSION_REQUEST } from '@/lib/manifest/yandex_optional_hosts'
import { hasYandexPermissions, readYandexPermissionState } from '@/lib/yandex/permissions'
import { permissionsMock } from '@/tests/setup/browser_mock'

describe('yandex permissions', () => {
  it('по умолчанию разрешения выданы (фикстура)', async () => {
    await expect(hasYandexPermissions()).resolves.toBe(true)
    await expect(readYandexPermissionState()).resolves.toBe('granted')
  })

  it('после отзыва одного хоста состояние становится denied', async () => {
    permissionsMock.revoke(YANDEX_PERMISSION_REQUEST.origins[0])

    await expect(hasYandexPermissions()).resolves.toBe(false)
    await expect(readYandexPermissionState()).resolves.toBe('denied')
  })

  it('сбой API разрешений даёт unknown, а не ложное «выданы»', async () => {
    permissionsMock.contains.mockRejectedValueOnce(new Error('boom'))

    await expect(readYandexPermissionState()).resolves.toBe('unknown')
  })
})
