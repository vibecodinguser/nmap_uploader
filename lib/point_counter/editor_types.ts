/**
 * Типы и константы редактора геометрии НЯК, общие для подсчёта вершин.
 *
 * Описывают только те части API редактора, которые нужны счётчику: модель колец,
 * карту, состояние и менеджеры событий.
 */

export type RingCoordinates = number[][]
export type PixelPoint = [number, number]

export type YmapsEventLike = {
  get: (key: string) => unknown
}

export type YmapsEventsLike = {
  add: (event: string, handler: (...args: never[]) => void) => void
  remove: (event: string, handler: (...args: never[]) => void) => void
}

export type EditorRingLike = {
  geometry: {
    getCoordinates: () => RingCoordinates
  }
}

export type EditorModelLike = {
  getPathModels?: () => EditorRingLike[]
  getAllVerticesNumber?: () => number
}

export type ProjectionLike = {
  toGlobalPixels: (coords: number[], zoom: number) => number[]
}

export type EditorMapLike = {
  events: YmapsEventsLike
  getZoom?: () => number
  converter?: { pageToGlobal?: (coords: number[]) => number[] }
  options?: { get: (name: string) => unknown }
}

export type EditorGeometryLike = {
  getType?: () => string
  getMap?: () => EditorMapLike | null
  events?: YmapsEventsLike
}

export type EditorStateLike = {
  get: (key: string) => unknown
  events?: YmapsEventsLike
}

export type GeometryEditorLike = {
  state: EditorStateLike
  geometry: EditorGeometryLike
  getModel?: () => PromiseLike<EditorModelLike> | EditorModelLike
  options?: { get: (name: string) => unknown }
  events?: YmapsEventsLike
  _subEditors?: Record<string, { editor?: GeometryEditorLike } | null | undefined>
}

/** Ключи состояния редактора. */
export const DRAWING_STATE = 'drawing'
export const DRAWING_PATH_STATE = 'drawingPath'

/** Опция, помечающая редактор как часть составного объекта. */
export const DEPENDED_EDITOR_OPTION = 'editorIsDependedInstance'

/** Типы геометрии, с которыми работает счётчик. */
export const POLYGON_TYPE = 'Polygon'
export const LINE_TYPE = 'LineString'
export const POINT_TYPE = 'Point'
export const MULTI_POLYGON_TYPE = 'MultiPolygon'
