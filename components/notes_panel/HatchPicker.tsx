import { useLocale } from '@/hooks/useLocale'
import { NOTE_PALETTE } from '@/lib/notes/palette'
import type { HatchPattern, NoteHatch } from '@/lib/notes/types'

/**
 * Пять узоров штриховки.
 *
 * Рисуются в SVG прямо здесь: пользователю важно видеть узор, а не читать его
 * название. Те же пять узоров уходят на карту как тайловый паттерн, поэтому
 * рисунок повторяет то, что увидит карта.
 */
const PREVIEW_SIZE = 28

const PatternLines = ({ pattern, color }: { pattern: HatchPattern; color: string }) => {
  const lines = (
    <>
      <path d="M-4 8 L8 -4 M0 12 L12 0 M4 16 L16 4" stroke={color} strokeWidth={2} />
      <path d="M-4 -4 L8 8 M0 -4 L12 8 M4 -4 L16 8" stroke={color} strokeWidth={2} />
    </>
  )

  switch (pattern) {
    case 'diagonal':
      return <path d="M-4 8 L8 -4 M0 12 L12 0 M4 16 L16 4" stroke={color} strokeWidth={2} />
    case 'backDiagonal':
      return <path d="M-4 -4 L8 8 M0 -4 L12 8 M4 -4 L16 8" stroke={color} strokeWidth={2} />
    case 'grid':
      return lines
    case 'horizontal':
      return <path d="M0 6 H16 M0 14 H16" stroke={color} strokeWidth={2} />
    case 'dots':
      return (
        <>
          <circle cx={6} cy={6} r={1.6} fill={color} />
          <circle cx={14} cy={14} r={1.6} fill={color} />
        </>
      )
    default:
      return null
  }
}

export const HatchPreview = ({
  pattern,
  color,
  size = PREVIEW_SIZE,
}: {
  pattern: HatchPattern
  color: string
  size?: number
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    aria-hidden="true"
    className="notes-panel__hatch-preview"
  >
    <rect width={16} height={16} fill="#ffffff" />
    <PatternLines pattern={pattern} color={color} />
  </svg>
)

const PATTERN_ORDER: HatchPattern[] = ['diagonal', 'backDiagonal', 'grid', 'dots', 'horizontal']

const patternLabelKey = (pattern: HatchPattern) =>
  `notesPanel.hatch${pattern[0].toUpperCase()}${pattern.slice(1)}` as
    | 'notesPanel.hatchDiagonal'
    | 'notesPanel.hatchBackDiagonal'
    | 'notesPanel.hatchGrid'
    | 'notesPanel.hatchDots'
    | 'notesPanel.hatchHorizontal'

/** Выбор узора, цвета и толщины штриховки. */
export const HatchPicker = ({
  hatch,
  onChange,
}: {
  hatch: NoteHatch
  onChange: (hatch: NoteHatch) => void
}) => {
  const { t } = useLocale()

  return (
    <fieldset className="notes-panel__hatch">
      <legend className="notes-panel__field-label">{t('notesPanel.hatchPattern')}</legend>

      <div className="notes-panel__hatch-patterns">
        {PATTERN_ORDER.map((pattern) => (
          <button
            key={pattern}
            type="button"
            className="notes-panel__hatch-pattern"
            data-active={hatch.pattern === pattern}
            aria-label={t(patternLabelKey(pattern))}
            aria-pressed={hatch.pattern === pattern}
            title={t(patternLabelKey(pattern))}
            onClick={() => onChange({ ...hatch, pattern })}
          >
            <HatchPreview pattern={pattern} color={hatch.color} size={22} />
          </button>
        ))}
      </div>

      <div className="notes-panel__hatch-color">
        <span className="notes-panel__field-label">{t('notesPanel.hatchColor')}</span>
        <div className="notes-panel__colors">
          {NOTE_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className="notes-panel__color notes-panel__color--small"
              data-active={hatch.color.toLowerCase() === color.toLowerCase()}
              style={{ backgroundColor: color }}
              aria-label={color}
              aria-pressed={hatch.color.toLowerCase() === color.toLowerCase()}
              onClick={() => onChange({ ...hatch, color })}
            />
          ))}
        </div>
      </div>

      <label className="notes-panel__field notes-panel__field--inline">
        <span className="notes-panel__field-label">{t('notesPanel.hatchWidth')}</span>
        <input
          type="range"
          min={1}
          max={3}
          step={1}
          value={hatch.width}
          onChange={(event) =>
            onChange({ ...hatch, width: Number(event.target.value) as 1 | 2 | 3 })
          }
        />
        <span className="notes-panel__value">{hatch.width}</span>
      </label>
    </fieldset>
  )
}
