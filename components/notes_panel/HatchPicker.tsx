import { useLocale } from '@/hooks/useLocale'
import type { HatchPattern, NoteHatch } from '@/lib/notes/types'

/**
 * Пять узоров штриховки.
 *
 * Рисуются в SVG прямо здесь: пользователю важно видеть узор, а не читать его
 * название. Те же пять узоров уходят на карту как тайловый паттерн, поэтому
 * предпросмотр повторяет то, что увидят на карте.
 *
 * Цвет узора в предпросмотре нейтральный: на карте штриховка рисуется цветом
 * самого объекта, а здесь важно сравнить рисунок, а не цвет.
 */
const PREVIEW_SIZE = 28
const PREVIEW_COLOR = '#1f1f1f'

const PatternLines = ({ pattern }: { pattern: HatchPattern }) => {
  const stroke = PREVIEW_COLOR

  switch (pattern) {
    case 'diagonal':
      return <path d="M-4 8 L8 -4 M0 12 L12 0 M4 16 L16 4" stroke={stroke} strokeWidth={2} />
    case 'backDiagonal':
      return <path d="M-4 -4 L8 8 M0 -4 L12 8 M4 -4 L16 8" stroke={stroke} strokeWidth={2} />
    case 'grid':
      return (
        <>
          <path d="M-4 8 L8 -4 M0 12 L12 0 M4 16 L16 4" stroke={stroke} strokeWidth={2} />
          <path d="M-4 -4 L8 8 M0 -4 L12 8 M4 -4 L16 8" stroke={stroke} strokeWidth={2} />
        </>
      )
    case 'horizontal':
      return <path d="M0 6 H16 M0 14 H16" stroke={stroke} strokeWidth={2} />
    case 'dots':
      return (
        <>
          <circle cx={6} cy={6} r={1.6} fill={stroke} />
          <circle cx={14} cy={14} r={1.6} fill={stroke} />
        </>
      )
    default:
      return null
  }
}

export const HatchPreview = ({
  pattern,
  size = PREVIEW_SIZE,
}: {
  pattern: HatchPattern
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
    <PatternLines pattern={pattern} />
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

/** Выбор узора штриховки. Цвет и толщина линий не настраиваются. */
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
            onClick={() => onChange({ pattern })}
          >
            <HatchPreview pattern={pattern} size={22} />
          </button>
        ))}
      </div>
    </fieldset>
  )
}
