export const DEFAULT_STROKE_COLOR = '#ff00ff'
export const DEFAULT_STROKE_COLOR_INPUT = 'ff00ff'
export const STROKE_COLOR_STORAGE_KEY = 'editorStrokeColor'
export const STROKE_COLOR_WINDOW_KEY = '__NMAP_STROKE_COLOR__'
export const STROKE_COLOR_CHANGED_EVENT = 'nmap-stroke-color-changed'
export const STROKE_COLOR_MESSAGE_TYPE = 'nmap:stroke-color'
export const STROKE_COLOR_REQUEST_TYPE = 'nmap:stroke-color-request'

/**
 * Нормализует hex-цвет (RGB / RRGGBB, с # или без) или возвращает null (чистая функция).
 */
export const normalizeStrokeColor = (value: string): string | null => {
  const trimmed = value.trim().replace(/^#/, '')
  if (!trimmed) return null

  const hexMatch = trimmed.match(/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!hexMatch) return null

  const hex = hexMatch[1]
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase()
  }

  return `#${hex.toLowerCase()}`
}

/**
 * Преобразует сохранённое значение в текст для поля ввода (без #).
 */
export const toStrokeColorInputValue = (raw?: string | null): string =>
  (raw ?? '').trim().replace(/^#/, '')

/**
 * Возвращает эффективный цвет (дефолт при пустом или некорректном вводе).
 */
export const getEffectiveStrokeColor = (raw?: string | null): string =>
  normalizeStrokeColor(raw ?? '') ?? DEFAULT_STROKE_COLOR
