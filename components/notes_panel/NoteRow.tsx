import { useLocale } from '@/hooks/useLocale'
import type { Note } from '@/lib/notes/model/types'
import { NOTES_PANEL_BUTTON_IDS, rowButtonId } from './ids'
import { NoteKindIcon } from './NoteKindIcon'
import { DeleteIcon, LocateIcon, VisibilityIcon } from './RowIcons'

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

/** Строка списка: вид, название, дата и три действия. */
export const NoteRow = ({
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
