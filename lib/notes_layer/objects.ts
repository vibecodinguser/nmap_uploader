/**
 * Построение объектов карты из заметок.
 *
 * Здесь нет ни одного вызова ymaps: функция возвращает описание того, что надо
 * нарисовать. Так правила оформления тестируются без карты, а адаптер
 * (`NotesLayer`) остаётся тонким.
 */

import { buildBuiltinIconHref, findBuiltinIcon } from '@/lib/notes/icons'
import {
  circleRing,
  geometryAnchor,
  geometryCoordinates,
  squareFromCorners,
} from '@/lib/notes/model/geometry'
import { HATCH_LINE_WIDTH } from '@/lib/notes/model/palette'
import {
  type ResolvedNoteStyle,
  resolveNoteStyle,
  withOpacity,
} from '@/lib/notes/model/style_resolution'
import type { LonLat, Note, NoteGeometry, NoteGroup } from '@/lib/notes/model/types'
import { SIMPLIFY_MAX_ZOOM, simplifyRing } from './simplify'

export type RenderedKind = 'point' | 'line' | 'polygon' | 'label' | 'icon'

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
  /**
   * Текущий зум карты: от него зависит, сколько вершин контура нужно рисовать.
   * Без зума контур отдаётся целиком — так вызывают тесты и утилиты.
   */
  zoom?: number
}

export const SELECTED_STROKE_BONUS = 2
export const LABEL_MIN_ZOOM = 13

export const POINT_ICON_SIZE = 20
/** Иконка заметки крупнее кружка: глиф должен читаться на карте. */
export const NOTE_ICON_SIZE = 26
const LABEL_OFFSET_POINT = 20
const LABEL_OFFSET_SHAPE = 12

/** Прозрачная картинка 1×1 — основа подписи без иконки. */
export const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Ссылка на картинку иконки заметки.
 *
 * Встроенная иконка рисуется из реестра — общий источник с панелью. Файл
 * пользователя приходит готовым `data:`-URL в `iconUrls`: сам слой к Диску и
 * кэшу не обращается.
 */
const iconHrefOf = ({
  note,
  color,
  iconUrls,
}: {
  note: Note
  color: string
  iconUrls: Record<string, string>
}): string | null => {
  if (!note.icon) return null
  if (note.icon.kind === 'file') return iconUrls[note.icon.value] ?? null

  const icon = findBuiltinIcon(note.icon.value)
  return icon ? buildBuiltinIconHref({ icon, color }) : null
}

/**
 * Иконка точки: круг цвета заметки с белой обводкой.
 *
 * Рисуется как SVG-картинка, а не пресетом Яндекса: только так цвет совпадает
 * с остальными объектами. Прозрачность не применяется: у точки её нет в
 * интерфейсе, и полупрозрачная иконка осталась бы без способа это исправить.
 */
export const buildPointIconHref = (style: ResolvedNoteStyle): string => {
  const size = POINT_ICON_SIZE
  const radius = size / 2 - 3

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<circle cx="${size / 2}" cy="${size / 2}" r="${radius + 2}" fill="#ffffff" fill-opacity="0.9"/>`,
    `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="${style.color}"/>`,
    '</svg>',
  ].join('')

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * SVG-паттерн штриховки для `fillImageHref`.
 *
 * Прозрачность объекта учитывается в самом узоре: картинка-паттерн не
 * наследует `opacity` полигона, поэтому без этого штриховка оставалась бы
 * непрозрачной при любом значении ползунка.
 */
export const buildHatchImageHref = (style: ResolvedNoteStyle): string | undefined => {
  if (!style.hatch) return undefined
  // Узор рисуется цветом объекта: отдельный цвет штриховки спорил бы с обводкой.
  const { pattern } = style.hatch
  const width = HATCH_LINE_WIDTH
  const color = withOpacity(style.color, style.opacity)
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
 * Цвет заливки.
 *
 * Прозрачность заливки — половина прозрачности объекта: под полигоном должна
 * читаться карта. Если заливки нет, но есть штриховка, основа всё равно нужна
 * полупрозрачная, иначе Яндекс закрасит полигон сплошным цветом по умолчанию.
 */
export const buildFillColor = (style: ResolvedNoteStyle): string => {
  if (style.fillColor) return withOpacity(style.fillColor, style.opacity * 0.5)
  return style.hatch ? 'rgba(255, 255, 255, 0.001)' : 'rgba(0, 0, 0, 0)'
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
  zoom = SIMPLIFY_MAX_ZOOM + 1,
}: RenderNoteInput): RenderedNote[] => {
  const style = resolveNoteStyle(note, group)
  const strokeColor = withOpacity(style.color, style.opacity)
  const strokeWidth = style.strokeWidth + (selected ? SELECTED_STROKE_BONUS : 0)
  const hintContent = escapeXml(note.name)
  const rendered: RenderedNote[] = []
  let labelOffset = LABEL_OFFSET_SHAPE

  const iconHref = iconHrefOf({ note, color: style.color, iconUrls })

  if (geometry.kind === 'Point') {
    rendered.push({
      id: note.id,
      kind: 'point',
      coordinates: geometry.coords,
      options: {
        cursor: 'pointer',
        hintContent,
        iconLayout: 'default#image',
        iconImageHref: iconHref ?? buildPointIconHref(style),
        iconImageSize: iconHref
          ? [NOTE_ICON_SIZE, NOTE_ICON_SIZE]
          : [POINT_ICON_SIZE, POINT_ICON_SIZE],
        iconImageOffset: iconHref
          ? [-NOTE_ICON_SIZE / 2, -NOTE_ICON_SIZE / 2]
          : [-POINT_ICON_SIZE / 2, -POINT_ICON_SIZE / 2],
      },
      properties: { noteId: note.id, hintContent },
    })
    labelOffset = LABEL_OFFSET_POINT
  } else if (geometry.kind === 'Line') {
    rendered.push({
      id: note.id,
      kind: 'line',
      coordinates: simplifyRing({ coordinates: geometry.coords, zoom }),
      options: { cursor: 'pointer', hintContent, strokeColor, strokeWidth },
      properties: { noteId: note.id, hintContent },
    })
  } else {
    const ring = polygonRing(geometry) ?? []
    if (ring.length === 0) return rendered
    // На дальнем зуме вершины сливаются в пиксель: контур упрощается, чтобы
    // редактор не считал тысячи невидимых точек.
    const simplifiedRing = simplifyRing({ coordinates: ring, zoom })

    const hatchHref = buildHatchImageHref(style)

    rendered.push({
      id: note.id,
      kind: 'polygon',
      coordinates: [simplifiedRing],
      options: {
        cursor: 'pointer',
        hintContent,
        strokeColor,
        strokeWidth,
        fill: true,
        fillColor: buildFillColor(style),
        // Паттерн должен повторяться, а не растягиваться на весь полигон.
        ...(hatchHref ? { fillImageHref: hatchHref, fillMethod: 'tile' } : {}),
      },
      properties: { noteId: note.id, hintContent },
    })
  }

  // У линии и площадных фигур иконка стоит в центре отдельным объектом:
  // так заметка-полигон тоже получает видимую категорию.
  if (geometry.kind !== 'Point' && iconHref) {
    const anchor = geometryAnchor(geometry)
    if (anchor) {
      rendered.push({
        id: note.id,
        kind: 'icon',
        coordinates: anchor,
        options: {
          cursor: 'pointer',
          hintContent,
          iconLayout: 'default#image',
          iconImageHref: iconHref,
          iconImageSize: [NOTE_ICON_SIZE, NOTE_ICON_SIZE],
          iconImageOffset: [-NOTE_ICON_SIZE / 2, -NOTE_ICON_SIZE / 2],
        },
        properties: { noteId: note.id, hintContent },
      })
    }
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
  zoom,
}: {
  notes: readonly Note[]
  geometries: Record<string, NoteGeometry>
  groups: readonly NoteGroup[]
  hiddenIds: readonly string[]
  selectedId: string | null
  iconUrls?: Record<string, string>
  /** Текущий зум: от него зависит детализация контуров. */
  zoom?: number
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
        zoom,
      }),
    )
  }

  return rendered
}
