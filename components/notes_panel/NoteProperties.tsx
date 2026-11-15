import { useEffect, useState } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { formatDateDisplayInput, isValidDisplayDate } from '@/lib/date_format'
import {
  DEFAULT_HATCH,
  NOTE_OPACITY_MAX,
  NOTE_OPACITY_MIN,
  NOTE_PALETTE,
  NOTE_STROKE_WIDTH_MAX,
  NOTE_STROKE_WIDTH_MIN,
} from '@/lib/notes/palette'
import { resolveNoteStyle } from '@/lib/notes/style_resolution'
import { isFilledKind, type Note } from '@/lib/notes/types'
import { ColorPicker } from './ColorPicker'
import { HatchPicker } from './HatchPicker'
import { NOTES_PANEL_BUTTON_IDS } from './ids'

const kindKey = (kind: Note['kind']) => `notesPanel.kind${kind}` as const

/** Свойства выбранной заметки. */
export const NoteProperties = ({
  note,
  fallbackName,
  hidden,
  onPatch,
  onDelete,
  onBack,
  onLocate,
  onToggleHidden,
}: {
  note: Note
  /** Автоимя «дд.мм.гггг + вид»: подставляется, если название стёрли. */
  fallbackName: string
  hidden: boolean
  onPatch: (patch: Partial<Note>) => void
  onDelete: () => void
  onBack: () => void
  onLocate: () => void
  onToggleHidden: () => void
}) => {
  const { t } = useLocale()
  const [date, setDate] = useState(note.date)
  const [dateTouched, setDateTouched] = useState(false)

  useEffect(() => {
    setDate(note.date)
    setDateTouched(false)
  }, [note.date])

  const dateValid = isValidDisplayDate(date)

  // Итоговые цвета: свои, из группы или из палитры.
  const resolved = resolveNoteStyle(note)
  /** Заливка ещё не переопределена и должна следовать за цветом объекта. */
  const fillFollowsColor = note.style.fillColor !== null && note.style.fillColor === resolved.color

  const commitDate = (): void => {
    setDateTouched(true)
    if (dateValid && date !== note.date) {
      onPatch({ date })
    }
  }

  return (
    <div className="notes-panel__properties">
      <div className="notes-panel__properties-head">
        <button type="button" className="notes-panel__link-button" onClick={onBack}>
          ← {t('notesPanel.back')}
        </button>
        <span className="notes-panel__properties-kind">{t(kindKey(note.kind))}</span>
      </div>

      <label className="notes-panel__field">
        <span className="notes-panel__field-label">{t('notesPanel.namePlaceholder')}</span>
        <input
          className="notes-panel__input"
          value={note.name}
          onChange={(event) => onPatch({ name: event.target.value })}
          onBlur={() => {
            if (!note.name.trim()) onPatch({ name: fallbackName })
          }}
          placeholder={t('notesPanel.namePlaceholder')}
        />
      </label>

      <label className="notes-panel__field">
        <span className="notes-panel__field-label">{t('notesPanel.descriptionPlaceholder')}</span>
        <textarea
          className="notes-panel__input notes-panel__textarea"
          value={note.description}
          onChange={(event) => onPatch({ description: event.target.value })}
          placeholder={t('notesPanel.descriptionPlaceholder')}
        />
      </label>

      <label className="notes-panel__field notes-panel__field--inline">
        <span className="notes-panel__field-label">{t('notesPanel.date')}</span>
        <input
          className="notes-panel__input"
          value={date}
          inputMode="numeric"
          placeholder="дд.мм.гггг"
          onChange={(event) => {
            setDate(formatDateDisplayInput(event.target.value))
            setDateTouched(true)
          }}
          onBlur={commitDate}
        />
      </label>
      {dateTouched && !dateValid && (
        <span className="notes-panel__hint notes-panel__hint--error">
          {t('notesPanel.dateInvalid')}
        </span>
      )}

      <ColorPicker
        value={note.style.color}
        label={t('notesPanel.color')}
        onChange={(color) =>
          onPatch({
            style: {
              ...note.style,
              color,
              // Заливка следует за цветом объекта, пока её не задали отдельно:
              // иначе новый зелёный полигон оставался бы с синей заливкой.
              fillColor: fillFollowsColor ? color : note.style.fillColor,
            },
          })
        }
      />

      {isFilledKind(note.kind) && (
        <>
          <label className="notes-panel__field notes-panel__field--checkbox">
            <input
              type="checkbox"
              checked={note.style.fillColor !== null}
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

          {note.style.fillColor !== null && (
            <ColorPicker
              value={note.style.fillColor}
              label={t('notesPanel.fillColor')}
              onChange={(fillColor) => onPatch({ style: { ...note.style, fillColor } })}
            />
          )}

          <label className="notes-panel__field notes-panel__field--checkbox">
            <input
              type="checkbox"
              checked={note.style.hatch !== null}
              onChange={(event) =>
                onPatch({
                  style: {
                    ...note.style,
                    hatch: event.target.checked
                      ? { ...DEFAULT_HATCH, color: resolved.color }
                      : null,
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

      <div className="notes-panel__actions">
        <button
          type="button"
          id={NOTES_PANEL_BUTTON_IDS.find}
          className="notes-panel__button"
          onClick={onLocate}
        >
          {t('notesPanel.locate')}
        </button>
        <button
          type="button"
          id={NOTES_PANEL_BUTTON_IDS.visible}
          className="notes-panel__button"
          onClick={onToggleHidden}
        >
          {hidden ? t('notesPanel.visible') : t('notesPanel.hidden')}
        </button>
        <button
          type="button"
          id={NOTES_PANEL_BUTTON_IDS.delete}
          className="notes-panel__button notes-panel__button--danger"
          onClick={onDelete}
        >
          {t('notesPanel.delete')}
        </button>
      </div>
    </div>
  )
}
