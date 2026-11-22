// @vitest-environment happy-dom

/**
 * Панель подстраивает высоту под карточку свойств.
 *
 * Регрессия: «Редактировать» открывала карточку в четверть экрана, и нижние
 * блоки (границы, иконки) оставались под прокруткой.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePanelFitHeight } from '@/hooks/notes_panel/usePanelFitHeight'
import { NOTES_PANEL_FIT_HEIGHT_MESSAGE } from '@/lib/notes_panel/host'

const rect = (values: Partial<DOMRect>): DOMRect =>
  ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
    ...values,
  }) as DOMRect

/**
 * Разметка карточки в том же порядке, что и в панели: шапка панели, затем
 * прокручиваемая карточка с сеткой.
 */
const Harness = ({ mode, noteId }: { mode: 'list' | 'properties'; noteId: string | null }) => {
  usePanelFitHeight(mode, noteId)

  return (
    <div className="notes-panel">
      <header className="notes-panel__head" />
      <div className="notes-panel__body">
        {mode === 'properties' && (
          <div className="notes-panel__properties" style={{ paddingBottom: '32px' }}>
            <div className="notes-panel__properties-grid" />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Размеры в happy-dom пустые, поэтому задаются явно: шапка 52 px, карточка
 * начинается с 0, её сетка кончается на 459 px, снизу внутренний отступ 32 px.
 */
const stubLayout = (): void => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ): DOMRect {
    if (this.classList.contains('notes-panel__head')) return rect({ height: 52 })
    if (this.classList.contains('notes-panel__properties')) return rect({ top: 0 })
    if (this.classList.contains('notes-panel__properties-grid')) return rect({ bottom: 459 })
    return rect({})
  })
}

const postedHeights = (postMessage: ReturnType<typeof vi.spyOn>): unknown[] =>
  postMessage.mock.calls
    .filter(
      ([message]: unknown[]) =>
        (message as { action?: string }).action === NOTES_PANEL_FIT_HEIGHT_MESSAGE,
    )
    .map(([message]: unknown[]) => (message as { height: number | null }).height)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('высота панели под карточку свойств', () => {
  it('на списке возвращает пользовательскую высоту', () => {
    const postMessage = vi.spyOn(window, 'postMessage').mockImplementation(() => {})

    render(<Harness mode="list" noteId={null} />)

    expect(postedHeights(postMessage)).toEqual([null])
  })

  it('на свойствах просит высоту всех блоков и шапки', () => {
    const postMessage = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
    stubLayout()

    render(<Harness mode="properties" noteId="note-1" />)

    // 52 (шапка) + 459 (низ сетки) + 32 (отступ снизу).
    expect(postedHeights(postMessage)).toContain(543)
  })
})
