import type { ReactElement } from 'react'
import { useLocale } from '@/hooks/useLocale'
import type { HatchPattern, NoteHatch } from '@/lib/notes/types'

/**
 * Пять узоров штриховки.
 *
 * Превью рисует не один тайл, а четыре (2×2 в поле 16×16): один тайл в плитке
 * 8×8 выглядит как пара редких линий, и различить узоры в списке было трудно.
 * Плотность и наклон повторяют то, что уходит на карту.
 *
 * Цвет линий берётся из `currentColor`: в светлой теме это тёмные линии на
 * светлом поле, в тёмной — наоборот. Жёсткий цвет делал превью нечитаемым в
 * одной из тем.
 */
export const HATCH_PREVIEW_SIZE = 32

/** Один тайл узора размером 8×8, повторённый 2×2 в поле 16×16. */
const TILE = 8
const TILE_OFFSETS = [0, TILE]

type TileProps = { offsetX: number; offsetY: number }

const strokeProps = {
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
} as const

const DiagonalTile = ({ offsetX, offsetY }: TileProps) => (
  <path d={`M${offsetX} ${offsetY + TILE} L${offsetX + TILE} ${offsetY}`} {...strokeProps} />
)

const BackDiagonalTile = ({ offsetX, offsetY }: TileProps) => (
  <path d={`M${offsetX} ${offsetY} L${offsetX + TILE} ${offsetY + TILE}`} {...strokeProps} />
)

const HorizontalTile = ({ offsetX, offsetY }: TileProps) => (
  <path d={`M${offsetX} ${offsetY + TILE / 2} H${offsetX + TILE}`} {...strokeProps} />
)

const DotsTile = ({ offsetX, offsetY }: TileProps) => (
  <circle cx={offsetX + TILE / 2} cy={offsetY + TILE / 2} r={1.5} fill="currentColor" />
)

/** Все четыре тайла одного рисунка. */
const Tiled = ({ render }: { render: (props: TileProps) => ReactElement }) => (
  <>
    {TILE_OFFSETS.flatMap((offsetY) =>
      TILE_OFFSETS.map((offsetX) => (
        <g key={`${offsetX}-${offsetY}`}>{render({ offsetX, offsetY })}</g>
      )),
    )}
  </>
)

const PatternLines = ({ pattern }: { pattern: HatchPattern }) => {
  switch (pattern) {
    case 'diagonal':
      return <Tiled render={(props) => <DiagonalTile {...props} />} />
    case 'backDiagonal':
      return <Tiled render={(props) => <BackDiagonalTile {...props} />} />
    case 'grid':
      return (
        <>
          <Tiled render={(props) => <DiagonalTile {...props} />} />
          <Tiled render={(props) => <BackDiagonalTile {...props} />} />
        </>
      )
    case 'horizontal':
      return <Tiled render={(props) => <HorizontalTile {...props} />} />
    case 'dots':
      return <Tiled render={(props) => <DotsTile {...props} />} />
    default:
      return null
  }
}

export const HatchPreview = ({
  pattern,
  size = HATCH_PREVIEW_SIZE,
}: {
  pattern: HatchPattern
  size?: number
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
    className="notes-panel__hatch-preview"
  >
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
            <HatchPreview pattern={pattern} />
          </button>
        ))}
      </div>
    </fieldset>
  )
}
