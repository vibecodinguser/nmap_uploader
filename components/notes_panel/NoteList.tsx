import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '@/hooks/useLocale'
import {
  buildListRows,
  collapseKey,
  type GroupVisibility,
  groupVisibility,
  type NoteListRow,
  positionRows,
  totalHeight,
  visibleSlice,
} from '@/lib/notes/model/grouping'
import type { Note, NoteGroup } from '@/lib/notes/model/types'
import { GroupHeader } from './GroupHeader'
import { NOTES_PANEL_BUTTON_IDS, rowButtonId } from './ids'
import { NoteKindIcon } from './NoteKindIcon'
import { DeleteIcon, LocateIcon, VisibilityIcon } from './RowIcons'

const DEFAULT_VIEWPORT = 420

/**
 * Идентификаторы строки и её кнопок.
 *
 * У виртуализированного списка нельзя опереться на порядок узлов, а классы
 * повторяются у всех строк — идентификаторы дают устойчивую цель для ручной
 * проверки в инспекторе и для автотестов.
 */
export const noteRowIds = (noteId: string) => ({
  row: `nmapUploaderNotesRow-${noteId}`,
  main: `nmapUploaderNotesRow-${noteId}-main`,
  // Действия названы по смыслу, а не по виду иконки: «спрятать/показать» —
  // одно действие, поэтому `visible`, а не `hide`.
  visibility: rowButtonId(NOTES_PANEL_BUTTON_IDS.visible, noteId),
  locate: rowButtonId(NOTES_PANEL_BUTTON_IDS.find, noteId),
  delete: rowButtonId(NOTES_PANEL_BUTTON_IDS.delete, noteId),
})

const NoteRowView = ({
  note,
  isHidden,
  isSelected,
  onSelect,
  onToggleHidden,
  onLocate,
  onDelete,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  note: Note
  isHidden: boolean
  isSelected: boolean
  onSelect: () => void
  onToggleHidden: () => void
  onLocate: () => void
  onDelete: () => void
  onDragStart: (event: React.DragEvent) => void
  onDragEnd: () => void
  onDrop: (event: React.DragEvent) => void
}) => {
  const { t } = useLocale()
  const ids = noteRowIds(note.id)

  return (
    // HTML5 drag&drop работает только с указателем и не имеет клавиатурного
    // аналога по спецификации; перенос заметки — не единственный способ
    // изменить группу, её можно сменить и через свойства заметки.
    // biome-ignore lint/a11y/noStaticElementInteractions: drag&drop без клавиатурного аналога
    <div
      id={ids.row}
      className="notes-panel__row"
      data-note-id={note.id}
      data-note-kind={note.kind}
      data-selected={isSelected}
      data-hidden={isHidden}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onDrop={(event) => {
        // Та же причина, что и у заголовка группы: бросок на строку не должен
        // доходить до контейнера, который переносит в корень.
        event.preventDefault()
        event.stopPropagation()
        onDrop(event)
      }}
    >
      <button type="button" id={ids.main} className="notes-panel__row-main" onClick={onSelect}>
        <span className="notes-panel__row-icon" aria-hidden="true">
          <NoteKindIcon kind={note.kind} />
        </span>
        <span className="notes-panel__row-text">
          <span className="notes-panel__row-name">{note.name}</span>
          <span className="notes-panel__row-meta">{note.date}</span>
        </span>
      </button>

      <button
        type="button"
        id={ids.visibility}
        data-action="visible"
        className="notes-panel__row-action"
        title={isHidden ? t('notesPanel.visible') : t('notesPanel.hidden')}
        aria-label={isHidden ? t('notesPanel.visible') : t('notesPanel.hidden')}
        aria-pressed={!isHidden}
        onClick={onToggleHidden}
      >
        <VisibilityIcon hidden={isHidden} />
      </button>

      <button
        type="button"
        id={ids.locate}
        data-action="find"
        className="notes-panel__row-action"
        title={t('notesPanel.locate')}
        aria-label={t('notesPanel.locate')}
        onClick={onLocate}
      >
        <LocateIcon />
      </button>

      <button
        type="button"
        id={ids.delete}
        data-action="delete"
        className="notes-panel__row-action notes-panel__row-action--danger"
        title={t('notesPanel.delete')}
        aria-label={t('notesPanel.delete')}
        onClick={onDelete}
      >
        <DeleteIcon />
      </button>
    </div>
  )
}

/**
 * Список заметок с группами.
 *
 * Строки виртуализированы: заметок тысячи, а заголовки групп добавляют ещё
 * строки. Высота строк разная (заголовок ниже строки заметки), поэтому окно
 * прокрутки считается по накопленным смещениям, а не по индексу.
 *
 * Заметку перетаскивают в заголовок группы или обратно в «Без группы»:
 * перетаскивание — единственный способ переноса, отдельного выпадающего меню
 * нет намеренно, иначе список обрастает вторым способом делать то же самое.
 */
export const NoteList = ({
  notes,
  groups,
  collapsedGroupIds,
  hiddenIds,
  selectedId,
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
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT)
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null)
  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds])

  const rows = useMemo(
    () =>
      buildListRows({
        notes,
        groups,
        collapsedGroupIds,
        ungroupedTitle: t('notesPanel.ungrouped'),
      }),
    [notes, groups, collapsedGroupIds, t],
  )
  const positioned = useMemo(() => positionRows(rows), [rows])
  const height = useMemo(() => totalHeight(rows), [rows])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return

    const update = () => setViewportHeight(element.clientHeight || DEFAULT_VIEWPORT)
    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // При смене фильтра или сворачивании список может стать короче — тогда
  // прокрутка за пределами контента оставила бы пустой экран.
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    if (element.scrollTop > height) {
      element.scrollTop = 0
      setScrollTop(0)
    }
  }, [height])

  const { items } = visibleSlice(positioned, scrollTop, viewportHeight)

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
          visibility={groupVisibility(row.noteIds, hiddenIds)}
          onToggleVisibility={() =>
            onToggleGroupVisibility(row.noteIds, groupVisibility(row.noteIds, hiddenIds))
          }
        />
      )
    }

    const note = row.note
    return (
      <NoteRowView
        key={`note-${note.id}`}
        note={note}
        isHidden={hidden.has(note.id)}
        isSelected={note.id === selectedId}
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
    <div
      className="notes-panel__list"
      ref={viewportRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
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
    </div>
  )
}
