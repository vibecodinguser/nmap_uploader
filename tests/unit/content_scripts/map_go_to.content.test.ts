// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import mapGoToScript from '@/entrypoints/map-go-to.content'
import { OPEN_NSPD_TARGET_ACTION } from '@/lib/background/nspd_handlers'
import { GO_TO_MENU_ITEM_ID_PREFIX, MENU_ID, MENU_ITEMS_ID } from '@/lib/go_to/menu_dom'
import { GO_TO_REFRESH_ACTION } from '@/lib/go_to_notify'
import { GO_TO_SERVICE_BUTTON_ID } from '@/lib/go_to_service_button'
import { GO_TO_ITEMS_STORAGE_KEY, GO_TO_MENU_ENABLED_STORAGE_KEY } from '@/lib/go_to_settings'
import {
  GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY,
  GO_TO_SPLIT_BUTTON_ID,
} from '@/lib/go_to_split_button'
import { GO_TO_POPUP_VISIBLE_CLASS } from '@/lib/go_to_styles'
import { NOTES_BUTTON_ENABLED_STORAGE_KEY, NOTES_BUTTON_ID } from '@/lib/notes_button'
import { NMAPS_TOGGLE_NOTES_PANEL_EVENT } from '@/lib/notes_panel/events'
import { NSPD_BUTTON_ENABLED_STORAGE_KEY, NSPD_BUTTON_ID } from '@/lib/nspd/nspd_button'
import { POLYGON_UPLOAD_BUTTON_ID } from '@/lib/polygon_upload_button'
import { POLYGON_UPLOAD_POPUP_ID } from '@/lib/polygon_upload_popup'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

const mountNmapsToolbarAnchor = (): HTMLElement => {
  const parent = document.createElement('div')
  const anchor = document.createElement('span')
  anchor.className = 'nk-icon_id_ymaps'
  parent.appendChild(anchor)
  document.body.appendChild(parent)
  return anchor
}

describe('map-go-to.content', () => {
  let ctx: ReturnType<typeof createContentScriptContext>
  let runtimeListener: ((message: { action?: string }) => void) | undefined

  beforeEach(async () => {
    ctx = createContentScriptContext()
    runtimeListener = undefined

    await browser.storage.local.set({
      [GO_TO_MENU_ENABLED_STORAGE_KEY]: true,
      [GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]: false,
      [GO_TO_ITEMS_STORAGE_KEY]: [{ name: 'Nakarte', active: true }],
    })

    vi.spyOn(browser.runtime.onMessage, 'addListener').mockImplementation((listener) => {
      runtimeListener = listener as (message: { action?: string }) => void
    })
  })

  afterEach(() => {
    ctx.runInvalidated()
    document.body.replaceChildren()
    document.head.replaceChildren()
    vi.restoreAllMocks()
  })

  it('монтирует кнопку go-to при включённом меню', async () => {
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull())
  })

  it('оставляет кнопку загрузки при выключенных меню и split-view', async () => {
    await browser.storage.local.set({
      [GO_TO_MENU_ENABLED_STORAGE_KEY]: false,
      [GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]: false,
    })

    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => {
      expect(document.getElementById(POLYGON_UPLOAD_BUTTON_ID)).not.toBeNull()
      expect(document.getElementById(GO_TO_SPLIT_BUTTON_ID)).toBeNull()
    })
  })

  it('перемонтирует toolbar по runtime-сообщению refresh', async () => {
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull())

    document.getElementById(GO_TO_SERVICE_BUTTON_ID)?.remove()

    runtimeListener?.({ action: GO_TO_REFRESH_ACTION })

    await vi.waitFor(() => {
      expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull()
      expect(document.querySelectorAll(`#${POLYGON_UPLOAD_BUTTON_ID}`)).toHaveLength(1)
    })
  })

  it('монтирует split-view кнопку при включённой опции', async () => {
    await browser.storage.local.set({
      [GO_TO_MENU_ENABLED_STORAGE_KEY]: true,
      [GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]: true,
      [NOTES_BUTTON_ENABLED_STORAGE_KEY]: true,
      [NSPD_BUTTON_ENABLED_STORAGE_KEY]: true,
    })

    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => {
      expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull()
      expect(document.getElementById(GO_TO_SPLIT_BUTTON_ID)).not.toBeNull()
      const uploadButton = document.getElementById(POLYGON_UPLOAD_BUTTON_ID)
      expect(uploadButton).not.toBeNull()
      expect(uploadButton?.previousElementSibling?.id).toBe(GO_TO_SPLIT_BUTTON_ID)
      const notesButton = document.getElementById(NOTES_BUTTON_ID)
      expect(notesButton).not.toBeNull()
      expect(notesButton?.previousElementSibling?.id).toBe(POLYGON_UPLOAD_BUTTON_ID)
      const nspdButton = document.getElementById(NSPD_BUTTON_ID)
      expect(nspdButton).not.toBeNull()
      expect(nspdButton?.previousElementSibling?.id).toBe(NOTES_BUTTON_ID)
    })
  })

  it('по умолчанию монтирует кнопку NSPD', async () => {
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => {
      expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull()
    })

    await vi.waitFor(() => {
      expect(document.getElementById(NSPD_BUTTON_ID)).not.toBeNull()
    })
  })

  it('не монтирует кнопку NSPD, если её выключили в настройках', async () => {
    await browser.storage.local.set({ [NSPD_BUTTON_ENABLED_STORAGE_KEY]: false })
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => {
      expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull()
    })

    expect(document.getElementById(NSPD_BUTTON_ID)).toBeNull()
  })

  it('просит background открыть вкладку nspd.gov.ru по клику на кнопку NSPD', async () => {
    await browser.storage.local.set({
      [NSPD_BUTTON_ENABLED_STORAGE_KEY]: true,
    })
    const sendMessageSpy = vi
      .spyOn(browser.runtime, 'sendMessage')
      .mockResolvedValue(undefined as never)
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => expect(document.getElementById(NSPD_BUTTON_ID)).not.toBeNull())

    document.getElementById(NSPD_BUTTON_ID)?.click()
    await vi.waitFor(() =>
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: OPEN_NSPD_TARGET_ACTION }),
      ),
    )
    const message = sendMessageSpy.mock.calls[0]?.[0] as { url?: string }
    expect(message.url).toContain('nspd.gov.ru')
  })

  it('ставит кнопку заметок справа от загрузки и сигналит панели о переключении', async () => {
    await browser.storage.local.set({
      [NOTES_BUTTON_ENABLED_STORAGE_KEY]: true,
    })
    vi.spyOn(browser.runtime, 'getURL').mockReturnValue('about:blank')
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => expect(document.getElementById(NOTES_BUTTON_ID)).not.toBeNull())

    document.getElementById(POLYGON_UPLOAD_BUTTON_ID)?.click()
    expect(document.getElementById(POLYGON_UPLOAD_POPUP_ID)).not.toBeNull()

    const toggleListener = vi.fn()
    document.addEventListener(NMAPS_TOGGLE_NOTES_PANEL_EVENT, toggleListener)

    document.getElementById(NOTES_BUTTON_ID)?.click()
    expect(document.getElementById(POLYGON_UPLOAD_POPUP_ID)).toBeNull()
    expect(toggleListener).toHaveBeenCalledTimes(1)

    document.getElementById(NOTES_BUTTON_ID)?.click()
    expect(toggleListener).toHaveBeenCalledTimes(2)
    document.removeEventListener(NMAPS_TOGGLE_NOTES_PANEL_EVENT, toggleListener)
  })

  it('открывает и закрывает popup кнопкой загрузки', async () => {
    vi.spyOn(browser.runtime, 'getURL').mockReturnValue('about:blank')
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => expect(document.getElementById(POLYGON_UPLOAD_BUTTON_ID)).not.toBeNull())

    document.getElementById(POLYGON_UPLOAD_BUTTON_ID)?.click()
    expect(document.getElementById(POLYGON_UPLOAD_POPUP_ID)).not.toBeNull()

    document.getElementById(POLYGON_UPLOAD_BUTTON_ID)?.click()
    expect(document.getElementById(POLYGON_UPLOAD_POPUP_ID)).toBeNull()
  })

  it('не монтирует кнопку заметок при отключённой опции в хранилище', async () => {
    await browser.storage.local.set({
      [NOTES_BUTTON_ENABLED_STORAGE_KEY]: false,
    })

    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => {
      expect(document.getElementById(POLYGON_UPLOAD_BUTTON_ID)).not.toBeNull()
      expect(document.getElementById(NOTES_BUTTON_ID)).toBeNull()
    })
  })

  it('при первом запуске ставит кнопку заметок, но не split-view', async () => {
    await browser.storage.local.clear()
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => {
      expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull()
      expect(document.getElementById(POLYGON_UPLOAD_BUTTON_ID)).not.toBeNull()
      // Заметки включены по умолчанию: это единственный вход в панель.
      expect(document.getElementById(NOTES_BUTTON_ID)).not.toBeNull()
      expect(document.getElementById(GO_TO_SPLIT_BUTTON_ID)).toBeNull()
    })
  })

  it('открывает и закрывает Меню геосервисов кликом по кнопке и наполняет элементами', async () => {
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull())

    const serviceBtn = document.getElementById(GO_TO_SERVICE_BUTTON_ID)
    expect(serviceBtn?.getAttribute('aria-expanded')).toBe('false')

    // Клик для открытия
    serviceBtn?.click()

    const menu = document.getElementById(MENU_ID)
    await vi.waitFor(() => {
      expect(menu).not.toBeNull()
      expect(menu?.classList.contains(GO_TO_POPUP_VISIBLE_CLASS)).toBe(true)
      expect(serviceBtn?.getAttribute('aria-expanded')).toBe('true')
    })

    const linksItems = document.getElementById(MENU_ITEMS_ID)
    expect(linksItems?.children.length).toBeGreaterThan(0)
    expect(document.getElementById(`${GO_TO_MENU_ITEM_ID_PREFIX}Nakarte`)).not.toBeNull()

    // Повторный клик для закрытия
    serviceBtn?.click()
    expect(menu?.classList.contains(GO_TO_POPUP_VISIBLE_CLASS)).toBe(false)
    expect(serviceBtn?.getAttribute('aria-expanded')).toBe('false')
  })

  it('закрывает Меню геосервисов по Escape и клику снаружи', async () => {
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull())

    const serviceBtn = document.getElementById(GO_TO_SERVICE_BUTTON_ID)
    serviceBtn?.click()

    const menu = document.getElementById(MENU_ID)
    await vi.waitFor(() => {
      expect(menu?.classList.contains(GO_TO_POPUP_VISIBLE_CLASS)).toBe(true)
    })

    // Закрытие по Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(menu?.classList.contains(GO_TO_POPUP_VISIBLE_CLASS)).toBe(false)

    // Снова открываем
    serviceBtn?.click()
    await vi.waitFor(() => {
      expect(menu?.classList.contains(GO_TO_POPUP_VISIBLE_CLASS)).toBe(true)
    })

    // Закрытие по pointerdown вне меню и кнопки
    const outsideElement = document.createElement('div')
    document.body.appendChild(outsideElement)
    outsideElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(menu?.classList.contains(GO_TO_POPUP_VISIBLE_CLASS)).toBe(false)
  })

  it('сохраняет порядок пунктов меню после перетаскивания', async () => {
    await browser.storage.local.set({
      [GO_TO_MENU_ENABLED_STORAGE_KEY]: true,
      [GO_TO_ITEMS_STORAGE_KEY]: [
        { name: 'Google', active: true },
        { name: 'Bing', active: true },
        { name: 'Nakarte', active: true },
      ],
    })

    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull())
    document.getElementById(GO_TO_SERVICE_BUTTON_ID)?.click()

    await vi.waitFor(() => {
      expect(document.querySelectorAll(`#${MENU_ITEMS_ID} > *`)).toHaveLength(3)
    })

    const menuItems = document.getElementById(MENU_ITEMS_ID) as HTMLElement
    const rows = Array.from(menuItems.children) as HTMLElement[]
    rows.forEach((row, index) => {
      row.getBoundingClientRect = () =>
        ({
          top: index * 40,
          bottom: index * 40 + 40,
          height: 40,
          left: 0,
          right: 200,
          width: 200,
          x: 0,
          y: index * 40,
          toJSON: () => ({}),
        }) as DOMRect
    })

    rows[0]
      .querySelector<HTMLElement>('.yamapper-menu__grip')
      ?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 5, clientY: 10 }),
      )
    document.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 5, clientY: 100 }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 5, clientY: 100 }),
    )

    await vi.waitFor(async () => {
      const stored = (await browser.storage.local.get(GO_TO_ITEMS_STORAGE_KEY))[
        GO_TO_ITEMS_STORAGE_KEY
      ] as { name: string }[]
      expect(stored.slice(0, 3).map((item) => item.name)).toEqual(['Bing', 'Nakarte', 'Google'])
    })
  })
})
