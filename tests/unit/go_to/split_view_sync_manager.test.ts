// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GO_TO_SPLIT_BUTTON_ID } from '@/lib/go_to_split_button'
import { mountSplitDomElements } from '@/lib/go_to_split_view/dom'
import {
  readNmapsLocation,
  SplitSyncManager,
  updateSplitButtonState,
} from '@/lib/go_to_split_view/sync_manager'
import { GO_TO_SPLIT_BUTTON_ACTIVE_CLASS } from '@/lib/go_to_styles'

describe('go_to_split_view/sync_manager', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    window.location.hash = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('updateSplitButtonState корректно выставляет класс и атрибут aria-pressed', () => {
    const btn = document.createElement('button')
    btn.id = GO_TO_SPLIT_BUTTON_ID
    document.body.appendChild(btn)

    updateSplitButtonState(true)
    expect(btn.classList.contains(GO_TO_SPLIT_BUTTON_ACTIVE_CLASS)).toBe(true)
    expect(btn.getAttribute('aria-pressed')).toBe('true')

    updateSplitButtonState(false)
    expect(btn.classList.contains(GO_TO_SPLIT_BUTTON_ACTIVE_CLASS)).toBe(false)
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('readNmapsLocation возвращает локацию из текущего URL', () => {
    window.location.hash = '!/?z=15&ll=37.61,55.75'
    const loc = readNmapsLocation()
    expect(loc).toEqual({
      longitude: 37.61,
      latitude: 55.75,
      zoom: 15,
    })
  })

  it('SplitSyncManager инициализирует слушатели и корректно освобождает ресурсы при dispose', () => {
    const dom = mountSplitDomElements('https://nakarte.me')
    const initialLocation = { longitude: 37.61, latitude: 55.75, zoom: 15 }
    const manager = new SplitSyncManager(dom, initialLocation)

    manager.initListeners()
    manager.postInitialLocation()
    manager.hideCursorMarkers()

    expect(() => manager.dispose()).not.toThrow()
  })

  it('игнорирует промежуточные boundschange от НЯК в период открытия сплита', () => {
    const dom = mountSplitDomElements('https://nakarte.me')
    if (!dom.iframe.contentWindow) {
      throw new Error('contentWindow is not available')
    }
    const postMessageSpy = vi.spyOn(dom.iframe.contentWindow, 'postMessage')
    const initialLocation = { longitude: 39.115112, latitude: 44.987153, zoom: 18 }
    const manager = new SplitSyncManager(dom, initialLocation)
    manager.initListeners()

    // Спровоцированный сжатием окна ложный boundschange
    const fakeResizeEvent = new CustomEvent('nmaps:boundsChange', {
      detail: { latitude: 44.98713, longitude: 39.12882, zoom: 18 },
    })
    document.dispatchEvent(fakeResizeEvent)

    // В период открытия сплита ложные координаты не должны улетать в iframe
    expect(postMessageSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'set_location',
        location: expect.objectContaining({ longitude: 39.12882 }),
      }),
      expect.anything(),
    )

    manager.dispose()
  })

  it('динамически обновляет класс предупреждения на баннере при изменении зума', () => {
    const banner = document.createElement('div')
    banner.id = 'nmapUploaderSplitBanner'
    banner.className = 'nmap-uploader-split-banner'
    document.body.appendChild(banner)

    const dom = mountSplitDomElements('https://nakarte.me')
    const manager = new SplitSyncManager(dom, { longitude: 37.61, latitude: 55.75, zoom: 19 })
    manager.initListeners()
    expect(banner.classList.contains('nmap-uploader-split-banner--warning')).toBe(true)

    // При имитации колесика мыши (zoom out до 18)
    const wheelEvent = new WheelEvent('wheel', { deltaY: 100 })
    window.dispatchEvent(wheelEvent)
    expect(banner.classList.contains('nmap-uploader-split-banner--warning')).toBe(false)

    manager.dispose()
  })

  it('не откатывает зум Народной карты назад, если nmaps зум > 18, а от Nakarte пришел зум <= 18', () => {
    vi.useFakeTimers()
    window.location.hash = '!/?z=19&ll=37.61,55.75'
    const dom = mountSplitDomElements('https://nakarte.me')
    const manager = new SplitSyncManager(dom, { longitude: 37.61, latitude: 55.75, zoom: 19 })
    manager.initListeners()

    // Проматываем период открытия сплита (grace period 800мс)
    vi.advanceTimersByTime(1000)

    // Имитируем входящее сообщение от iframe Nakarte с зумом 18 (лимит тайлов Nakarte)
    const msgEvent = new MessageEvent('message', {
      origin: 'https://nakarte.me',
      source: dom.iframe.contentWindow,
      data: {
        source: 'nakarte_sync',
        type: 'location',
        location: { longitude: 37.62, latitude: 55.76, zoom: 18 },
      },
    })
    window.dispatchEvent(msgEvent)

    // Проматываем debounce синхронизации
    vi.advanceTimersByTime(100)

    // Проверяем, что в hash Народной карты координаты обновились, но зум сохранился на 19
    expect(window.location.hash).toContain('z=19')
    expect(window.location.hash).toContain('37.62%2C55.76')

    manager.dispose()
    vi.useRealTimers()
  })
})
