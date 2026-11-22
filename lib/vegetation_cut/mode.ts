/**
 * Режим разреза растительности.
 *
 * Инструмент включается кнопкой в нативном тулбаре и живёт, пока пользователь
 * не выключит его повторным нажатием или клавишей Esc. Каждый клик по линии —
 * один разрез: элемент контура делится на две части. Клик мимо линии молча
 * игнорируется.
 *
 * У замкнутой линии границ частей ещё нет, поэтому ей нужны два клика: первый
 * ставит первую границу (линия начинается и заканчивается в этой точке),
 * второй делит линию на две части между двумя кликами.
 *
 * Логика отделена от DOM: сюда передаются редактор и способ получить карту,
 * поэтому поведение проверяется без живого НЯК.
 */

import type { CutElement, VegetationCutEditor } from './editor_bridge'
import {
  findNearestPointOnPolyline,
  isClosedLine,
  isSamePoint,
  type LineCoordinates,
  type Point2,
  resolveCutCoordinates,
  segmentLengthMeters,
  splitLineAtCut,
  splitRingInTwo,
} from './geometry'
import { isVegetationLineCategory } from './vegetation'

/** Допуск попадания клика по линии, пиксели. */
export const CUT_TOLERANCE_PX = 10

/** Минимальное расстояние от точки разреза до конца линии, метры. */
export const MIN_CUT_GAP_METERS = 1

/**
 * Допуск при сверке начала линии с запомненной первой границей, градусы
 * (доли миллиметра): редактор мог пересчитать координаты при записи.
 */
const SEAM_MATCH_EPS = 1e-9

export type CutOutcome =
  | 'cut'
  /** На замкнутой линии поставлена первая граница; делить её будет следующий клик. */
  | 'opened'
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
  /**
   * Первые границы, поставленные на замкнутых линиях: id элемента → точка.
   *
   * Линия с первой границей по координатам неотличима от нетронутого кольца,
   * поэтому точку приходится помнить. Запись действует, только пока линия
   * начинается в этой точке: после отмены в редакторе начало другое, и
   * следующий клик снова ставит первую границу.
   */
  private readonly ringSeams = new Map<string, number[]>()

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

  /** Забывает первые границы замкнутых линий: редактор закрыт, объекты уже другие. */
  public forgetRingSeams(): void {
    this.ringSeams.clear()
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

    if (isClosedLine(element.coordinates)) {
      return this.cutRing(editor, element, cut)
    }

    const parts = splitLineAtCut(element.coordinates, cut)
    if (!parts) return 'too-short'

    if (isTooCloseToEnds(element, resolveCutCoordinates(element.coordinates, cut))) {
      return 'too-short'
    }

    return editor.applyCut(element.id, parts) ? 'cut' : 'unsupported'
  }

  /** Замкнутая линия: первый клик ставит первую границу, второй делит надвое. */
  private cutRing(
    editor: VegetationCutEditor,
    element: CutElement,
    cut: { segmentIndex: number; ratio: number; distance: number },
  ): CutOutcome {
    const seam = this.ringSeams.get(element.id)
    const hasFirstBoundary =
      seam !== undefined && isSamePoint(seam, element.coordinates[0], SEAM_MATCH_EPS)

    if (hasFirstBoundary) {
      const parts = splitRingInTwo(element.coordinates, cut)
      if (!parts) return 'too-short'

      const point = resolveCutCoordinates(element.coordinates, cut)
      if (segmentLengthMeters(seam, point) < MIN_CUT_GAP_METERS) return 'too-short'

      // Запись о первой границе остаётся: после отмены деления линия снова
      // начинается в этой точке, и её можно разделить одним кликом.
      return editor.applyCut(element.id, parts) ? 'cut' : 'unsupported'
    }

    const parts = splitLineAtCut(element.coordinates, cut)
    if (!parts) return 'too-short'

    // Клик по началу линии ничего в ней не меняет: границей становится само
    // начало, а пустой шаг в истории редактора не нужен.
    const alreadyStartsHere = isSamePoint(parts[0][0], element.coordinates[0], SEAM_MATCH_EPS)
    if (!alreadyStartsHere && !editor.applyCut(element.id, parts)) return 'unsupported'

    this.ringSeams.set(element.id, parts[0][0].slice())
    return 'opened'
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
