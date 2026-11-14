/**
 * Построение объектов карты из заметок.
 *
 * Здесь нет ни одного вызова ymaps: функция возвращает описание того, что надо
 * нарисовать. Так правила оформления тестируются без карты, а адаптер
 * (`NotesLayer`) остаётся тонким.
 */
import {
  circleRing,
  geometryAnchor,
  geometryCoordinates,
  squareFromCorners,
} from '@/lib/notes/geometry'
import { type ResolvedNoteStyle, resolveNoteStyle, withOpacity } from '@/lib/notes/style_resolution'
import type { LonLat, Note, NoteGeometry, NoteGroup } from '@/lib/notes/types'

export type RenderedKind = 'point' | 'line' | 'polygon' | 'label'

export type RenderedNote = {
  /** id заметки, к которой относится объект. */
  id: string
  kind: RenderedKind
  /** Точка — `[lon, lat]`; линия — массив точек; полигон — кольцо. */
  coordinates: unknown
  options: Record<string, unknown>
  properties: Record<string, unknown>
}

export type RenderNoteInput = {
  note: Note
  geometry: NoteGeometry
  group: NoteGroup | null
  selected: boolean
  /** Готовые ссылки на файлы иконок: имя файла → data URL. */
  iconUrls?: Record<string, string>
}

export const SELECTED_STROKE_BONUS = 2
export const LABEL_MIN_ZOOM = 13

export const POINT_ICON_SIZE = 20
const LABEL_OFFSET_POINT = 14
const LABEL_OFFSET_SHAPE = 0

/** Прозрачная картинка 1×1 — основа подписи без иконки. */
export const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Иконка точки: круг цвета заметки с белой обводкой.
 *
 * Рисуется как SVG-картинка, а не пресетом Яндекса: только так прозрачность и
 * цвет совпадают с остальными объектами.
 */
export const buildPointIconHref = (style: ResolvedNoteStyle): string => {
  const fill = withOpacity(style.color, style.opacity)
  const size = POINT_ICON_SIZE
  const radius = size / 2 - 3

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<circle cx="${size / 2}" cy="${size / 2}" r="${radius + 2}" fill="#ffffff" fill-opacity="0.9"/>`,
    `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="${fill}"/>`,
    '</svg>',
  ].join('')

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** SVG-паттерн штриховки для `fillImageHref`. */
export const buildHatchImageHref = (style: ResolvedNoteStyle): string | undefined => {
  if (!style.hatch) return undefined
  const { pattern, color, width } = style.hatch
  const size = 8
  const lines: string[] = []

  if (pattern === 'diagonal' || pattern === 'grid') {
    lines.push(
      `<path d="M-2 ${size + 2} L${size + 2} -2" stroke="${color}" stroke-width="${width}"/>`,
    )
  }
  if (pattern === 'backDiagonal' || pattern === 'grid') {
    lines.push(
      `<path d="M-2 -2 L${size + 2} ${size + 2}" stroke="${color}" stroke-width="${width}"/>`,
    )
  }
  if (pattern === 'horizontal') {
    lines.push(`<path d="M0 ${size / 2} H${size}" stroke="${color}" stroke-width="${width}"/>`)
  }
  if (pattern === 'dots') {
    lines.push(
      `<circle cx="${size / 2}" cy="${size / 2}" r="${Math.max(1, width / 2)}" fill="${color}"/>`,
    )
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    lines.join(''),
    '</svg>',
  ].join('')

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const buildLabel = ({
  note,
  geometry,
  offset,
}: {
  note: Note
  geometry: NoteGeometry
  offset: number
}): RenderedNote | null => {
  const anchor = geometryAnchor(geometry)
  const name = note.name.trim()
  if (!anchor || !name) return null

  return {
    id: note.id,
    kind: 'label',
    coordinates: anchor,
    options: {
      iconLayout: 'default#imageWithContent',
      iconImageHref: TRANSPARENT_PIXEL,
      iconImageSize: [1, 1],
      iconImageOffset: [-1, -1],
      iconContentOffset: [0, -offset],
      cursor: 'pointer',
    },
    properties: { noteId: note.id, iconContent: escapeXml(name) },
  }
}

/** Кольцо площадной фигуры: полигон, квадрат и круг приводятся к одному виду. */
export const polygonRing = (geometry: NoteGeometry): LonLat[] | null => {
  if (geometry.kind === 'Polygon') return geometry.coords
  if (geometry.kind === 'Square') return squareFromCorners(geometry.corners[0], geometry.corners[1])
  if (geometry.kind === 'Circle') return circleRing(geometry.center, geometry.radiusMeters)
  return null
}

/**
 * Собирает объекты для карты.
 *
 * Подпись — отдельный объект: у линий и полигонов нет своего текста, а у
 * точки подпись должна стоять рядом с иконкой, а не вместо неё.
 */
export const renderNote = ({
  note,
  geometry,
  group,
  selected,
  iconUrls = {},
}: RenderNoteInput): RenderedNote[] => {
  const style = resolveNoteStyle(note, group)
  const strokeColor = withOpacity(style.color, style.opacity)
  const strokeWidth = style.strokeWidth + (selected ? SELECTED_STROKE_BONUS : 0)
  const hintContent = escapeXml(note.name)
  const rendered: RenderedNote[] = []
  let labelOffset = LABEL_OFFSET_SHAPE

  if (geometry.kind === 'Point') {
    const fileIcon =
      note.icon?.kind === 'file' ? (iconUrls[note.icon.value] ?? undefined) : undefined

    rendered.push({
      id: note.id,
      kind: 'point',
      coordinates: geometry.coords,
      options: {
        cursor: 'pointer',
        hintContent,
        iconLayout: 'default#image',
        iconImageHref: fileIcon ?? buildPointIconHref(style),
        iconImageSize: [POINT_ICON_SIZE, POINT_ICON_SIZE],
        iconImageOffset: [-POINT_ICON_SIZE / 2, -POINT_ICON_SIZE / 2],
      },
      properties: { noteId: note.id, hintContent },
    })
    labelOffset = LABEL_OFFSET_POINT
  } else if (geometry.kind === 'Line') {
    rendered.push({
      id: note.id,
      kind: 'line',
      coordinates: geometry.coords,
      options: { cursor: 'pointer', hintContent, strokeColor, strokeWidth },
      properties: { noteId: note.id, hintContent },
    })
  } else {
    const ring = polygonRing(geometry) ?? []
    if (ring.length === 0) return rendered

    rendered.push({
      id: note.id,
      kind: 'polygon',
      coordinates: [ring],
      options: {
        cursor: 'pointer',
        hintContent,
        strokeColor,
        strokeWidth,
        fill: true,
        fillColor: withOpacity(style.fillColor ?? '#ffffff', style.opacity * 0.45),
        fillImageHref: buildHatchImageHref(style),
      },
      properties: { noteId: note.id, hintContent },
    })
  }

  if (note.showLabel) {
    const label = buildLabel({ note, geometry, offset: labelOffset })
    if (label) rendered.push(label)
  }

  return rendered
}

/** Объекты всех заметок снимка: без скрытых и без заметок без геометрии. */
export const renderNotes = ({
  notes,
  geometries,
  groups,
  hiddenIds,
  selectedId,
  iconUrls,
}: {
  notes: readonly Note[]
  geometries: Record<string, NoteGeometry>
  groups: readonly NoteGroup[]
  hiddenIds: readonly string[]
  selectedId: string | null
  iconUrls?: Record<string, string>
}): RenderedNote[] => {
  const hidden = new Set(hiddenIds)
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const rendered: RenderedNote[] = []

  for (const note of notes) {
    if (hidden.has(note.id)) continue
    const geometry = geometries[note.id]
    if (!geometry) continue

    rendered.push(
      ...renderNote({
        note,
        geometry,
        group: note.groupId ? (groupById.get(note.groupId) ?? null) : null,
        selected: selectedId === note.id,
        iconUrls,
      }),
    )
  }

  return rendered
}

/** Координаты всех видимых заметок: для «найти на карте» и кластеризации. */
export const collectVisibleCoordinates = (
  notes: readonly Note[],
  geometries: Record<string, NoteGeometry>,
  hiddenIds: readonly string[],
): [number, number][] => {
  const hidden = new Set(hiddenIds)
  return notes
    .filter((note) => !hidden.has(note.id) && geometries[note.id])
    .flatMap((note) => geometryCoordinates(geometries[note.id]))
}
