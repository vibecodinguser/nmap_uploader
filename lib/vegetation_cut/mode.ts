/**
 * Режим разреза растительности.
 *
 * Инструмент включается кнопкой в нативном тулбаре и живёт, пока пользователь
 * не выключит его повторным нажатием или клавишей Esc. Каждый клик по линии —
 * один разрез: элемент контура делится на две части (кольцо размыкается).
 * Клик мимо линии молча игнорируется.
 *
 * Логика отделена от DOM: сюда передаются редактор и способ получить карту,
 * поэтому поведение проверяется без живого НЯК.
 */

import type { CutElement, VegetationCutEditor } from './editor_bridge'
import {
  findNearestPointOnPolyline,
  isClosedLine,
  type LineCoordinates,
  type Point2,
  resolveCutCoordinates,
  segmentLengthMeters,
  splitLineAtCut,
} from './geometry'
import { isVegetationLineCategory } from './vegetation'

/** Допуск попадания клика по линии, пиксели. */
export const CUT_TOLERANCE_PX = 10

/** Минимальное расстояние от точки разреза до конца линии, метры. */
export const MIN_CUT_GAP_METERS = 1

export type CutOutcome =
  | 'cut'
  | 'miss'
  | 'too-short'
  | 'unsupported'
  | 'no-editor'
  | 'inactive'
  | 'not-vegetation'

export type CutMapLike = {
  getZoom?: () => number
  options?: { get?: (name: string) => unknown }
  converter?: { pageToGlobal?: (coords: number[]) => number[] }
}

type ProjectionLike = {
  toGlobalPixels: (coords: number[], zoom: number) => number[]
}

export type VegetationCutModeOptions = {
  /** Текущий редактор; `null`, когда редактор закрыт. */
  getEditor: () => VegetationCutEditor | null
  /** Допуск попадания в пикселях; по умолчанию `CUT_TOLERANCE_PX`. */
  tolerancePx?: number
  /** Сообщение о результате для интерфейса. */
  onOutcome?: (outcome: CutOutcome) => void
}

const readProjection = (map: CutMapLike): ProjectionLike | null => {
  try {
    const projection = map.options?.get?.('projection')
    if (projection && typeof projection === 'object') {
      const candidate = projection as ProjectionLike
      if (typeof candidate.toGlobalPixels === 'function') return candidate
    }
  } catch {
    // Карта могла быть уничтожена
  }
  return null
}

const readZoom = (map: CutMapLike): number => {
  try {
    const zoom = map.getZoom?.()
    return typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : 0
  } catch {
    return 0
  }
}

const projectLine = (line: LineCoordinates, projection: ProjectionLike, zoom: number): Point2[] => {
  const result: Point2[] = []
  for (const point of line) {
    const projected = projection.toGlobalPixels(point, zoom)
    result.push([Number(projected[0]), Number(projected[1])])
  }
  return result
}

export class VegetationCutMode {
  private active = false
  private readonly options: VegetationCutModeOptions

  constructor(options: VegetationCutModeOptions) {
    this.options = options
  }

  public isActive(): boolean {
    return this.active
  }

  /** Включает или выключает режим. Возвращает новое состояние. */
  public toggle(): boolean {
    this.active = !this.active
    return this.active
  }

  public start(): void {
    this.active = true
  }

  public stop(): void {
    this.active = false
  }

  /**
   * Обрабатывает клик по карте в глобальных пикселях.
   *
   * Возвращает исход, чтобы вызывающий код мог показать сообщение; сам режим
   * побочных эффектов, кроме правки элемента, не имеет.
   */
  public handleClick(globalPixels: Point2): CutOutcome {
    const outcome = this.resolveCut(globalPixels)
    this.options.onOutcome?.(outcome)
    return outcome
  }

  private resolveCut(globalPixels: Point2): CutOutcome {
    const editor = this.options.getEditor()
    if (!editor) return 'no-editor'

    if (!isVegetationLineCategory(editor.getElementCategoryId())) return 'not-vegetation'

    const elements = editor.getElements()
    if (elements.length === 0) return 'not-vegetation'

    const map = editor.getMap()
    if (!map) return 'no-editor'

    const projection = readProjection(map)
    if (!projection) return 'no-editor'

    if (!editor.canCut()) return 'unsupported'

    const tolerance = this.options.tolerancePx ?? CUT_TOLERANCE_PX
    const zoom = readZoom(map)
    const nearest = findNearestElement(elements, globalPixels, projection, zoom, tolerance)
    if (!nearest) return 'miss'

    const { element, segmentIndex, ratio } = nearest
    const cut = { segmentIndex, ratio, distance: 0 }

    const parts = splitLineAtCut(element.coordinates, cut)
    if (!parts) return 'too-short'

    if (isTooCloseToEnds(element, resolveCutCoordinates(element.coordinates, cut))) {
      return 'too-short'
    }

    return editor.applyCut(element.id, parts) ? 'cut' : 'unsupported'
  }
}

type NearestElement = {
  element: CutElement
  segmentIndex: number
  ratio: number
}

const findNearestElement = (
  elements: CutElement[],
  globalPixels: Point2,
  projection: ProjectionLike,
  zoom: number,
  tolerance: number,
): NearestElement | null => {
  let best: NearestElement | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const element of elements) {
    const pixels = projectLine(element.coordinates, projection, zoom)
    const nearest = findNearestPointOnPolyline(pixels, globalPixels)
    if (!nearest || nearest.distance > tolerance) continue
    if (nearest.distance < bestDistance) {
      bestDistance = nearest.distance
      best = { element, segmentIndex: nearest.segmentIndex, ratio: nearest.ratio }
    }
  }

  return best
}

/** Разрез у самого конца линии даёт обрубок, который нельзя редактировать. */
const isTooCloseToEnds = (element: CutElement, point: number[]): boolean => {
  if (element.closed || isClosedLine(element.coordinates)) return false
  const start = element.coordinates[0]
  const end = element.coordinates[element.coordinates.length - 1]
  return (
    segmentLengthMeters(start, point) < MIN_CUT_GAP_METERS ||
    segmentLengthMeters(end, point) < MIN_CUT_GAP_METERS
  )
}

/** Извлекает глобальные пиксели клика из события карты. */
export const readClickGlobalPixels = (
  event: { get?: (key: string) => unknown },
  map: CutMapLike,
): Point2 | null => {
  const globalPixels = event.get?.('globalPixels')
  if (Array.isArray(globalPixels) && globalPixels.length === 2) {
    return [Number(globalPixels[0]), Number(globalPixels[1])]
  }

  const pagePixels = event.get?.('pagePixels')
  if (Array.isArray(pagePixels) && pagePixels.length === 2) {
    const converter = map.converter
    if (converter?.pageToGlobal) {
      const converted = converter.pageToGlobal([Number(pagePixels[0]), Number(pagePixels[1])])
      if (Array.isArray(converted) && converted.length === 2) {
        return [Number(converted[0]), Number(converted[1])]
      }
    }
  }

  return null
}
