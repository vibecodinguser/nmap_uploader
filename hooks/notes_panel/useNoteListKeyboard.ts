import { useCallback, useEffect, useState } from 'react'
import type { NoteListRow } from '@/lib/notes/panel/rows'

/**
 * Клавиатурная навигация по списку заметок.
 *
 * Список виртуализирован, поэтому «фокус» — это не DOM-фокус, а индекс в
 * полном наборе строк: часть строк в DOM отсутствует, и переходить по ним
 * стрелками можно только по данным.
 *
 * Правила намеренно простые и совпадают с привычными списками:
 * - стрелки вверх/вниз двигают курсор по строкам заметок (заголовки групп
 *   пропускаются: по ним нечего открывать);
 * - Enter открывает свойства;
 * - пробел отмечает заметку для массового действия;
 * - Home/End — первая и последняя заметка.
 *
 * События снимаются, если фокус внутри поля ввода: иначе стрелки в поле
 * названия двигали бы список вместо курсора.
 */
type NoteListKeyboardHandlers = {
  /** id заметки, к которой относится текущий курсор. */
  activeId: string | null
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
}

const isInsideInput = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

/** Заметки без заголовков групп: по ним ходит курсор. */
const noteIdsOf = (rows: readonly NoteListRow[]): string[] =>
  rows.flatMap((row) => (row.type === 'note' ? [row.note.id] : []))

export const useNoteListKeyboard = ({
  rows,
  selectedId,
  onSelect,
  onToggleChecked,
  onScrollToId,
}: {
  rows: readonly NoteListRow[]
  selectedId: string | null
  onSelect: (noteId: string) => void
  onToggleChecked: (noteId: string) => void
  /** Прокрутить список к строке: она могла выйти из окна виртуализации. */
  onScrollToId: (noteId: string) => void
}): NoteListKeyboardHandlers => {
  const [activeId, setActiveId] = useState<string | null>(null)

  // Выбор мышью переносит курсор: иначе стрелки начинали бы с начала списка.
  useEffect(() => {
    if (selectedId) setActiveId(selectedId)
  }, [selectedId])

  const move = useCallback(
    (delta: 1 | -1, edge?: 'start' | 'end') => {
      const noteIds = noteIdsOf(rows)
      if (noteIds.length === 0) return

      if (edge) {
        const target = edge === 'start' ? noteIds[0] : noteIds[noteIds.length - 1]
        setActiveId(target)
        onScrollToId(target)
        return
      }

      const currentIndex = activeId ? noteIds.indexOf(activeId) : -1
      const nextIndex = currentIndex === -1 ? 0 : currentIndex + delta
      if (nextIndex < 0 || nextIndex >= noteIds.length) return

      const target = noteIds[nextIndex]
      setActiveId(target)
      onScrollToId(target)
    },
    [activeId, onScrollToId, rows],
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isInsideInput(event.target)) return

      // Без курсора любая из навигационных клавиш начинает счёт с начала
      // списка: иначе первое нажатие стрелки выглядело бы как «ничего не
      // произошло» — самый частый повод решить, что клавиатура не работает.
      const isNavigation =
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Home' ||
        event.key === 'End'
      if (!activeId && !isNavigation) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          move(1)
          break
        case 'ArrowUp':
          event.preventDefault()
          move(-1)
          break
        case 'Home':
          event.preventDefault()
          move(1, 'start')
          break
        case 'End':
          event.preventDefault()
          move(-1, 'end')
          break
        case 'Enter':
          if (!activeId) return
          event.preventDefault()
          onSelect(activeId)
          break
        case ' ':
          if (!activeId) return
          event.preventDefault()
          onToggleChecked(activeId)
          break
        default:
          break
      }
    },
    [activeId, move, onSelect, onToggleChecked],
  )

  return { activeId, onKeyDown }
}
