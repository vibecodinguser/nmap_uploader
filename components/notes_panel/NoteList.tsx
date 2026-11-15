import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '@/hooks/useLocale'
import type { Note } from '@/lib/notes/types'
import { NoteKindIcon } from './NoteKindIcon'
import { DeleteIcon, LocateIcon, VisibilityIcon } from './RowIcons'

const ROW_HEIGHT = 56
const OVERSCAN = 6
const DEFAULT_VIEWPORT = 420

/**
 * Идентификаторы строки и её кнопок.
 *
 * У виртуализированного списка нельзя опереться на порядок узлов, а классы
 * повторяются у всех строк — идентификаторы дают устойчивую цель для ручной
 * проверки в инспекторе и для автотестов.
 */
export const noteRowIds = (noteId: string) => ({
  row: `nmap-notes-row-${noteId}`,
  main: `nmap-notes-row-${noteId}-main`,
  // Действия названы по смыслу, а не по виду иконки: «спрятать/показать» —
  // одно действие, поэтому `visible`, а не `hide`.
  visibility: `notes-panel_btn_visible_${noteId}`,
  locate: `notes-panel_btn_find_${noteId}`,
  delete: `notes-panel_btn_delete_${noteId}`,
})

/**
 * Список заметок.
 *
 * Строки виртуализированы: в блокноте тысячи объектов, и рендерить их все
 * разом — значит гарантированно уронить ввод в поиск.
 */
export const NoteList = ({
  notes,
  hiddenIds,
  selectedId,
  onSelect,
  onToggleHidden,
  onLocate,
  onDelete,
}: {
  notes: readonly Note[]
  hiddenIds: readonly string[]
  selectedId: string | null
  onSelect: (noteId: string) => void
  onToggleHidden: (noteId: string) => void
  onLocate: (noteId: string) => void
  onDelete: (noteId: string) => void
}) => {
  const { t } = useLocale()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT)
  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return

    const update = () => setViewportHeight(element.clientHeight || DEFAULT_VIEWPORT)
    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  if (notes.length === 0) {
    return <div className="notes-panel__empty">{t('notesPanel.emptySearch')}</div>
  }

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(
    notes.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
  )
  const visible = notes.slice(start, end)

  return (
    <div
      className="notes-panel__list"
      ref={viewportRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div className="notes-panel__list-inner" style={{ height: notes.length * ROW_HEIGHT }}>
        {visible.map((note, index) => {
          const isHidden = hidden.has(note.id)
          const ids = noteRowIds(note.id)
          return (
            <div
              key={note.id}
              id={ids.row}
              className="notes-panel__row"
              data-note-id={note.id}
              data-note-kind={note.kind}
              data-selected={note.id === selectedId}
              data-hidden={isHidden}
              style={{ top: (start + index) * ROW_HEIGHT, height: ROW_HEIGHT }}
            >
              <button
                type="button"
                id={ids.main}
                className="notes-panel__row-main"
                onClick={() => onSelect(note.id)}
              >
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
                onClick={() => onToggleHidden(note.id)}
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
                onClick={() => onLocate(note.id)}
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
                onClick={() => onDelete(note.id)}
              >
                <DeleteIcon />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
