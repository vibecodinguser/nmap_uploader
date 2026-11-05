// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import type { BatchTransport } from '@/lib/object_tracker/batch_api'
import { parseBatchResponse } from '@/lib/object_tracker/batch_api'
import {
  getTrackerLocalState,
  getTrackerSettings,
  setTrackedObjects,
  setTrackerEnabled,
} from '@/lib/object_tracker/storage'
import { ObjectTrackerController } from '@/lib/object_tracker/tracker_controller'
import { TRACKER_PANEL_ID } from '@/lib/object_tracker/ui/dom'
import { resetBrowserMocks } from '../../setup/browser_mock'

const buildSidebar = (): void => {
  document.body.innerHTML = `
    <div class="nk-size-observer">
      <div class="nk-sidebar-header-view nk-section nk-section_level_1">Уведомления</div>
      <div class="nk-tabs-bar nk-section nk-section_level_1">
        <div class="nk-tabs-bar__tabs">
          <div class="nk-tabs-bar__tab nk-tabs-bar__tab_selected">Мои правки</div>
          <div class="nk-tabs-bar__tab">Подписки</div>
        </div>
      </div>
      <div class="nk-section nk-section_level_1">нативный контент</div>
    </div>
  `
}

const commit = (id: string, date = '2026-11-05T11:22:11+03:00') => ({
  id,
  date,
  action: 'object-modified',
  primary: true,
  primaryObjectId: '1',
  approveStatus: 'pending',
  state: 'draft',
  user: { publicId: 'user', displayName: 'user' },
})

const response = (commits: unknown[]) =>
  parseBatchResponse(
    JSON.stringify({
      data: [
        {
          data: {
            commits,
            pager: { totalCount: commits.length, perPage: 20, page: 1 },
          },
        },
      ],
    }),
  )

const geoObjectResponse = (title = 'хутор Захаров') =>
  parseBatchResponse(
    JSON.stringify({ data: [{ data: { geoObject: { title, categoryId: 'ad' } } }] }),
  )

describe('object_tracker: контроллер', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
    await browser.storage.sync.clear()
    await browser.storage.local.clear()
    buildSidebar()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const createController = (transport: BatchTransport, token = 'token') =>
    new ObjectTrackerController({ transport, getToken: () => token })

  it('не монтирует вкладку, пока функция выключена', async () => {
    const transport = vi.fn(async () => [])
    const controller = createController(transport)

    await controller.start()

    expect(document.getElementById(TRACKER_PANEL_ID)).toBeNull()
    controller.stop()
  })

  it('монтирует вкладку и опрашивает историю, когда включено', async () => {
    await setTrackerEnabled(true)
    await setTrackedObjects([{ id: '1', title: 'Объект', addedAt: 0 }])

    const transport = vi.fn(async () => response([commit('10')]))
    const controller = createController(transport)

    await controller.start()

    expect(document.getElementById(TRACKER_PANEL_ID)).not.toBeNull()
    expect(transport).toHaveBeenCalledTimes(1)
    controller.stop()
  })

  it('добавляет объект и сразу ставит отметку прочтения', async () => {
    await setTrackerEnabled(true)

    const transport = vi.fn(async () => [...geoObjectResponse(), ...response([commit('10')])])
    const controller = createController(transport)
    await controller.start()

    const result = await controller.addObject('123')

    expect(result.ok).toBe(true)
    const settings = await getTrackerSettings()
    expect(settings.objects.map((object) => object.id)).toEqual(['123'])
    expect(settings.objects[0]?.title).toBe('хутор Захаров')

    const state = await getTrackerLocalState()
    expect(state.readMarks['123']).toBe('10')
    controller.stop()
  })

  it('не добавляет несуществующий объект', async () => {
    await setTrackerEnabled(true)
    const transport = vi.fn(async () =>
      parseBatchResponse(
        JSON.stringify({ data: [{ error: { type: 'ERR_MISSING_OBJECT' } }, { data: {} }] }),
      ),
    )
    const controller = createController(transport)
    await controller.start()

    const result = await controller.addObject('999')

    expect(result).toEqual({ ok: false, error: 'MISSING_OBJECT' })
    const settings = await getTrackerSettings()
    expect(settings.objects).toEqual([])
    controller.stop()
  })

  it('отклоняет нечисловой id', async () => {
    await setTrackerEnabled(true)
    const controller = createController(vi.fn(async () => []))
    await controller.start()

    await expect(controller.addObject('abc')).resolves.toEqual({
      ok: false,
      error: 'INVALID_ID',
    })
    controller.stop()
  })

  it('отклоняет дубль', async () => {
    await setTrackerEnabled(true)
    await setTrackedObjects([{ id: '1', title: 'Объект', addedAt: 0 }])
    const controller = createController(vi.fn(async () => response([commit('10')])))
    await controller.start()

    await expect(controller.addObject('1')).resolves.toEqual({
      ok: false,
      error: 'DUPLICATE',
    })
    controller.stop()
  })

  it('отклоняет добавление сверх лимита', async () => {
    await setTrackerEnabled(true)
    const objects = Array.from({ length: 30 }, (_, index) => ({
      id: String(index + 1),
      title: '',
      addedAt: 0,
    }))
    await setTrackedObjects(objects)

    const controller = createController(vi.fn(async () => response([])))
    await controller.start()

    await expect(controller.addObject('999')).resolves.toEqual({
      ok: false,
      error: 'LIMIT_REACHED',
    })
    controller.stop()
  })

  it('сообщает об отсутствии токена вместо запроса', async () => {
    await setTrackerEnabled(true)
    const transport = vi.fn(async () => [])
    const controller = createController(transport, '')
    await controller.start()

    expect(transport).not.toHaveBeenCalled()
    expect(controller.getViewModel().hasToken).toBe(false)
    controller.stop()
  })

  it('помечает новые коммиты относительно отметки прочтения', async () => {
    await setTrackerEnabled(true)
    await setTrackedObjects([{ id: '1', title: 'Объект', addedAt: 0 }])

    const transport = vi.fn(async () => response([commit('11'), commit('10')]))
    const controller = createController(transport)
    await controller.start()

    // Первый опрос: отметки нет, новых коммитов нет.
    expect(controller.getViewModel().newCommitIds.size).toBe(0)

    await controller.markAllRead()
    expect(controller.getViewModel().newCommitIds.size).toBe(0)

    // Появился новый коммит.
    transport.mockImplementation(async () => response([commit('12'), commit('11'), commit('10')]))
    await controller.refresh()

    expect([...controller.getViewModel().newCommitIds]).toEqual(['12'])
    controller.stop()
  })

  it('удаляет объект и его локальные данные', async () => {
    await setTrackerEnabled(true)
    await setTrackedObjects([{ id: '1', title: 'Объект', addedAt: 0 }])

    const transport = vi.fn(async () => response([commit('10')]))
    const controller = createController(transport)
    await controller.start()
    await controller.markAllRead()

    await controller.removeObject('1')

    expect((await getTrackerSettings()).objects).toEqual([])
    expect((await getTrackerLocalState()).readMarks['1']).toBeUndefined()
    controller.stop()
  })

  it('переключает режим отображения', async () => {
    await setTrackerEnabled(true)
    await setTrackedObjects([{ id: '1', title: 'Объект', addedAt: 0 }])

    const controller = createController(vi.fn(async () => response([commit('10')])))
    await controller.start()

    expect(controller.getViewModel().mode).toBe('feed')
    controller.stop()
  })

  it('красит панель текущей темой при монтировании', async () => {
    await setTrackerEnabled(true)
    await setTrackedObjects([{ id: '1', title: 'Объект', addedAt: 0 }])

    const controller = createController(vi.fn(async () => response([commit('10')])))
    await controller.start()

    const panel = document.getElementById(TRACKER_PANEL_ID)
    expect(panel?.style.getPropertyValue('--nmap-ot-bg')).toBeTruthy()
    expect(panel?.style.getPropertyValue('color-scheme')).toMatch(/light|dark/)
    controller.stop()
  })
})
