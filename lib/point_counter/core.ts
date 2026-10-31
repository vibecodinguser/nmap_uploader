/**
 * Чистая логика подсчета точек в векторных SVG путях и определения лимитов.
 */
export const MAX_POINTS_LIMIT = 500
export const MAX_OBSERVED_POINTS = 1000
export const WARNING_POINTS_THRESHOLD = 100
export const DANGER_POINTS_THRESHOLD = 50
export const MAP_INTERACTION_TIMEOUT_MS = 120000
export const PRE_RENDERED_TRACK_MIN_POINTS = 15

export type CounterThemeStyle = {
  backgroundColor: string
  color: string
}

/**
 * Подсчитывает количество геометрических вершин в SVG-пути (атрибут d).
 * Корректно обрабатывает все команды SVG (M, L, H, V, C, S, Q, T, A, Z), включая дуги скругления.
 */
export const countPointsInPath = (d: string): number => {
  if (!d || typeof d !== 'string') return 0

  const commandRegex = /([a-df-z])([^a-df-z]*)/gi
  let totalPoints = 0
  let match = commandRegex.exec(d)

  while (match !== null) {
    const command = match[1].toUpperCase()
    const argsString = match[2]
    const numbers = argsString.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)
    if (numbers && numbers.length > 0) {
      const count = numbers.length

      switch (command) {
        case 'M':
        case 'L':
        case 'T':
          totalPoints += Math.floor(count / 2)
          break
        case 'H':
        case 'V':
          totalPoints += count
          break
        case 'C':
          // Кубическая кривая Безье: 6 чисел на сегмент дуги = 1 вершина
          totalPoints += Math.floor(count / 6)
          break
        case 'S':
        case 'Q':
          // Квадратичная кривая / гладкая кубическая: 4 числа = 1 вершина
          totalPoints += Math.floor(count / 4)
          break
        case 'A':
          // Дуга окружности: 7 чисел = 1 вершина
          totalPoints += Math.floor(count / 7)
          break
        default:
          totalPoints += Math.floor(count / 2)
          break
      }
    }

    match = commandRegex.exec(d)
  }

  if (totalPoints === 0) {
    const fallbackNumbers = d.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)
    if (fallbackNumbers) {
      return Math.floor(fallbackNumbers.length / 2)
    }
  }

  return totalPoints
}

/**
 * Подсчитывает количество точек в атрибуте points элемента polyline / polygon.
 */
export const countPointsInPolyline = (pointsAttr: string): number => {
  const numbers = pointsAttr.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)
  if (!numbers) return 0
  return Math.floor(numbers.length / 2)
}

/**
 * Корректирует сырое количество точек пути, исключая динамическую вершину под курсором (резиновую нить).
 * При рисовании линия следует за курсором (+1 точка), поэтому реальных зафиксированных вершин = rawPoints - 1.
 */
export const normalizeActiveDrawingPoints = (rawPoints: number): number => {
  if (rawPoints <= 1) return rawPoints
  return rawPoints - 1
}

/**
 * Определяет оставшееся количество точек до лимита.
 */
export const calculateRemainingPoints = (
  count: number,
  limit: number = MAX_POINTS_LIMIT,
): number => {
  return Math.max(0, limit - count)
}

/**
 * Вычисляет количество точек, превышающих установленный лимит.
 */
export const calculateExceededPoints = (
  count: number,
  limit: number = MAX_POINTS_LIMIT,
): number => {
  return Math.max(0, count - limit)
}

export type CounterStatus =
  | { type: 'remaining'; count: number }
  | { type: 'limitReached' }
  | { type: 'limitExceeded'; count: number }

/**
 * Определяет статус счетчика вершин: запас вершин, достижение лимита (0) или превышение.
 */
export const getCounterStatus = (
  currentPoints: number,
  limit: number = MAX_POINTS_LIMIT,
): CounterStatus => {
  if (currentPoints > limit) {
    return {
      type: 'limitExceeded',
      count: currentPoints - limit,
    }
  }

  const remaining = limit - currentPoints
  if (remaining <= 0) {
    return {
      type: 'limitReached',
    }
  }

  return {
    type: 'remaining',
    count: remaining,
  }
}

/**
 * Вычисляет цветовую схему индикатора в зависимости от оставшегося лимита точек.
 */
export const getCounterThemeStyle = (remaining: number): CounterThemeStyle => {
  if (remaining <= DANGER_POINTS_THRESHOLD) {
    return {
      backgroundColor: 'rgba(235, 32, 32, 0.95)',
      color: 'white',
    }
  }

  if (remaining <= WARNING_POINTS_THRESHOLD) {
    return {
      backgroundColor: 'rgba(255, 165, 0, 0.95)',
      color: 'black',
    }
  }

  return {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#fff',
  }
}

/**
 * Проверяет, относится ли цвет обводки canvas к активной линии рисования в редакторе (magenta / yellow).
 */
export const isEditorDrawingStrokeStyle = (strokeStyle: unknown): boolean => {
  if (typeof strokeStyle !== 'string') return false
  const lower = strokeStyle.trim().toLowerCase()
  return (
    lower === '#ff00ff' ||
    lower === '#f0f' ||
    lower === 'magenta' ||
    lower === '#ffff00' ||
    lower === '#ff0' ||
    lower === 'yellow' ||
    lower.startsWith('rgba(255, 0, 255') ||
    lower.startsWith('rgba(255, 255, 0') ||
    lower.startsWith('rgba(80, 227, 194')
  )
}
