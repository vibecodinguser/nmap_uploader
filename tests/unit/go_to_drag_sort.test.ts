// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  consumeDragMoved,
  type DragSortOptions,
  type DragSortRow,
  moveRowToRow,
  resetDragMoved,
  restoreRowOrder,
  startDragSort,
} from '@/lib/go_to/drag_sort'

const ROW_HEIGHT = 40

const buildRow = (key: string, index: number): DragSortRow => {
  const element = document.createElement('div')
  element.textContent = key
  document.body.appendChild(element)
  element.getBoundingClientRect = () =>
    ({
      top: index * ROW_HEIGHT,
      bottom: index * ROW_HEIGHT + ROW_HEIGHT,
      height: ROW_HEIGHT,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: index * ROW_HEIGHT,
      toJSON: () => ({}),
    }) as DOMRect
  return { key, element }
}

const container = (): HTMLElement => document.body

const pointer = (type: string, init: PointerEventInit = {}): PointerEvent =>
  new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })

const startSession = (
  rows: DragSortRow[],
  overrides: Partial<DragSortOptions> = {},
): DragSortOptions => {
  const options: DragSortOptions = {
    event: pointer('pointerdown', { clientY: 10, clientX: 5 }),
    key: rows[0].key,
    getRows: () => rows,
    onReorder: (movedKey, targetKey) => {
      moveRowToRow(rows, container(), movedKey, targetKey)
    },
    ...overrides,
  }
  startDragSort(options)
  return options
}

const rowKeys = (): string[] =>
  Array.from(container().children).map((element) => element.textContent ?? '')

describe('startDragSort', () => {
  afterEach(() => {
    // Обрываем сессию, если тест не дошёл до pointerup: иначе слушатели на
    // document переживут очистку body и вмешаются в следующий тест.
    document.dispatchEvent(pointer('pointercancel'))
    document.dispatchEvent(pointer('pointerup'))
    document.body.replaceChildren()
    resetDragMoved()
  })

  it('не начинает перетаскивание, пока указатель не сдвинулся на порог', () => {
    const rows = [buildRow('A', 0), buildRow('B', 1), buildRow('C', 2)]
    const onMoveStart = vi.fn()
    const onReorder = vi.fn()
    startSession(rows, { onMoveStart, onReorder })

    document.dispatchEvent(pointer('pointermove', { clientY: 11, clientX: 5 }))

    expect(onMoveStart).not.toHaveBeenCalled()
    expect(onReorder).not.toHaveBeenCalled()

    document.dispatchEvent(pointer('pointerup'))

    expect(consumeDragMoved()).toBe(false)
  })

  it('переставляет строку после порога и запоминает, что это был drag', () => {
    const rows = [buildRow('A', 0), buildRow('B', 1), buildRow('C', 2)]
    const onMoveStart = vi.fn()
    startSession(rows, { onMoveStart })

    document.dispatchEvent(pointer('pointermove', { clientY: 100, clientX: 5 }))

    expect(onMoveStart).toHaveBeenCalledWith('A')
    expect(rowKeys()).toEqual(['B', 'C', 'A'])
    expect(rows[0].element.getAttribute('data-dragging')).toBeNull()

    document.dispatchEvent(pointer('pointerup'))

    expect(consumeDragMoved()).toBe(true)
    // Отметка одноразовая: следующий клик — обычный.
    expect(consumeDragMoved()).toBe(false)
  })

  it('переставляет вверх при движении указателя к началу', () => {
    const rows = [buildRow('A', 0), buildRow('B', 1), buildRow('C', 2)]
    startSession(rows, { key: 'C', event: pointer('pointerdown', { clientY: 90, clientX: 5 }) })

    document.dispatchEvent(pointer('pointermove', { clientY: 10, clientX: 5 }))

    expect(rowKeys()).toEqual(['C', 'A', 'B'])
  })

  it('отпускание вне списка возвращает исходный порядок и не считается drop', () => {
    const rows = [buildRow('A', 0), buildRow('B', 1)]
    const onRestore = vi.fn()
    const onMoveEnd = vi.fn()
    startSession(rows, {
      onRestore,
      onMoveEnd,
      onReorder: (movedKey, targetKey) => {
        moveRowToRow(rows, container(), movedKey, targetKey)
      },
    })

    document.dispatchEvent(pointer('pointermove', { clientY: 60, clientX: 5 }))
    document.dispatchEvent(pointer('pointercancel'))

    expect(onRestore).toHaveBeenCalledTimes(1)
    expect(onMoveEnd).not.toHaveBeenCalled()
    expect(consumeDragMoved()).toBe(false)
  })

  it('Esc во время drag отменяет перестановку и не доходит до escape-обработчика меню', () => {
    const rows = [buildRow('A', 0), buildRow('B', 1), buildRow('C', 2)]
    const initialKeys = rows.map((row) => row.key)
    const onRestore = vi.fn(() => restoreRowOrder(rows, container(), initialKeys))
    const onCancel = vi.fn()
    const menuEscape = vi.fn()
    document.addEventListener('keydown', menuEscape)

    startSession(rows, { onRestore, onCancel })
    document.dispatchEvent(pointer('pointermove', { clientY: 100, clientX: 5 }))
    expect(rowKeys()).toEqual(['B', 'C', 'A'])

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(rowKeys()).toEqual(['A', 'B', 'C'])
    expect(onRestore).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledWith('A')
    expect(menuEscape).not.toHaveBeenCalled()
    expect(consumeDragMoved()).toBe(false)

    document.removeEventListener('keydown', menuEscape)
  })

  it('Esc без начатого перетаскивания не перехватывается', () => {
    const rows = [buildRow('A', 0), buildRow('B', 1)]
    const menuEscape = vi.fn()
    document.addEventListener('keydown', menuEscape)
    startSession(rows)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(menuEscape).toHaveBeenCalledTimes(1)
    document.removeEventListener('keydown', menuEscape)
  })
})
