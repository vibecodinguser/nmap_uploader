// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GoToLinksSettings } from '@/components/GoToLinksSettings'
import { LocaleProvider } from '@/hooks/useLocale'
import type { GoToItem } from '@/lib/go_to_settings'

const ROW_HEIGHT = 40

const ITEMS: GoToItem[] = [
  { name: 'Google', active: true },
  { name: 'Bing', active: true },
  { name: 'Nakarte', active: false },
]

const noop = () => {}

const buildProps = () => ({
  isMenuEnabled: true,
  items: ITEMS,
  isLoaded: true,
  setIsMenuEnabled: noop,
  setItemActive: noop,
  moveItemBy: vi.fn(),
  reorderItems: vi.fn(),
})

const renderSettings = () => {
  const props = buildProps()
  render(<GoToLinksSettings {...props} />, { wrapper: LocaleProvider })
  fireEvent.click(screen.getByRole('button', { name: /Список/ }))
  return props
}

const rowElements = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-go-to-name]'))

const rowNames = (): string[] => rowElements().map((row) => row.dataset.goToName ?? '')

const stubRowRects = (): void => {
  rowElements().forEach((row, index) => {
    row.getBoundingClientRect = () =>
      ({
        top: index * ROW_HEIGHT,
        bottom: index * ROW_HEIGHT + ROW_HEIGHT,
        height: ROW_HEIGHT,
        left: 0,
        right: 260,
        width: 260,
        x: 0,
        y: index * ROW_HEIGHT,
        toJSON: () => ({}),
      }) as DOMRect
  })
}

const gripElements = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('.settings-go-to-drag-handle'))

describe('перетаскивание в списке геосервисов', () => {
  afterEach(() => {
    cleanup()
    document.body.replaceChildren()
  })

  it('переставляет строку за ручку и сохраняет порядок один раз — по отпусканию', () => {
    const props = renderSettings()
    stubRowRects()

    fireEvent.pointerDown(gripElements()[0], { button: 0, clientX: 5, clientY: 10 })
    fireEvent.pointerMove(document, { clientX: 5, clientY: 100 })

    // Пока указатель держит строку, она уже стоит на новом месте.
    expect(rowNames()).toEqual(['Bing', 'Nakarte', 'Google'])
    expect(props.reorderItems).not.toHaveBeenCalled()

    fireEvent.pointerUp(document, { clientX: 5, clientY: 100 })

    expect(props.reorderItems).toHaveBeenCalledTimes(1)
    expect(props.reorderItems.mock.calls[0][0].map((item: GoToItem) => item.name)).toEqual([
      'Bing',
      'Nakarte',
      'Google',
    ])
  })

  it('помечает перетаскиваемую строку, пока указатель её держит', () => {
    renderSettings()
    stubRowRects()

    fireEvent.pointerDown(gripElements()[0], { button: 0, clientX: 5, clientY: 10 })
    fireEvent.pointerMove(document, { clientX: 5, clientY: 100 })

    const dragging = document.querySelectorAll('[data-dragging="true"]')
    expect(dragging).toHaveLength(1)
    expect((dragging[0] as HTMLElement).dataset.goToName).toBe('Google')

    fireEvent.pointerUp(document, { clientX: 5, clientY: 100 })
    expect(document.querySelectorAll('[data-dragging="true"]')).toHaveLength(0)
  })

  it('Esc отменяет перетаскивание и не сохраняет порядок', () => {
    const props = renderSettings()
    stubRowRects()

    fireEvent.pointerDown(gripElements()[0], { button: 0, clientX: 5, clientY: 10 })
    fireEvent.pointerMove(document, { clientX: 5, clientY: 100 })
    expect(rowNames()).toEqual(['Bing', 'Nakarte', 'Google'])

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(rowNames()).toEqual(['Google', 'Bing', 'Nakarte'])
    expect(props.reorderItems).not.toHaveBeenCalled()
  })

  it('переставляет строку стрелками на ручке — клавиатурный путь', () => {
    const props = renderSettings()

    fireEvent.keyDown(gripElements()[0], { key: 'ArrowDown' })
    expect(props.moveItemBy).toHaveBeenCalledWith('Google', 1)

    fireEvent.keyDown(gripElements()[0], { key: 'ArrowUp' })
    expect(props.moveItemBy).toHaveBeenCalledWith('Google', -1)
  })

  it('не реагирует на посторонние клавиши на ручке', () => {
    const props = renderSettings()

    fireEvent.keyDown(gripElements()[0], { key: 'Enter' })

    expect(props.moveItemBy).not.toHaveBeenCalled()
  })

  it('ручка доступна с клавиатуры и подписана', () => {
    renderSettings()

    const grip = screen.getByRole('button', { name: 'Переставить Google: стрелки ↑ и ↓' })
    expect(grip.tagName).toBe('BUTTON')
    expect(grip.getAttribute('tabindex')).toBeNull()
  })
})
