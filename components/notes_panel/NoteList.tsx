import { useState } from 'react'
import { useNoteListKeyboard } from '@/hooks/notes_panel/useNoteListKeyboard'
import { useVirtualRows } from '@/hooks/notes_panel/useVirtualRows'
import { useLocale } from '@/hooks/useLocale'
import { type GroupVisibility, groupVisibility } from '@/lib/notes/model/grouping'
import type { Note, NoteGroup } from '@/lib/notes/model/types'
import { collapseKey, type NoteListRow } from '@/lib/notes/panel/rows'
import { GroupHeader } from './GroupHeader'
import { NoteRow } from './NoteRow'

export { noteRowIds } from './NoteRow'

/**
 * Список заметок с группами.
 *
 * Заметку перетаскивают в заголовок группы или обратно в «Без группы»:
 * перетаскивание — единственный способ переноса, отдельного выпадающего меню
 * нет намеренно, иначе список обрастает вторым способом делать то же самое.
 * Окно прокрутки считает `useVirtualRows`, здесь остаются строки и перенос.
 */
export const NoteList = ({
  notes,
  groups,
  collapsedGroupIds,
  hiddenIds,
  selectedId,
  checkedIds,
  onCheck,
  onSelect,
  onToggleHidden,
  onLocate,
  onDelete,
  onToggleGroup,
  onRenameGroup,
  onRecolorGroup,
  onRemoveGroup,
  onMoveNote,
  onToggleGroupVisibility,
}: {
  notes: readonly Note[]
  groups: readonly NoteGroup[]
  collapsedGroupIds: readonly string[]
  hiddenIds: readonly string[]
  selectedId: string | null
  /** Отмеченные заметки для массовых действий. */
  checkedIds: readonly string[]
  onCheck: (noteId: string, checked: boolean) => void
  onSelect: (noteId: string) => void
  onToggleHidden: (noteId: string) => void
  onLocate: (noteId: string) => void
  onDelete: (noteId: string) => void
  onToggleGroup: (groupId: string | null) => void
  onRenameGroup: (groupId: string, name: string) => void
  onRecolorGroup: (groupId: string, color: string) => void
  onRemoveGroup: (groupId: string) => void
  onMoveNote: (noteId: string, groupId: string | null) => void
  /** Скрыть или показать все объекты группы. */
  onToggleGroupVisibility: (noteIds: readonly string[], visibility: GroupVisibility) => void
}) => {
  const { t } = useLocale()
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null)
  const { viewportRef, items, height, onScroll, rows, positioned } = useVirtualRows({
    notes,
    groups,
    collapsedGroupIds,
  })

  /**
   * Курсор клавиатуры и прокрутка к нему.
   *
   * Строки считаются заново, а не берутся из окна виртуализации: цель может
   * быть за его пределами, и её надо сначала прокрутить в видимую область.
   */
  const keyboard = useNoteListKeyboard({
    rows,
    selectedId,
    onSelect,
    onToggleChecked: (noteId) => onCheck(noteId, !checkedIds.includes(noteId)),
    onScrollToId: (noteId) => {
      const element = viewportRef.current
      if (!element) return
      const target = positioned.find(
        (item) => item.row.type === 'note' && item.row.note.id === noteId,
      )
      if (!target) return
      element.scrollTop = Math.max(0, target.top - element.clientHeight / 2)
    },
  })

  if (notes.length === 0 && groups.length === 0) {
    return <div className="notes-panel__empty">{t('notesPanel.emptySearch')}</div>
  }

  /** Перенести перетаскиваемую заметку в группу (`null` — в корень). */
  const moveDraggedNote = (groupId: string | null): void => {
    if (!draggedNoteId) return
    onMoveNote(draggedNoteId, groupId)
    setDraggedNoteId(null)
  }

  const dropInto =
    (groupId: string | null) =>
    (event: React.DragEvent): void => {
      event.preventDefault()
      moveDraggedNote(groupId)
    }

  const renderRow = (row: NoteListRow): React.ReactNode => {
    if (row.type === 'group') {
      const groupCollapseKey = collapseKey(row.groupId)
      const visibility = groupVisibility(row.noteIds, hiddenIds)
      return (
        <GroupHeader
          key={`group-${row.groupId ?? 'none'}`}
          groupId={row.groupId}
          title={row.title}
          color={row.color}
          notesCount={row.notesCount}
          collapsed={collapsedGroupIds.includes(groupCollapseKey)}
          onToggle={() => onToggleGroup(row.groupId)}
          onRename={row.groupId ? (name) => onRenameGroup(row.groupId as string, name) : undefined}
          onRecolor={
            row.groupId ? (color) => onRecolorGroup(row.groupId as string, color) : undefined
          }
          onRemove={row.groupId ? () => onRemoveGroup(row.groupId as string) : undefined}
          onDropNote={moveDraggedNote}
          visibility={visibility}
          onToggleVisibility={() => onToggleGroupVisibility(row.noteIds, visibility)}
        />
      )
    }

    const note = row.note
    return (
      <NoteRow
        key={`note-${note.id}`}
        note={note}
        isHidden={hiddenIds.includes(note.id)}
        isSelected={note.id === selectedId}
        checked={checkedIds.includes(note.id)}
        active={keyboard.activeId === note.id}
        onCheck={(checked) => onCheck(note.id, checked)}
        onSelect={() => onSelect(note.id)}
        onToggleHidden={() => onToggleHidden(note.id)}
        onLocate={() => onLocate(note.id)}
        onDelete={() => onDelete(note.id)}
        onDragStart={(event) => {
          setDraggedNoteId(note.id)
          event.dataTransfer.setData('text/plain', note.id)
        }}
        onDragEnd={() => setDraggedNoteId(null)}
        onDrop={dropInto(note.groupId)}
      />
    )
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: контейнер принимает бросок, действия — в строках
    <section
      className="notes-panel__list"
      ref={viewportRef}
      onScroll={onScroll}
      onKeyDown={keyboard.onKeyDown}
      // Список получает фокус при переходе клавиатурой: без tabIndex стрелки
      // работали бы только когда фокус уже внутри.
      tabIndex={-1}
      aria-label={t('notesPanel.list')}
      onDragOver={(event) => event.preventDefault()}
      onDrop={dropInto(null)}
    >
      <div className="notes-panel__list-inner" style={{ height }}>
        {items.map(({ row, top, height: rowHeight }) => (
          <div
            key={row.type === 'group' ? `group-${row.groupId ?? 'none'}` : `note-${row.note.id}`}
            className="notes-panel__list-row"
            style={{ top, height: rowHeight }}
          >
            {renderRow(row)}
          </div>
        ))}
      </div>
    </section>
  )
}
