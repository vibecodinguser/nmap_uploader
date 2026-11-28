import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleGetYandexPermissions } from '@/lib/background/yandex_permissions'
import { YANDEX_PERMISSION_REQUEST } from '@/lib/manifest/yandex_optional_hosts'
import type { RuntimeMessageSender } from '@/lib/message_auth'
import { permissionsMock } from '@/tests/setup/browser_mock'

const nmapsSender: RuntimeMessageSender = {
  tab: { url: 'https://n.maps.yandex.ru/#!/objects/1?z=14' },
}

const foreignSender: RuntimeMessageSender = {
  tab: { url: 'https://example.com/' },
}

describe('background: разрешения Яндекса для кнопки заметок', () => {
  beforeEach(() => {
    permissionsMock.revoke(...YANDEX_PERMISSION_REQUEST.origins)
  })

  it('отвечает контент-скрипту карты, выданы ли разрешения', async () => {
    permissionsMock.grant(...YANDEX_PERMISSION_REQUEST.origins)
    const sendResponse = vi.fn()

    expect(handleGetYandexPermissions({}, nmapsSender, sendResponse)).toBe(true)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ granted: true }))
  })

  it('без выдачи отвечает отказом, а не ошибкой', async () => {
    const sendResponse = vi.fn()

    handleGetYandexPermissions({}, nmapsSender, sendResponse)

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ granted: false }))
  })

  it('не отвечает чужой странице', () => {
    const sendResponse = vi.fn()

    handleGetYandexPermissions({}, foreignSender, sendResponse)

    expect(sendResponse).toHaveBeenCalledWith({ granted: false })
  })
})
