/**
 * Режим разреза линейных объектов: растительности и водоёмов.
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

import type { CutEditor, CutElement } from './editor_bridge'
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
import { isLineCategory } from './targets'

/** Допуск попадания клика по линии, пиксели. */
const CUT_TOLERANCE_PX = 10

/** Минимальное расстояние от точки разреза до конца линии, метры. */
const MIN_CUT_GAP_METERS = 1

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
  | 'not-target'

export type CutMapLike = {
  getZoom?: () => number
  options?: { get?: (name: string) => unknown }
  converter?: { pageToGlobal?: (coords: number[]) => number[] }
  container?: { getElement?: () => Element | null }
}

type ProjectionLike = {
  toGlobalPixels: (coords: number[], zoom: number) => number[]
}

type CutModeOptions = {
  /** Текущий редактор; `null`, когда редактор закрыт. */
  getEditor: () => CutEditor | null
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

/**
 * Достаёт настоящую карту из того, что отдаёт редактор.
 *
 * `attrs.map` — обёртка `map-service`: у неё нет `events` и проекции, поэтому
 * клик по карте к ней не подписать. Настоящий `ymaps.Map` лежит внутри и
 * доступен через `getYMap()`. Если обёртки нет или она не отдала карту,
 * возвращаем то, что пришло: вызывающий код проверит нужные ему поля.
 */
export const unwrapYMap = (map: CutMapLike | null | undefined): CutMapLike | null => {
  if (!map || typeof map !== 'object') return null

  const wrapper = map as CutMapLike & { getYMap?: () => CutMapLike | null }
  if (typeof wrapper.getYMap === 'function') {
    try {
      const inner = wrapper.getYMap()
      if (inner && typeof inner === 'object') return inner
    } catch {
      // Обёртка могла быть уничтожена
    }
  }

  return map
}

const projectLine = (line: LineCoordinates, projection: ProjectionLike, zoom: number): Point2[] => {
  const result: Point2[] = []
  for (const point of line) {
    const projected = projection.toGlobalPixels(point, zoom)
    result.push([Number(projected[0]), Number(projected[1])])
  }
  return result
}

export class CutMode {
  private active = false
  private readonly options: CutModeOptions
  /**
   * Первые границы, поставленные на замкнутых линиях: id элемента → точка.
   *
   * Линия с первой границей по координатам неотличима от нетронутого кольца,
   * поэтому точку приходится помнить. Запись действует, только пока линия
   * начинается в этой точке: после отмены в редакторе начало другое, и
   * следующий клик снова ставит первую границу.
   */
  private readonly ringSeams = new Map<string, number[]>()
  /**
   * Точки разрезов этой сессии: их показывает слой маркеров.
   *
   * Копятся, потому что нативный редактор тоже отмечает каждую точку разреза,
   * а не только последнюю. Живут до выключения режима или закрытия редактора.
   */
  private readonly cutPoints: number[][] = []

  constructor(options: CutModeOptions) {
    this.options = options
  }

  public isActive(): boolean {
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
    this.cutPoints.length = 0
  }

  /** Точки разрезов этой сессии — для маркеров на карте. */
  public getCutPoints(): number[][] {
    return this.cutPoints.map((point) => point.slice())
  }

  /**
   * Забывает точки разрезов, не трогая первые границы колец.
   *
   * Маркеры — наша подсветка, а не часть документа: при выключении режима они
   * снимаются. Первые границы при этом остаются, иначе после повторного
   * включения второй клик снова ставил бы границу вместо деления.
   */
  public forgetCutPoints(): void {
    this.cutPoints.length = 0
  }

  private rememberCutPoint(point: number[]): void {
    this.cutPoints.push(point.slice())
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

    const target = editor.getTarget()
    if (!target || !isLineCategory(target, editor.getElementCategoryId())) return 'not-target'

    const elements = editor.getElements()
    if (elements.length === 0) return 'not-target'

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

    const point = resolveCutCoordinates(element.coordinates, cut)
    if (isTooCloseToEnds(element, point)) {
      return 'too-short'
    }

    if (!editor.applyCut(element.id, parts)) return 'unsupported'
    this.rememberCutPoint(point)
    return 'cut'
  }

  /** Замкнутая линия: первый клик ставит первую границу, второй делит надвое. */
  private cutRing(
    editor: CutEditor,
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
      if (!editor.applyCut(element.id, parts)) return 'unsupported'
      this.rememberCutPoint(point)
      return 'cut'
    }

    const parts = splitLineAtCut(element.coordinates, cut)
    if (!parts) return 'too-short'

    // Клик по началу линии ничего в ней не меняет: границей становится само
    // начало, а пустой шаг в истории редактора не нужен.
    const alreadyStartsHere = isSamePoint(parts[0][0], element.coordinates[0], SEAM_MATCH_EPS)
    if (!alreadyStartsHere && !editor.applyCut(element.id, parts)) return 'unsupported'

    this.ringSeams.set(element.id, parts[0][0].slice())
    this.rememberCutPoint(parts[0][0])
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

/** Переводит точку страницы в глобальные пиксели карты. */
export const readPageGlobalPixels = (map: CutMapLike, pagePoint: Point2): Point2 | null => {
  try {
    const converted = map.converter?.pageToGlobal?.(pagePoint)
    if (!Array.isArray(converted) || converted.length !== 2) return null
    const point: Point2 = [Number(converted[0]), Number(converted[1])]
    return Number.isFinite(point[0]) && Number.isFinite(point[1]) ? point : null
  } catch {
    // Карта могла быть уничтожена
    return null
  }
}
