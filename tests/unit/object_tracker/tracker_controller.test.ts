// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import type { BatchTransport } from '@/lib/object_tracker/batch_api'
import { parseBatchResponse, RateLimitedError } from '@/lib/object_tracker/batch_api'
import { installCsrfTokenListener } from '@/lib/object_tracker/csrf_token'
import {
  getTrackerLocalState,
  getTrackerSettings,
  setTrackedObjects,
  setTrackerEnabled,
} from '@/lib/object_tracker/storage'
import { ObjectTrackerController } from '@/lib/object_tracker/tracker_controller'
import { MAX_TRACKED_OBJECTS } from '@/lib/object_tracker/types'
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

  it('дотягивает категорию объекта при опросе', async () => {
    await setTrackerEnabled(true)
    // Объект добавлен до появления поля categoryId: название осталось id,
    // иконка была серым placeholder.
    await setTrackedObjects([{ id: '1', title: '1', addedAt: 0 }])

    const transport = vi.fn(async (calls: { method: string }[]) => {
      if (calls[0]?.method === 'editor/getGeoObject') {
        return parseBatchResponse(
          JSON.stringify({
            data: [{ data: { geoObject: { title: 'хутор Захаров', categoryId: 'ad' } } }],
          }),
        )
      }
      return response([commit('10')])
    })
    const controller = createController(transport)
    await controller.start()

    const settings = await getTrackerSettings()
    expect(settings.objects[0]?.categoryId).toBe('ad')
    expect(settings.objects[0]?.title).toBe('хутор Захаров')
    controller.stop()
  })

  it('не перезаписывает уже известную категорию', async () => {
    await setTrackerEnabled(true)
    await setTrackedObjects([{ id: '1', title: 'Объект', categoryId: 'rd', addedAt: 0 }])

    const transport = vi.fn(async () => response([commit('10')]))
    const controller = createController(transport)
    await controller.start()

    const settings = await getTrackerSettings()
    expect(settings.objects[0]?.categoryId).toBe('rd')
    controller.stop()
  })

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
    // Один запрос истории + один на дотягивание категории.
    expect(transport).toHaveBeenCalledTimes(2)
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
    expect(settings.objects[0]?.categoryId).toBe('ad')

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

  it('схлопывает одновременные обновления в один запрос', async () => {
    await setTrackerEnabled(true)
    await setTrackedObjects([{ id: '1', title: 'Объект', categoryId: 'rd', addedAt: 0 }])

    let pending = 0
    const transport = vi.fn(async () => {
      pending += 1
      // Запрос «висит», пока тест не отпустит его.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50)
      })
      return response([commit('10')])
    })
    const controller = createController(transport)
    const started = controller.start()
    // Первый опрос на старте ещё висит на транспорте: дожидаемся запроса.
    await vi.waitFor(() => expect(pending).toBe(1))
    const first = controller.refresh()
    const second = controller.refresh()
    await vi.advanceTimersByTimeAsync(60)
    await Promise.all([first, second, started])

    // Три вызова refresh одного опроса: лишних запросов сервер не получил.
    expect(transport.mock.calls.length).toBe(1)
    expect(pending).toBe(1)
    controller.stop()
  })

  it('на 429 замолкает и повторяет опрос после паузы', async () => {
    await setTrackerEnabled(true)
    await setTrackedObjects([{ id: '1', title: 'Объект', categoryId: 'rd', addedAt: 0 }])

    const transport = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitedError(10_000))
      .mockResolvedValue(response([commit('10')]))
    const controller = createController(transport)
    await controller.start()

    expect(controller.getViewModel().isRateLimited).toBe(true)
    // Ошибка не вылетает наружу и не попадает в карточки объектов.
    expect(controller.getViewModel().errors).toEqual({ '*': 'RATE_LIMITED' })

    // Пока пауза идёт, повторные обновления в сеть не ходят.
    const callsDuringPause = transport.mock.calls.length
    await controller.refresh()
    await controller.refresh()
    expect(transport.mock.calls.length).toBe(callsDuringPause)

    await vi.advanceTimersByTimeAsync(10_000)

    expect(transport.mock.calls.length).toBe(callsDuringPause + 1)
    expect(controller.getViewModel().isRateLimited).toBe(false)
    controller.stop()
  })

  it('на 429 без Retry-After выдерживает паузу по умолчанию', async () => {
    await setTrackerEnabled(true)
    await setTrackedObjects([{ id: '1', title: 'Объект', categoryId: 'rd', addedAt: 0 }])

    const transport = vi.fn().mockRejectedValue(new RateLimitedError(null))
    const controller = createController(transport)
    await controller.start()

    const calls = transport.mock.calls.length
    await vi.advanceTimersByTimeAsync(30_000)
    expect(transport.mock.calls.length).toBe(calls)
    expect(controller.getViewModel().isRateLimited).toBe(true)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(transport.mock.calls.length).toBe(calls + 1)
    controller.stop()
  })

  it('убирает объект из наблюдения через пункт меню', async () => {
    await setTrackerEnabled(true)
    await setTrackedObjects([{ id: '1', title: 'Объект', addedAt: 0 }])

    const controller = createController(vi.fn(async () => response([commit('10')])))
    await controller.start()

    expect(await controller.removeObjectFromMenu('1')).toEqual({ ok: true })
    expect((await getTrackerSettings()).objects).toEqual([])

    // Повторное нажатие «Не наблюдать» уже нечего убирать.
    expect(await controller.removeObjectFromMenu('1')).toEqual({ ok: false, error: 'NOT_FOUND' })
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

  it('использует нативные классы редактора для контролов', async () => {
    await setTrackerEnabled(true)
    await setTrackedObjects([{ id: '1', title: 'Объект', addedAt: 0 }])

    const controller = createController(vi.fn(async () => response([commit('10')])))
    await controller.start()

    const panel = document.getElementById(TRACKER_PANEL_ID)
    const refresh = panel?.querySelector('.nmap-ot-refresh')
    const submit = panel?.querySelector('.nmap-ot-add__submit')
    const input = panel?.querySelector('.nmap-ot-add__field')
    const addRow = panel?.querySelector('.nmap-ot-add__row')

    expect(refresh?.classList.contains('nk-icon_id_reload')).toBe(true)
    expect(refresh?.classList.contains('nk-button')).toBe(false)
    expect(refresh?.parentElement).toBe(addRow)
    expect(submit?.classList.contains('nk-button_view_action')).toBe(true)
    expect(input?.classList.contains('nk-text-input_theme_islands')).toBe(true)
    controller.stop()
  })
})

describe('object_tracker: появление CSRF-токена', () => {
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

  it('повторяет опрос, когда токен появляется после старта', async () => {
    await setTrackerEnabled(true)
    await setTrackedObjects([{ id: '1', title: '1', addedAt: 0 }])

    let token = ''
    const transport = vi.fn(async (calls: { method: string }[]) => {
      if (calls[0]?.method === 'editor/getGeoObject') {
        return parseBatchResponse(
          JSON.stringify({ data: [{ data: { geoObject: { title: 'Хутор', categoryId: 'ad' } } }] }),
        )
      }
      return response([commit('10')])
    })

    const stopListener = installCsrfTokenListener()
    const controller = new ObjectTrackerController({ transport, getToken: () => token })
    await controller.start()

    // На старте токена нет — в сеть не идём.
    expect(transport).not.toHaveBeenCalled()

    token = 'token-1'
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'NMAP_CSRF_TOKEN', token: 'token-1' },
        source: window,
      }),
    )
    await vi.advanceTimersByTimeAsync(50)

    expect(transport).toHaveBeenCalled()
    const settings = await getTrackerSettings()
    expect(settings.objects[0]?.categoryId).toBe('ad')

    controller.stop()
    stopListener()
  })

  describe('addObjectFromMenu', () => {
    it('добавляет объект из меню без CSRF-токена и без запроса к API', async () => {
      await setTrackerEnabled(true)
      const transport = vi.fn(async () => [])
      const controller = new ObjectTrackerController({ transport, getToken: () => '' })
      await controller.start()

      const result = await controller.addObjectFromMenu('123', 'Участок дороги')

      expect(result).toEqual({ ok: true })
      const settings = await getTrackerSettings()
      expect(settings.objects).toEqual([
        { id: '123', title: 'Участок дороги', addedAt: expect.any(Number) },
      ])
      expect(transport).not.toHaveBeenCalled()

      controller.stop()
    })

    it('подставляет id вместо пустого названия', async () => {
      await setTrackerEnabled(true)
      const controller = new ObjectTrackerController({
        transport: vi.fn(async () => []),
        getToken: () => '',
      })
      await controller.start()

      await controller.addObjectFromMenu('123', '   ')

      const settings = await getTrackerSettings()
      expect(settings.objects[0]?.title).toBe('123')

      controller.stop()
    })

    it('отклоняет повторное добавление и некорректный id', async () => {
      await setTrackerEnabled(true)
      await setTrackedObjects([{ id: '123', title: 'Хутор', addedAt: 0 }])
      const controller = new ObjectTrackerController({
        transport: vi.fn(async () => []),
        getToken: () => '',
      })
      await controller.start()

      expect(await controller.addObjectFromMenu('123', 'Хутор')).toEqual({
        ok: false,
        error: 'DUPLICATE',
      })
      expect(await controller.addObjectFromMenu('не-id', '')).toEqual({
        ok: false,
        error: 'INVALID_ID',
      })

      controller.stop()
    })

    it('не добавляет объект сверх лимита наблюдения', async () => {
      await setTrackerEnabled(true)
      await setTrackedObjects(
        Array.from({ length: MAX_TRACKED_OBJECTS }, (_, index) => ({
          id: String(index + 1),
          title: `Объект ${index + 1}`,
          addedAt: 0,
        })),
      )
      const controller = new ObjectTrackerController({
        transport: vi.fn(async () => []),
        getToken: () => '',
      })
      await controller.start()

      expect(await controller.addObjectFromMenu('999', 'Новый')).toEqual({
        ok: false,
        error: 'LIMIT_REACHED',
      })

      controller.stop()
    })
  })
})
