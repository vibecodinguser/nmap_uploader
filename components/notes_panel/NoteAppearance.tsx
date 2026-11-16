import { useLocale } from '@/hooks/useLocale'
import {
  DEFAULT_HATCH,
  NOTE_OPACITY_MAX,
  NOTE_OPACITY_MIN,
  NOTE_STROKE_WIDTH_MAX,
  NOTE_STROKE_WIDTH_MIN,
} from '@/lib/notes/model/palette'
import { resolveNoteStyle } from '@/lib/notes/model/style_resolution'
import { isFilledKind, type Note } from '@/lib/notes/model/types'
import { ColorPicker } from './ColorPicker'
import { HatchPicker } from './HatchPicker'

/**
 * Оформление заметки: цвет, заливка, штриховка, прозрачность, граница, подпись.
 *
 * Отдельных цветов у заливки и штриховки нет — обе рисуются цветом объекта.
 * Поэтому в `fillColor` хранится тот же цвет: по нему видно, включена ли
 * заливка, а сам цвет меняется вместе с общим.
 */
export const NoteAppearance = ({
  note,
  onPatch,
}: {
  note: Note
  onPatch: (patch: Partial<Note>) => void
}) => {
  const { t } = useLocale()
  const resolved = resolveNoteStyle(note)

  return (
    <>
      <ColorPicker
        value={note.style.color}
        label={t('notesPanel.color')}
        onChange={(color) =>
          onPatch({
            style: {
              ...note.style,
              color,
              fillColor: note.style.fillColor === null ? null : color,
            },
          })
        }
      />

      {isFilledKind(note.kind) && (
        <>
          <label className="notes-panel__field notes-panel__field--checkbox">
            <input
              type="checkbox"
              checked={resolved.hasFill}
              onChange={(event) =>
                onPatch({
                  style: {
                    ...note.style,
                    fillColor: event.target.checked ? resolved.color : null,
                  },
                })
              }
            />
            <span>{t('notesPanel.fill')}</span>
          </label>

          <label className="notes-panel__field notes-panel__field--checkbox">
            <input
              type="checkbox"
              checked={note.style.hatch !== null}
              onChange={(event) =>
                onPatch({
                  style: {
                    ...note.style,
                    hatch: event.target.checked ? { ...DEFAULT_HATCH } : null,
                  },
                })
              }
            />
            <span>{t('notesPanel.hatch')}</span>
          </label>

          {note.style.hatch && (
            <HatchPicker
              hatch={note.style.hatch}
              onChange={(hatch) => onPatch({ style: { ...note.style, hatch } })}
            />
          )}
        </>
      )}

      <label className="notes-panel__field notes-panel__field--inline">
        <span className="notes-panel__field-label">{t('notesPanel.opacity')}</span>
        <input
          type="range"
          min={NOTE_OPACITY_MIN}
          max={NOTE_OPACITY_MAX}
          step={0.05}
          value={note.style.opacity}
          onChange={(event) =>
            onPatch({ style: { ...note.style, opacity: Number(event.target.value) } })
          }
        />
        <span className="notes-panel__value">{Math.round(note.style.opacity * 100)}%</span>
      </label>

      <label className="notes-panel__field notes-panel__field--inline">
        <span className="notes-panel__field-label">{t('notesPanel.strokeWidth')}</span>
        <input
          type="range"
          min={NOTE_STROKE_WIDTH_MIN}
          max={NOTE_STROKE_WIDTH_MAX}
          step={1}
          value={note.style.strokeWidth}
          onChange={(event) =>
            onPatch({ style: { ...note.style, strokeWidth: Number(event.target.value) } })
          }
        />
        <span className="notes-panel__value">{note.style.strokeWidth}</span>
      </label>

      <label className="notes-panel__field notes-panel__field--checkbox">
        <input
          type="checkbox"
          checked={note.showLabel}
          onChange={(event) => onPatch({ showLabel: event.target.checked })}
        />
        <span>{t('notesPanel.showLabel')}</span>
      </label>
    </>
  )
}
