import { DEFAULT_NOTE_COLOR, defaultOpacity } from './palette'
import type { Note, NoteGroup, NoteKind, NoteStyle } from './types'

/** Оформление по умолчанию: цвет наследуется, заливка — только у площадных видов. */
export const createDefaultStyle = (kind: NoteKind): NoteStyle => ({
  color: null,
  fillColor: kind === 'Point' || kind === 'Line' ? null : DEFAULT_NOTE_COLOR,
  hatch: null,
  opacity: defaultOpacity(kind),
  strokeWidth: 3,
})

export type ResolvedNoteStyle = NoteStyle & {
  color: string
  /** Заливка включена; её цвет всегда совпадает с цветом объекта. */
  hasFill: boolean
}

/**
 * Итоговый цвет заметки: свой → цвет группы → палитра.
 *
 * Цвет группы — значение по умолчанию, а не жёсткая привязка: заметка внутри
 * группы может быть перекрашена отдельно.
 *
 * Заливка отдельного цвета не имеет: `fillColor` — это признак «заливка
 * включена», а не самостоятельный цвет.
 */
export const resolveNoteStyle = (
  note: Pick<Note, 'style'>,
  group?: Pick<NoteGroup, 'color'> | null,
): ResolvedNoteStyle => {
  const color = note.style.color ?? group?.color ?? DEFAULT_NOTE_COLOR

  return {
    ...note.style,
    color,
    hasFill: note.style.fillColor !== null,
    fillColor: note.style.fillColor === null ? null : color,
  }
}

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

const normalizeHex = (value: string): string => {
  const hex = value.trim()
  if (HEX_PATTERN.test(hex)) {
    return hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase()
      : hex.toLowerCase()
  }
  return DEFAULT_NOTE_COLOR
}

const parseHexChannels = (hex: string): [number, number, number] => {
  const normalized = normalizeHex(hex)
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ]
}

/** Переводит цвет в `rgba()` с прозрачностью объекта. */
export const withOpacity = (color: string, opacity: number): string => {
  const alpha = Math.min(Math.max(opacity, 0), 1)
  if (alpha >= 1) return color
  const [r, g, b] = parseHexChannels(color)
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`
}

/** Проверяет, что строка — цвет, который мы умеем рисовать. */
export const isSupportedColor = (value: unknown): value is string =>
  typeof value === 'string' && HEX_PATTERN.test(value.trim())
