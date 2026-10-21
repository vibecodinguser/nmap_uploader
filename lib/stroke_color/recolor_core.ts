/**
 * Чистая логика детекции цветов, парсинга RGB и сопоставления с magenta.
 */
export const MAGENTA_NAMES = new Set(['magenta', '#f0f', '#ff00ff'])
export const RECOLOR_MARKER = 'data-nmap-recolored'
export const RECOLOR_STYLE_ID = 'nmap-stroke-recolor'
export const KNOWN_COLORS_KEY = '__NMAP_KNOWN_STROKE_COLORS__'

export type RgbColor = {
  r: number
  g: number
  b: number
}

/**
 * Парсит строковое представление цвета (hex, rgb, rgba, имя) в { r, g, b } или возвращает null.
 */
export const parseRgb = (value: string): RgbColor | null => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')

  if (MAGENTA_NAMES.has(normalized)) {
    return { r: 255, g: 0, b: 255 }
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{3,8})$/)
  if (hexMatch) {
    const hex = hexMatch[1]
    if (hex.length === 3) {
      return {
        r: Number.parseInt(hex[0] + hex[0], 16),
        g: Number.parseInt(hex[1] + hex[1], 16),
        b: Number.parseInt(hex[2] + hex[2], 16),
      }
    }
    if (hex.length >= 6) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
      }
    }
  }

  const rgbMatch = normalized.match(/^rgba?\((\d+),(\d+),(\d+)/)
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    }
  }

  return null
}

/**
 * Преобразует строковое значение цвета в нормализованный строковый ключ "r,g,b".
 */
export const colorToKey = (value: string): string | null => {
  const rgb = parseRgb(value)
  if (!rgb) return null
  return `${rgb.r},${rgb.g},${rgb.b}`
}

/**
 * Проверяет, является ли цвет оттенком чистого magenta (255, 0, 255).
 */
export const isMagentaColor = (value: string | null | undefined): boolean => {
  if (!value) return false
  const rgb = parseRgb(value)
  if (!rgb) return false
  return rgb.r === 255 && rgb.g === 0 && rgb.b === 255
}

/**
 * Генерирует CSS stylesheet для принудительного перекрашивания SVG элементов.
 */
export const buildRecolorStyleSheet = (targetStroke: string): string => `
  ymaps svg [stroke="#ff00ff" i],
  ymaps svg [stroke="#f0f" i],
  ymaps svg [stroke="magenta" i],
  ymaps svg [stroke="rgb(255, 0, 255)" i],
  ymaps svg [stroke="rgba(255, 0, 255, 1)" i],
  .nk-app-view svg [stroke="#ff00ff" i],
  .nk-app-view svg [stroke="#f0f" i],
  .nk-app-view svg [stroke="magenta" i],
  .nk-app-view svg [stroke="rgb(255, 0, 255)" i],
  svg [stroke="#ff00ff" i],
  svg [stroke="#f0f" i],
  svg [stroke="magenta" i],
  svg [stroke="rgb(255, 0, 255)" i] {
    stroke: ${targetStroke} !important;
  }
`
