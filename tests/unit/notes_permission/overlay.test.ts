// @vitest-environment happy-dom

/**
 * Оверлей разрешений над кнопкой заметок.
 *
 * Он существует только затем, чтобы клик по нативной кнопке попал в страницу
 * расширения и дал жест для `permissions.request` (ADR 0022, поправка).
 * Проверяем три состояния: разрешений нет — оверлей есть; выдали — снимается
 * и открывает панель; отозвали — возвращается без перезагрузки.
 */
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { GO_TO_BUTTON_HOVERED_CLASS } from '@/lib/go_to_styles'
import {
  destroyNotesPermissionOverlay,
  syncNotesPermissionOverlay,
} from '@/lib/notes_permission/overlay'
import {
  NOTES_PERMISSION_CLICKED_MESSAGE,
  NOTES_PERMISSION_DENIED_MESSAGE,
  NOTES_PERMISSION_GRANTED_MESSAGE,
  NOTES_PERMISSION_HOVER_MESSAGE,
  NOTES_PERMISSION_OVERLAY_ID,
  NOTES_PERMISSION_READY_MESSAGE,
  YANDEX_PERMISSIONS_CHANGED_ACTION,
} from '@/lib/notes_permission/protocol'
import { getURL } from '@/tests/setup/browser_mock'

const getOverlay = (): HTMLIFrameElement | null =>
  document.getElementById(NOTES_PERMISSION_OVERLAY_ID) as HTMLIFrameElement | null

const createButton = (): HTMLButtonElement => {
  const button = document.createElement('button')
  button.id = 'nmapUploaderNotesButton'
  document.body.appendChild(button)
  return button
}

const emitFromOverlay = (data: Record<string, unknown>): void => {
  const frame = getOverlay()
  window.dispatchEvent(
    new MessageEvent('message', {
      data,
      source: frame?.contentWindow ?? null,
    }),
  )
}

describe('оверлей разрешений кнопки заметок', () => {
  let onResolved: Mock<() => void>
  let runtimeListeners: ((message: Record<string, unknown>) => void)[]

  beforeEach(() => {
    onResolved = vi.fn()
    runtimeListeners = []
    getURL.mockReturnValue('about:blank')
    vi.spyOn(browser.runtime.onMessage, 'addListener').mockImplementation((listener) => {
      runtimeListeners.push(listener as unknown as (message: Record<string, unknown>) => void)
    })
  })

  afterEach(() => {
    destroyNotesPermissionOverlay()
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('не появляется, когда разрешения уже выданы', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ granted: true } as never)
    syncNotesPermissionOverlay(createButton(), { getLabel: () => 'Заметки', onResolved })

    await vi.waitFor(() => expect(browser.runtime.sendMessage).toHaveBeenCalled())
    expect(getOverlay()).toBeNull()
  })

  it('появляется над кнопкой, пока разрешений нет', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ granted: false } as never)
    syncNotesPermissionOverlay(createButton(), { getLabel: () => 'Заметки', onResolved })

    await vi.waitFor(() => expect(getOverlay()).not.toBeNull())
    expect(getOverlay()?.src).toBe('about:blank')
    // Полная прозрачность: снаружи это невидимый приёмник клика, а не элемент,
    // который браузер отрисует по-своему.
    expect(getOverlay()?.style.opacity).toBe('0')
  })

  it('снимается, если страница оверлея так и не загрузилась', async () => {
    vi.useFakeTimers()
    try {
      vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ granted: false } as never)
      syncNotesPermissionOverlay(createButton(), { getLabel: () => 'Заметки', onResolved })

      await vi.waitFor(() => expect(getOverlay()).not.toBeNull())
      // Без подтверждения готовности невидимый iframe превратился бы в мёртвую
      // зону над кнопкой: клик не дошёл бы ни до страницы, ни до кнопки.
      vi.advanceTimersByTime(5000)

      expect(getOverlay()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('остаётся, когда страница оверлея подтвердила готовность', async () => {
    vi.useFakeTimers()
    try {
      vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ granted: false } as never)
      syncNotesPermissionOverlay(createButton(), { getLabel: () => 'Заметки', onResolved })
      await vi.waitFor(() => expect(getOverlay()).not.toBeNull())

      emitFromOverlay({ action: NOTES_PERMISSION_READY_MESSAGE })
      vi.advanceTimersByTime(10_000)

      expect(getOverlay()).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('после выдачи разрешений снимается и просит открыть панель', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ granted: false } as never)
    syncNotesPermissionOverlay(createButton(), { getLabel: () => 'Заметки', onResolved })
    await vi.waitFor(() => expect(getOverlay()).not.toBeNull())

    emitFromOverlay({ action: NOTES_PERMISSION_CLICKED_MESSAGE })
    emitFromOverlay({ action: NOTES_PERMISSION_GRANTED_MESSAGE })

    expect(getOverlay()).toBeNull()
    expect(onResolved).toHaveBeenCalledTimes(1)
  })

  it('выдача в настройках снимает оверлей, но панель не открывает', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ granted: false } as never)
    syncNotesPermissionOverlay(createButton(), { getLabel: () => 'Заметки', onResolved })
    await vi.waitFor(() => expect(getOverlay()).not.toBeNull())

    for (const listener of runtimeListeners) {
      listener({ action: YANDEX_PERMISSIONS_CHANGED_ACTION, granted: true })
    }

    expect(getOverlay()).toBeNull()
    expect(onResolved).not.toHaveBeenCalled()
  })

  it('после отказа снимается, но остаётся на следующий клик', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ granted: false } as never)
    const button = createButton()
    syncNotesPermissionOverlay(button, { getLabel: () => 'Заметки', onResolved })
    await vi.waitFor(() => expect(getOverlay()).not.toBeNull())

    emitFromOverlay({ action: NOTES_PERMISSION_DENIED_MESSAGE })
    expect(getOverlay()).toBeNull()
    expect(onResolved).toHaveBeenCalledTimes(1)

    syncNotesPermissionOverlay(button, { getLabel: () => 'Заметки', onResolved })
    await vi.waitFor(() => expect(getOverlay()).not.toBeNull())
  })

  it('подсвечивает нативную кнопку, пока курсор над оверлеем', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ granted: false } as never)
    const button = createButton()
    syncNotesPermissionOverlay(button, { getLabel: () => 'Заметки', onResolved })
    await vi.waitFor(() => expect(getOverlay()).not.toBeNull())

    emitFromOverlay({ action: NOTES_PERMISSION_HOVER_MESSAGE, hovered: true })
    expect(button.classList.contains(GO_TO_BUTTON_HOVERED_CLASS)).toBe(true)

    emitFromOverlay({ action: NOTES_PERMISSION_HOVER_MESSAGE, hovered: false })
    expect(button.classList.contains(GO_TO_BUTTON_HOVERED_CLASS)).toBe(false)
  })

  it('возвращается, когда доступ отозвали в настройках браузера', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ granted: true } as never)
    syncNotesPermissionOverlay(createButton(), { getLabel: () => 'Заметки', onResolved })
    await vi.waitFor(() => expect(browser.runtime.sendMessage).toHaveBeenCalled())
    expect(getOverlay()).toBeNull()

    for (const listener of runtimeListeners) {
      listener({ action: YANDEX_PERMISSIONS_CHANGED_ACTION, granted: false })
    }

    await vi.waitFor(() => expect(getOverlay()).not.toBeNull())
  })
})
