import {
  HATCH_PATTERNS,
  NOTE_OPACITY_MAX,
  NOTE_OPACITY_MIN,
  NOTE_STROKE_WIDTH_MAX,
  NOTE_STROKE_WIDTH_MIN,
} from '../palette'
import { createDefaultStyle, isSupportedColor } from '../style_resolution'
import {
  type HatchPattern,
  isFilledKind,
  isNoteKind,
  type LonLat,
  type Note,
  type NoteGeometry,
  type NoteGroup,
  type NoteHatch,
  type NoteIcon,
  type NoteStyle,
} from '../types'
import { NOTES_MANIFEST_VERSION, type NotesManifest } from './schema'

/**
 * Приведение прочитанного с Диска к модели.
 *
 * Битые записи отбрасываются по одной, а не роняют весь файл: иначе один
 * испорченный объект закрывает пользователю все заметки.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isCoordinate = (value: unknown): value is LonLat =>
  Array.isArray(value) && isFiniteNumber(value[0]) && isFiniteNumber(value[1])

const clamp = (value: unknown, min: number, max: number, fallback: number): number =>
  isFiniteNumber(value) ? Math.min(max, Math.max(min, value)) : fallback

const DISPLAY_DATE_PATTERN = /^\d{2}-\d{2}-\d{4}$/

export const isDisplayDate = (value: unknown): value is string =>
  typeof value === 'string' && DISPLAY_DATE_PATTERN.test(value)

const normalizeHatch = (value: unknown): NoteHatch | null => {
  if (!isRecord(value)) return null
  const pattern = value.pattern
  if (typeof pattern !== 'string' || !(HATCH_PATTERNS as readonly string[]).includes(pattern)) {
    return null
  }
  // Цвет и толщина раньше хранились в заметке; в старых записях они есть,
  // но больше не используются — узор рисуется цветом объекта.
  return { pattern: pattern as HatchPattern }
}

const normalizeStyle = (value: unknown, fallbackKind: Note['kind']): NoteStyle => {
  const base = createDefaultStyle(fallbackKind)
  if (!isRecord(value)) return base

  const filled = isFilledKind(fallbackKind)
  return {
    color: isSupportedColor(value.color) ? value.color : null,
    fillColor: filled && isSupportedColor(value.fillColor) ? value.fillColor : null,
    hatch: filled ? normalizeHatch(value.hatch) : null,
    opacity: clamp(value.opacity, NOTE_OPACITY_MIN, NOTE_OPACITY_MAX, base.opacity),
    strokeWidth: Math.round(
      clamp(value.strokeWidth, NOTE_STROKE_WIDTH_MIN, NOTE_STROKE_WIDTH_MAX, base.strokeWidth),
    ),
  }
}

const normalizeIcon = (value: unknown): NoteIcon | null => {
  if (!isRecord(value)) return null
  const { kind, value: iconValue } = value
  if (typeof iconValue !== 'string' || iconValue === '') return null
  if (kind !== 'builtin' && kind !== 'file') return null
  return { kind, value: iconValue }
}

/** Приводит запись манифеста к модели, отбрасывая то, что не читается. */
export const normalizeNote = (value: unknown): Note | null => {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || value.id === '') return null
  if (!isNoteKind(value.kind)) return null
  if (!isDisplayDate(value.date)) return null

  const createdAt =
    typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString()
  return {
    id: value.id,
    kind: value.kind,
    name: typeof value.name === 'string' ? value.name : '',
    description: typeof value.description === 'string' ? value.description : '',
    date: value.date,
    icon: normalizeIcon(value.icon),
    showLabel: value.showLabel === true,
    style: normalizeStyle(value.style, value.kind),
    groupId: typeof value.groupId === 'string' && value.groupId !== '' ? value.groupId : null,
    createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
  }
}

export const normalizeGroup = (value: unknown): NoteGroup | null => {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || value.id === '') return null

  const createdAt =
    typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString()
  return {
    id: value.id,
    name: typeof value.name === 'string' ? value.name : '',
    color: isSupportedColor(value.color) ? value.color : '#1a8cff',
    order: isFiniteNumber(value.order) ? value.order : 0,
    createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
  }
}

/** Разбирает манифест с Диска. `null` — файл не похож на манифест вовсе. */
export const parseManifest = (raw: unknown): NotesManifest | null => {
  if (!isRecord(raw)) return null
  if (!Array.isArray(raw.notes) && !Array.isArray(raw.groups)) return null

  const notes = Array.isArray(raw.notes)
    ? raw.notes.map(normalizeNote).filter((note): note is Note => note !== null)
    : []
  const groups = Array.isArray(raw.groups)
    ? raw.groups.map(normalizeGroup).filter((group): group is NoteGroup => group !== null)
    : []

  return {
    version: isFiniteNumber(raw.version) ? raw.version : NOTES_MANIFEST_VERSION,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
    groups,
    notes,
  }
}

/** Геометрия, пригодная для отрисовки: без пустых линий и вырожденных фигур. */
export const normalizeGeometry = (value: unknown): NoteGeometry | null => {
  if (!isRecord(value)) return null

  switch (value.kind) {
    case 'Point':
      return isCoordinate(value.coords) ? { kind: 'Point', coords: value.coords } : null
    case 'Line': {
      if (!Array.isArray(value.coords)) return null
      const coords = value.coords.filter(isCoordinate)
      return coords.length >= 2 ? { kind: 'Line', coords } : null
    }
    case 'Polygon': {
      if (!Array.isArray(value.coords)) return null
      const coords = value.coords.filter(isCoordinate)
      if (coords.length < 3) return null
      const first = coords[0]
      const last = coords.at(-1) as LonLat
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords.push([first[0], first[1]])
      }
      return { kind: 'Polygon', coords }
    }
    case 'Square': {
      if (!Array.isArray(value.corners) || value.corners.length !== 2) return null
      const [a, b] = value.corners
      return isCoordinate(a) && isCoordinate(b) ? { kind: 'Square', corners: [a, b] } : null
    }
    case 'Circle': {
      if (!isCoordinate(value.center) || !isFiniteNumber(value.radiusMeters)) return null
      if (value.radiusMeters <= 0) return null
      return {
        kind: 'Circle',
        center: value.center,
        radiusMeters: value.radiusMeters,
      }
    }
    default:
      return null
  }
}
