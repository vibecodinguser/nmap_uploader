import { toWorldPixels } from './clustering'

/**
 * Схлопывание пересекающихся подписей.
 *
 * Подпись — HTML-строка под иконкой объекта, её размер зависит от текста и
 * шрифта. На плотном наборе заметок подписи наезжают друг на друга и читаются
 * как каша, поэтому показывается только часть — приоритетная.
 *
 * Расчёт в мировых пикселях: там расстояние на экране равно разности координат,
 * и не нужно знать состояние карты.
 */

/** Высота строки подписи: шрифт панели 12 px с межстрочным интервалом. */
export const LABEL_HEIGHT_PX = 18

/** Средняя ширина символа при 12 px: нужна для оценки, точное измерение невозможно. */
const LABEL_CHAR_WIDTH_PX = 6.6

/** Отступ подписи от координаты объекта вниз — как в `objects.ts`. */
const LABEL_BELOW_OFFSET_PX = 20

/** Ширина подписи по тексту: приблизительно, но монотонно по длине. */
export const estimateLabelWidth = (text: string): number =>
  Math.max(24, Math.round(text.trim().length * LABEL_CHAR_WIDTH_PX))

export type LabelBox = {
  id: string
  coordinates: [number, number]
  text: string
}

type Rect = { left: number; top: number; right: number; bottom: number }

const rectOf = (label: LabelBox, anchorPx: [number, number]): Rect => {
  const width = estimateLabelWidth(label.text)
  const centreX = anchorPx[0]
  const top = anchorPx[1] + LABEL_BELOW_OFFSET_PX
  return {
    left: centreX - width / 2,
    top,
    right: centreX + width / 2,
    bottom: top + LABEL_HEIGHT_PX,
  }
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/**
 * Оставляет подписи, которые не пересекаются.
 *
 * Порядок приоритета задаёт вызывающий: первой должна идти самая важная
 * подпись (выбранная заметка), дальше — остальные в стабильном порядке, чтобы
 * при перерисовке не прыгали местами.
 *
 * Проверка идёт по сетке, а не попарно: подписей может быть столько же,
 * сколько заметок, и квадратичный перебор был бы заметен на каждой правке.
 */
export const selectVisibleLabels = ({
  labels,
  zoom,
  priority = [],
  paddingPx = 2,
}: {
  labels: readonly LabelBox[]
  zoom: number
  /** id заметок: подписи этих заметок показываются первыми. */
  priority?: readonly string[]
  paddingPx?: number
}): LabelBox[] => {
  if (labels.length <= 1) return [...labels]

  const rank = new Map(priority.map((id, index) => [id, index]))
  const ordered = [...labels].sort((left, right) => {
    const leftRank = rank.get(left.id) ?? Number.MAX_SAFE_INTEGER
    const rightRank = rank.get(right.id) ?? Number.MAX_SAFE_INTEGER
    if (leftRank !== rightRank) return leftRank - rightRank
    // Стабильный порядок: id не меняется между перерисовками.
    return left.id.localeCompare(right.id)
  })

  const cellSize = Math.max(40, LABEL_HEIGHT_PX * 2)
  const grid = new Map<string, Rect[]>()
  const accepted: LabelBox[] = []

  const cellKey = (x: number, y: number): string => `${x}:${y}`

  for (const label of ordered) {
    const anchor = toWorldPixels(label.coordinates, zoom)
    const rect = rectOf(label, anchor)
    const padded: Rect = {
      left: rect.left - paddingPx,
      top: rect.top - paddingPx,
      right: rect.right + paddingPx,
      bottom: rect.bottom + paddingPx,
    }

    const minX = Math.floor(padded.left / cellSize)
    const maxX = Math.floor(padded.right / cellSize)
    const minY = Math.floor(padded.top / cellSize)
    const maxY = Math.floor(padded.bottom / cellSize)

    let collides = false
    for (let x = minX; x <= maxX && !collides; x += 1) {
      for (let y = minY; y <= maxY && !collides; y += 1) {
        const bucket = grid.get(cellKey(x, y))
        if (bucket?.some((other) => overlaps(padded, other))) collides = true
      }
    }
    if (collides) continue

    accepted.push(label)
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const key = cellKey(x, y)
        const bucket = grid.get(key)
        if (bucket) bucket.push(padded)
        else grid.set(key, [padded])
      }
    }
  }

  return accepted
}
