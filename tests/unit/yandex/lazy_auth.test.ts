import { describe, expect, it } from 'vitest'
import { YANDEX_PERMISSION_REQUEST } from '@/lib/manifest/yandex_optional_hosts'
import { ensureYandexAuth } from '@/lib/yandex/auth'
import { saveAuth } from '@/lib/yandex/storage'
import { launchWebAuthFlow, permissionsMock } from '@/tests/setup/browser_mock'

const STORED_USER = { id: '123', login: 'testuser' }

describe('ensureYandexAuth без разрешений Яндекса', () => {
  it('не делает сетевых запросов и не открывает окно входа', async () => {
    permissionsMock.revoke(...YANDEX_PERMISSION_REQUEST.origins)
    await saveAuth({ token: 'test-token', user: STORED_USER })

    await expect(ensureYandexAuth({ interactive: false })).resolves.toBeNull()
    expect(launchWebAuthFlow).not.toHaveBeenCalled()
  })

  it('восстанавливает сохранённую сессию, если разрешения выданы', async () => {
    await saveAuth({ token: 'test-token', user: STORED_USER })

    const auth = await ensureYandexAuth({ interactive: false })

    expect(auth?.token).toBe('test-token')
    expect(launchWebAuthFlow).not.toHaveBeenCalled()
  })
})
