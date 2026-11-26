/**
 * Перетаскивание строк списка вверх-вниз на Pointer Events.
 *
 * Механизм общий для меню геосервисов (vanilla DOM на странице редактора) и
 * списка в настройках (React): слушатели живут на `document`, а не на строке.
 * Строка при живой перестановке переезжает в DOM, и `setPointerCapture` на ней
 * отпустил бы указатель вместе со всеми дальнейшими событиями, поэтому захват
 * указателя здесь не используется.
 */

/** Порог в пикселях: меньше — это клик по пункту, а не перетаскивание. */
export const DRAG_START_THRESHOLD_PX = 4

/** Атрибут строки, которую сейчас перетаскивают. */
export const DRAG_ACTIVE_ATTRIBUTE = 'data-dragging'

export type DragSortRow = {
  /** Имя источника; по нему строка сопоставляется с элементом `go_to_items`. */
  key: string
  element: HTMLElement
}

export type DragSortOptions = {
  /** pointerdown, с которого начинается возможное перетаскивание. */
  event: PointerEvent
  /** Ключ перетаскиваемой строки. */
  key: string
  /** Текущий порядок строк — его меняет живая перестановка. */
  getRows: () => DragSortRow[]
  onReorder: (movedKey: string, targetKey: string) => void
  /** Вернуть исходный порядок: отпустили не там или нажали Esc. */
  onRestore?: () => void
  onMoveStart?: (key: string) => void
  /** `moved` — порядок действительно менялся. */
  onMoveEnd?: (key: string, moved: boolean) => void
  onCancel?: (key: string) => void
}

let dragMoved = false

/** Сбрасывает отметку «только что было перетаскивание» на новом нажатии. */
export const resetDragMoved = (): void => {
  dragMoved = false
}

/**
 * `true`, если перетаскивание только что закончилось. Клик по пункту меню
 * приходит сразу после `pointerup`; так он отличается от обычного клика.
 */
export const consumeDragMoved = (): boolean => {
  const moved = dragMoved
  dragMoved = false
  return moved
}

const findRowAtY = (rows: DragSortRow[], clientY: number): DragSortRow | null => {
  if (rows.length === 0) return null

  for (const row of rows) {
    const rect = row.element.getBoundingClientRect()
    if (clientY >= rect.top && clientY < rect.bottom) return row
  }

  // Указатель выше или ниже списка: цепляемся за крайнюю строку, иначе
  // перетаскивание останавливалось бы на границе без автопрокрутки.
  const first = rows[0]
  const last = rows[rows.length - 1]
  if (clientY < first.element.getBoundingClientRect().top) return first
  if (clientY >= last.element.getBoundingClientRect().bottom) return last
  return null
}

export const startDragSort = (options: DragSortOptions): void => {
  const { event, key } = options
  if (event.button !== 0) return

  const startX = event.clientX
  const startY = event.clientY
  let started = false
  let changed = false

  const detach = (): void => {
    document.removeEventListener('pointermove', handleMove)
    document.removeEventListener('pointerup', handleUp, true)
    document.removeEventListener('pointercancel', handleCancel, true)
    document.removeEventListener('keydown', handleKeyDown, true)
  }

  function handleMove(moveEvent: PointerEvent): void {
    if (!started) {
      const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY)
      if (distance < DRAG_START_THRESHOLD_PX) return
      started = true
      document.getSelection()?.removeAllRanges()
      options.onMoveStart?.(key)
    }

    // Убирает выделение текста и нативный перетаскиваемый образ.
    moveEvent.preventDefault()

    const target = findRowAtY(options.getRows(), moveEvent.clientY)
    if (target && target.key !== key) {
      options.onReorder(key, target.key)
      changed = true
    }
  }

  function handleUp(): void {
    detach()
    if (!started) return
    if (changed) dragMoved = true
    options.onMoveEnd?.(key, changed)
  }

  function handleCancel(): void {
    detach()
    if (!started) return
    options.onRestore?.()
    options.onCancel?.(key)
  }

  function handleKeyDown(keyEvent: KeyboardEvent): void {
    // Слушатель в фазе захвата: иначе Esc сначала закрыл бы меню, и отменять
    // перетаскивание было бы уже не в чем.
    if (keyEvent.key !== 'Escape' || !started) return
    keyEvent.preventDefault()
    keyEvent.stopPropagation()
    handleCancel()
  }

  document.addEventListener('pointermove', handleMove, { passive: false })
  document.addEventListener('pointerup', handleUp, true)
  document.addEventListener('pointercancel', handleCancel, true)
  document.addEventListener('keydown', handleKeyDown, true)
}

/**
 * Ставит строку на место целевой: при движении вниз — после неё, вверх — перед
 * ней. Совпадает с семантикой `moveGoToItemTo`.
 */
export const moveRowToRow = (
  rows: DragSortRow[],
  container: HTMLElement,
  movedKey: string,
  targetKey: string,
): boolean => {
  const movedIndex = rows.findIndex((row) => row.key === movedKey)
  const targetIndex = rows.findIndex((row) => row.key === targetKey)
  if (movedIndex < 0 || targetIndex < 0 || movedIndex === targetIndex) return false

  const moved = rows[movedIndex].element
  const target = rows[targetIndex].element
  if (movedIndex < targetIndex) {
    container.insertBefore(moved, target.nextSibling)
  } else {
    container.insertBefore(moved, target)
  }
  return true
}

/** Возвращает строкам исходный порядок ключей (отмена перетаскивания). */
export const restoreRowOrder = (
  rows: DragSortRow[],
  container: HTMLElement,
  initialKeys: readonly string[],
): void => {
  for (const key of initialKeys) {
    const row = rows.find((item) => item.key === key)
    if (row) container.appendChild(row.element)
  }
}
