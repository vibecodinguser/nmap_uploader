import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '@/hooks/useLocale'
import type { Note } from '@/lib/notes/types'
import { NoteKindIcon } from './NoteKindIcon'

const ROW_HEIGHT = 56
const OVERSCAN = 6
const DEFAULT_VIEWPORT = 420

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
}: {
  notes: readonly Note[]
  hiddenIds: readonly string[]
  selectedId: string | null
  onSelect: (noteId: string) => void
  onToggleHidden: (noteId: string) => void
  onLocate: (noteId: string) => void
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
          return (
            <div
              key={note.id}
              className="notes-panel__row"
              data-selected={note.id === selectedId}
              data-hidden={isHidden}
              style={{ top: (start + index) * ROW_HEIGHT, height: ROW_HEIGHT }}
            >
              <button
                type="button"
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
                className="notes-panel__row-action"
                title={isHidden ? t('notesPanel.visible') : t('notesPanel.hidden')}
                aria-label={isHidden ? t('notesPanel.visible') : t('notesPanel.hidden')}
                aria-pressed={!isHidden}
                onClick={() => onToggleHidden(note.id)}
              >
                {isHidden ? '○' : '●'}
              </button>

              <button
                type="button"
                className="notes-panel__row-action"
                title={t('notesPanel.locate')}
                aria-label={t('notesPanel.locate')}
                onClick={() => onLocate(note.id)}
              >
                ◎
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
