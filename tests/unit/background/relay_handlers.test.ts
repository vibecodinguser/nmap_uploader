// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handlePointPicked } from '@/lib/background/relay_handlers'
import { processRelayToMapTabs } from '@/lib/background/relay_sender'
import { POINT_PICKED_ACTION } from '@/lib/pick_point_action'
import { EXTENSION_ID } from '@/tests/setup/browser_mock'

vi.mock('@/lib/background/relay_sender', () => ({
  processRelayToMapTabs: vi.fn(() => Promise.resolve()),
}))

const nmapsSender = {
  id: EXTENSION_ID,
  tab: { id: 42, url: 'https://n.maps.yandex.ru/#!/objects/1' },
}

describe('handlePointPicked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ретранслирует координаты во вкладку карты вместе с меткой источника', () => {
    const sendResponse = vi.fn()

    const result = handlePointPicked(
      {
        action: POINT_PICKED_ACTION,
        coords: [[55.7, 37.6]],
        geomType: 'Point',
        source: 'notesSidebar',
      },
      nmapsSender,
      sendResponse,
    )

    expect(result).toBe(true)
    expect(processRelayToMapTabs).toHaveBeenCalledWith(
      nmapsSender,
      {
        action: POINT_PICKED_ACTION,
        coords: [[55.7, 37.6]],
        geomType: 'Point',
        source: 'notesSidebar',
      },
      sendResponse,
      'pointPicked',
    )
  })

  it('передаёт пустой набор как «рисование прервано»', () => {
    const sendResponse = vi.fn()

    handlePointPicked(
      { coords: [], geomType: 'LineString', source: 'notesSidebar' },
      nmapsSender,
      sendResponse,
    )

    expect(processRelayToMapTabs).toHaveBeenCalledWith(
      nmapsSender,
      {
        action: POINT_PICKED_ACTION,
        coords: [],
        geomType: 'LineString',
        source: 'notesSidebar',
      },
      sendResponse,
      'pointPicked',
    )
  })

  it('подставляет пустой набор, если координаты пришли не массивом', () => {
    const sendResponse = vi.fn()

    handlePointPicked({ coords: '55,37' }, nmapsSender, sendResponse)

    expect(processRelayToMapTabs).toHaveBeenCalledWith(
      nmapsSender,
      {
        action: POINT_PICKED_ACTION,
        coords: [],
        geomType: 'Point',
        source: undefined,
      },
      sendResponse,
      'pointPicked',
    )
  })

  it('отклоняет отправителя не из вкладки карты', () => {
    const sendResponse = vi.fn()

    handlePointPicked(
      { coords: [[55.7, 37.6]], geomType: 'Point' },
      { id: EXTENSION_ID, tab: { id: 1, url: 'https://nakarte.me/#m=10/55/37' } },
      sendResponse,
    )

    expect(processRelayToMapTabs).not.toHaveBeenCalled()
    expect(sendResponse).toHaveBeenCalledWith({ ok: false })
  })
})
