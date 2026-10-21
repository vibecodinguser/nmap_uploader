/**
 * Чистая логика подсчета точек в векторных SVG путях и определения лимитов.
 */
export const MAX_POINTS_LIMIT = 500
export const WARNING_POINTS_THRESHOLD = 100
export const DANGER_POINTS_THRESHOLD = 50

export type CounterThemeStyle = {
  backgroundColor: string
  color: string
}

/**
 * Подсчитывает количество точек в атрибуте d SVG-пути (каждые 2 числа = 1 точка).
 */
export const countPointsInPath = (d: string): number => {
  const numbers = d.match(/-?\d+(\.\d+)?/g)
  if (!numbers) return 0
  return Math.floor(numbers.length / 2)
}

/**
 * Подсчитывает количество точек в атрибуте points элемента polyline / polygon.
 */
export const countPointsInPolyline = (pointsAttr: string): number => {
  const numbers = pointsAttr.match(/-?\d+(\.\d+)?/g)
  if (!numbers) return 0
  return Math.floor(numbers.length / 2)
}

/**
 * Определяет оставшееся количество точек до лимита.
 */
export const calculateRemainingPoints = (
  count: number,
  limit: number = MAX_POINTS_LIMIT,
): number => {
  return limit - count
}

/**
 * Вычисляет цветовую схему индикатора в зависимости от оставшегося лимита точек.
 */
export const getCounterThemeStyle = (remaining: number): CounterThemeStyle => {
  if (remaining <= DANGER_POINTS_THRESHOLD) {
    return {
      backgroundColor: 'rgba(255, 50, 50, 0.95)',
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
