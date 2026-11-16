import { useState } from 'react'
import { useLocale } from '@/hooks/useLocale'
import type { NoteKind } from '@/lib/notes/model/types'
import type { DrawableNoteKind } from '@/lib/notes/protocol'
import { NOTES_PANEL_CLOSE_MESSAGE, NOTES_PANEL_LAYOUT_MESSAGE } from '@/lib/notes_panel/host'
import { NOTES_PANEL_BUTTON_IDS } from './ids'
import { ShapePicker } from './ShapePicker'

export type PanelLayout = 'compact' | 'full'

const requestLayout = (layout: PanelLayout): void => {
  window.parent?.postMessage({ action: NOTES_PANEL_LAYOUT_MESSAGE, layout }, '*')
}

const requestClose = (): void => {
  window.parent?.postMessage({ action: NOTES_PANEL_CLOSE_MESSAGE }, '*')
}

/**
 * Шапка панели: поиск, создание группы, выбор фигуры, разворот и закрытие.
 *
 * Кнопки разворота и закрытия не меняют состояние панели сами — они просят об
 * этом хост через `postMessage`: размер iframe задаёт хост, а не страница.
 */
export const PanelHeader = ({
  mode,
  search,
  drawingKind,
  onCreateGroup,
  onStartDrawing,
  layout,
  onToggleLayout,
}: {
  mode: 'list' | 'properties'
  search: { value: string; onChange: (query: string) => void }
  drawingKind: NoteKind | null
  onCreateGroup: () => void
  onStartDrawing: (kind: DrawableNoteKind) => void
  layout: PanelLayout
  onToggleLayout: (next: PanelLayout) => void
}) => {
  const { t } = useLocale()
  const [shapeOpen, setShapeOpen] = useState(false)
  const isFull = layout === 'full'

  return (
    <header className="notes-panel__head">
      <h1 className="notes-panel__title">{t('notesPanel.title')}</h1>

      {mode === 'list' && (
        <input
          className="notes-panel__search"
          type="search"
          value={search.value}
          placeholder={t('notesPanel.searchPlaceholder')}
          aria-label={t('notesPanel.searchPlaceholder')}
          onChange={(event) => search.onChange(event.target.value)}
        />
      )}

      <div className="notes-panel__head-actions">
        {mode === 'list' && (
          <button
            type="button"
            id={NOTES_PANEL_BUTTON_IDS.createGroup}
            className="notes-panel__button"
            title={t('notesPanel.createGroup')}
            onClick={onCreateGroup}
          >
            + {t('notesPanel.createGroup')}
          </button>
        )}

        <div className="notes-panel__create">
          <button
            type="button"
            className="notes-panel__button notes-panel__button--primary"
            aria-expanded={shapeOpen}
            disabled={Boolean(drawingKind)}
            onClick={() => setShapeOpen((open) => !open)}
          >
            {t('notesPanel.create')}
          </button>
          {shapeOpen && (
            <ShapePicker
              busy={Boolean(drawingKind)}
              onCancel={() => setShapeOpen(false)}
              onPick={(kind) => {
                setShapeOpen(false)
                onStartDrawing(kind)
              }}
            />
          )}
        </div>

        <button
          type="button"
          className="notes-panel__icon-button"
          title={isFull ? t('notesPanel.collapse') : t('notesPanel.expand')}
          aria-label={isFull ? t('notesPanel.collapse') : t('notesPanel.expand')}
          onClick={() => {
            const next: PanelLayout = isFull ? 'compact' : 'full'
            onToggleLayout(next)
            requestLayout(next)
          }}
        >
          {isFull ? '⤡' : '⤢'}
        </button>

        <button
          type="button"
          className="notes-panel__icon-button"
          title={t('notesPanel.close')}
          aria-label={t('notesPanel.close')}
          onClick={requestClose}
        >
          ×
        </button>
      </div>
    </header>
  )
}
