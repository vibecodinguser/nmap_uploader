/**
 * Модель заметки.
 *
 * Заметка — самостоятельный объект расширения, не связанный с Блокнотом
 * картографа. Атрибуты живут в Манифесте заметок, геометрия — в шардах.
 */

export type NoteKind = 'Point' | 'Line' | 'Polygon' | 'Square' | 'Circle'

/** Координаты в порядке GeoJSON: [долгота, широта]. */
export type LonLat = [number, number]

export type NoteGeometry =
  | { kind: 'Point'; coords: LonLat }
  | { kind: 'Line'; coords: LonLat[] }
  | { kind: 'Polygon'; coords: LonLat[] }
  | { kind: 'Square'; corners: [LonLat, LonLat] }
  | { kind: 'Circle'; center: LonLat; radiusMeters: number }

export type HatchPattern = 'diagonal' | 'backDiagonal' | 'grid' | 'dots' | 'horizontal'

/**
 * Штриховка площадной фигуры.
 *
 * Цвет и толщина линий не настраиваются: узор рисуется цветом самого объекта,
 * иначе он спорит с обводкой и заливкой.
 */
export type NoteHatch = {
  pattern: HatchPattern
}

export type NoteStyle = {
  /** `null` — цвет наследуется от группы или берётся из палитры по умолчанию. */
  color: string | null
  /** Только для полигонов, квадратов и кругов; `null` — без заливки. */
  fillColor: string | null
  hatch: NoteHatch | null
  /** Прозрачность всего объекта, 0.05–1. */
  opacity: number
  /** Ширина границы, 1–8. */
  strokeWidth: number
}

export type NoteIcon = { kind: 'builtin'; value: string } | { kind: 'file'; value: string }

export type Note = {
  id: string
  kind: NoteKind
  /** Пустая строка — заметка ещё без названия, показывается автоимя. */
  name: string
  description: string
  /** Дата заметки в формате DD-MM-YYYY. */
  date: string
  icon: NoteIcon | null
  showLabel: boolean
  style: NoteStyle
  groupId: string | null
  createdAt: string
  updatedAt: string
}

export type NoteGroup = {
  id: string
  name: string
  color: string
  order: number
  createdAt: string
  updatedAt: string
}

export const NOTE_KINDS: readonly NoteKind[] = ['Point', 'Line', 'Polygon', 'Square', 'Circle']

export const isNoteKind = (value: unknown): value is NoteKind =>
  typeof value === 'string' && (NOTE_KINDS as readonly string[]).includes(value)

/** Виды, у которых есть заливка. */
export const isFilledKind = (kind: NoteKind): boolean =>
  kind === 'Polygon' || kind === 'Square' || kind === 'Circle'

/**
 * Своя картинка вместо иконки из набора разрешена только точкам: у линии и
 * полигона иконка стоит в центре и означает категорию, а не сам объект.
 */
export const supportsCustomIcon = (kind: NoteKind): boolean => kind === 'Point'
