// @vitest-environment happy-dom

/**
 * Протяжка ручки панели.
 *
 * Регрессия: из полноэкранного режима панель не сворачивалась. Причина —
 * протяжка вниз уводит курсор на iframe, а это отдельный документ: без захвата
 * указателя `pointermove` в родительское окно не приходит.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createNotesPanelHost,
  NOTES_PANEL_FRAME_ID,
  NOTES_PANEL_HANDLE_ID,
  NOTES_PANEL_HOST_ID,
  NOTES_PANEL_LAYOUT_MESSAGE,
  removeNotesPanelStyles,
} from '@/lib/notes_panel/host'
import { getURL } from '@/tests/setup/browser_mock'

/** Панель получает «развернуть» сообщением из iframe — так же, как в жизни. */
const requestLayout = (layout: 'compact' | 'full'): void => {
  const frame = document.getElementById(NOTES_PANEL_FRAME_ID) as HTMLIFrameElement | null
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { action: NOTES_PANEL_LAYOUT_MESSAGE, layout },
      source: frame?.contentWindow ?? null,
    }),
  )
}

const handle = (): HTMLElement => {
  const element = document.getElementById(NOTES_PANEL_HANDLE_ID)
  if (!element) throw new Error('ручка не найдена')
  return element
}

const panel = (): HTMLElement => {
  const element = document.getElementById(NOTES_PANEL_HOST_ID)
  if (!element) throw new Error('панель не найдена')
  return element
}

const heightOf = (): number => Number.parseInt(panel().style.height, 10)

const drag = (fromY: number, toY: number): void => {
  handle().dispatchEvent(
    new PointerEvent('pointerdown', { pointerId: 1, clientY: fromY, bubbles: true }),
  )
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: toY }))
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: toY }))
}

beforeEach(() => {
  getURL.mockReturnValue('about:blank')
  window.innerHeight = 1000
})

afterEach(() => {
  document.body.innerHTML = ''
  removeNotesPanelStyles()
})

describe('ручка панели заметок', () => {
  it('из полноэкранного режима сворачивается протяжкой вниз', () => {
    const host = createNotesPanelHost()
    host.open()
    requestLayout('full')

    expect(panel().dataset.layout).toBe('full')
    expect(panel().style.height).toBe('100vh')

    drag(10, 700)

    expect(panel().dataset.layout).toBe('compact')
    expect(heightOf()).toBeLessThan(1000)
    expect(heightOf()).toBeGreaterThanOrEqual(250)
  })

  it('помечает протяжку, пока указатель не отпущен', () => {
    const host = createNotesPanelHost()
    host.open()

    handle().dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientY: 500 }))
    // По этому признаку CSS отключает приём событий у iframe.
    expect(panel().dataset.dragging).toBe('true')

    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: 500 }))
    expect(panel().dataset.dragging).toBeUndefined()
  })

  it('pointercancel завершает протяжку, а не оставляет её висеть', () => {
    const host = createNotesPanelHost()
    host.open()
    requestLayout('full')

    handle().dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientY: 10 }))
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }))

    expect(panel().dataset.dragging).toBeUndefined()
    expect(panel().dataset.layout).toBe('compact')
  })

  it('не даёт свернуть панель ниже четверти экрана', () => {
    const host = createNotesPanelHost()
    host.open()

    drag(100, 990)

    expect(heightOf()).toBe(250)
  })

  it('меняет высоту ровно на величину протяжки', () => {
    const host = createNotesPanelHost()
    host.open()

    drag(600, 200)
    const afterFirst = heightOf()

    drag(300, 200)
    const afterSecond = heightOf()

    expect(afterSecond - afterFirst).toBe(100)
  })
})
