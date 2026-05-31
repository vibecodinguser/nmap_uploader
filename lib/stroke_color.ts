export const DEFAULT_STROKE_COLOR = '#ff00ff'

/** Значение по умолчанию для поля ввода (без префикса #). */
export const DEFAULT_STROKE_COLOR_INPUT = 'ff00ff'

export const STROKE_COLOR_STORAGE_KEY = 'editorStrokeColor'

export const STROKE_COLOR_WINDOW_KEY = '__NMAP_STROKE_COLOR__'

declare global {
  interface Window {
    [STROKE_COLOR_WINDOW_KEY]?: string
  }
}

/** Нормализует hex-цвет (RGB / RRGGBB, с # или без) или возвращает null. */
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

/** Преобразует сохранённое значение в текст для поля ввода (без #). */
export const toStrokeColorInputValue = (raw?: string | null): string =>
  (raw ?? '').trim().replace(/^#/, '')

/** Пустой ввод — цвет по умолчанию. */
export const getEffectiveStrokeColor = (raw?: string | null): string =>
  normalizeStrokeColor(raw ?? '') ?? DEFAULT_STROKE_COLOR

export const STROKE_COLOR_CHANGED_EVENT = 'nmap-stroke-color-changed'

/** Тип сообщения для передачи цвета между изолированным и MAIN мирами через postMessage. */
export const STROKE_COLOR_MESSAGE_TYPE = 'nmap:stroke-color'

/** Запрос текущего цвета из MAIN мира к изолированному. */
export const STROKE_COLOR_REQUEST_TYPE = 'nmap:stroke-color-request'

type StrokeColorMessage = {
  type: typeof STROKE_COLOR_MESSAGE_TYPE
  color: string
}

/** Отправляет цвет в общую шину сообщений окна (читается во всех мирах одной вкладки). */
export const postStrokeColorMessage = (color: string): void => {
  if (typeof window === 'undefined') return
  window.postMessage({ type: STROKE_COLOR_MESSAGE_TYPE, color } satisfies StrokeColorMessage, '*')
}

/** MAIN мир запрашивает актуальный цвет у изолированного при старте. */
export const requestStrokeColorFromPage = (): void => {
  if (typeof window === 'undefined') return
  window.postMessage({ type: STROKE_COLOR_REQUEST_TYPE }, '*')
}

export const parseStrokeColorMessage = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null
  const message = data as Partial<StrokeColorMessage>
  if (message.type !== STROKE_COLOR_MESSAGE_TYPE) return null
  return typeof message.color === 'string' ? message.color : null
}

export const isStrokeColorRequest = (data: unknown): boolean =>
  Boolean(data) &&
  typeof data === 'object' &&
  (data as { type?: string }).type === STROKE_COLOR_REQUEST_TYPE

export const publishStrokeColorToPage = (color: string): void => {
  if (typeof window === 'undefined') return

  window[STROKE_COLOR_WINDOW_KEY] = color
  window.dispatchEvent(new CustomEvent(STROKE_COLOR_CHANGED_EVENT, { detail: { color } }))
  postStrokeColorMessage(color)
}

export const readStrokeColorFromPage = (): string | undefined => {
  if (typeof window === 'undefined') return undefined
  return window[STROKE_COLOR_WINDOW_KEY]
}
