import { useState } from 'react'
import { useLocale } from '@/hooks/useLocale'
import type { DrawableNoteKind } from '@/lib/notes/protocol'
import { NOTES_PANEL_BUTTON_IDS } from './ids'
import { ShapePicker } from './ShapePicker'

/**
 * Создание: заметка (с выбором фигуры) и группа.
 *
 * Стоят в начале строки инструментов, а не в шапке: рядом с кнопками
 * «развернуть» и «закрыть» они читались как управление окном.
 */
export const CreateActions = ({
  drawing,
  onCreateGroup,
  onStartDrawing,
}: {
  /** Идёт рисование: новую фигуру начать нельзя, пока не закончена текущая. */
  drawing: boolean
  onCreateGroup: () => void
  onStartDrawing: (kind: DrawableNoteKind) => void
}) => {
  const { t } = useLocale()
  const [shapeOpen, setShapeOpen] = useState(false)

  return (
    <div className="notes-panel__create-actions">
      <div className="notes-panel__create">
        <button
          type="button"
          className="notes-panel__button notes-panel__button--primary"
          aria-haspopup="menu"
          aria-expanded={shapeOpen}
          disabled={drawing}
          onClick={() => setShapeOpen((open) => !open)}
        >
          + {t('notesPanel.createNote')}
          <span className="notes-panel__button-tick" aria-hidden="true" />
        </button>
        {shapeOpen && (
          <ShapePicker
            busy={drawing}
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
        id={NOTES_PANEL_BUTTON_IDS.createGroup}
        className="notes-panel__button"
        onClick={onCreateGroup}
      >
        + {t('notesPanel.createGroup')}
      </button>
    </div>
  )
}
