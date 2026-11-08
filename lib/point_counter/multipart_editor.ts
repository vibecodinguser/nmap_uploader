/**
 * Подсчёт вершин активной части многочастного объекта в редакторе НЯК.
 *
 * Редактор Народной карты не помечает активную часть в DOM: и геометрия, и ручки вершин
 * рисуются на canvas. Единственный достоверный источник — модель редактора:
 * - одиночный `Polygon` (контур с внутренними кольцами) считает активное кольцо;
 * - `MultiPolygon` считает активную часть (ту, что рисуется, иначе ту, по которой кликнули);
 * - `MultiLineString`, `MultiPoint` и смешанные объекты не считаются вовсе — суммарное число
 *   по отрезкам не имеет смысла, поэтому счётчик скрывается.
 *
 * Одночастные полигоны и одиночные линии обслуживают прежние canvas/SVG-источники.
 */

import { isContourSelectionActive } from './contour_selection'
import {
  markGeometryEditorDrawing,
  markGeometryEditorEditing,
  setCounterSuppressed,
  setEditorHooksReady,
  setModelCounterActive,
} from './counter_source'
import type { PointCounterUi } from './dom_ui'

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

const DRAWING_STATE = 'drawing'
const DRAWING_PATH_STATE = 'drawingPath'
const DEPENDED_EDITOR_OPTION = 'editorIsDependedInstance'
const MIN_MULTIPART_RINGS = 2
const POLYGON_TYPE = 'Polygon'
const LINE_TYPE = 'LineString'
const POINT_TYPE = 'Point'
const MULTI_POLYGON_TYPE = 'MultiPolygon'

const isSamePoint = (left: number[], right: number[]): boolean =>
  left[0] === right[0] && left[1] === right[1]

/** Проверяет, что кольцо замкнуто (первая и последняя точки совпадают). */
export const isClosedRing = (coords: RingCoordinates): boolean =>
  coords.length > 1 && isSamePoint(coords[0], coords[coords.length - 1])

/**
 * Считает вершины кольца.
 *
 * В модели редактора замкнутое кольцо хранит замыкающую точку, а при рисовании добавляется
 * ещё и «резиновая» вершина под курсором — обе не являются поставленными вершинами.
 */
export const countRingVertices = (coords: RingCoordinates, isDrawing = false): number => {
  if (coords.length === 0) return 0

  const closingPoint = isClosedRing(coords) ? 1 : 0
  const cursorPoint = isDrawing ? 1 : 0

  return Math.max(0, coords.length - closingPoint - cursorPoint)
}

/** Площадь кольца в пикселях (нужна, чтобы выбрать самый внутренний контур). */
export const getRingArea = (ring: PixelPoint[]): number => {
  if (ring.length < 3) return 0

  let sum = 0
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index]
    const next = ring[index + 1]
    sum += current[0] * next[1] - next[0] * current[1]
  }

  return Math.abs(sum) / 2
}

/** Проверяет попадание точки в кольцо (алгоритм ray casting). */
export const isPointInRing = (point: PixelPoint, ring: PixelPoint[]): boolean => {
  if (ring.length < 3) return false

  let inside = false
  for (
    let current = 0, previous = ring.length - 1;
    current < ring.length;
    previous = current, current += 1
  ) {
    const [currentX, currentY] = ring[current]
    const [previousX, previousY] = ring[previous]
    const crossesHorizontalRay = currentY > point[1] !== previousY > point[1]
    if (!crossesHorizontalRay) continue

    const intersectionX =
      ((previousX - currentX) * (point[1] - currentY)) / (previousY - currentY) + currentX
    if (point[0] < intersectionX) inside = !inside
  }

  return inside
}

/**
 * Возвращает индекс самого внутреннего кольца, содержащего точку.
 * Для внешнего контура с дыркой это даёт дырку, для вложенных контуров — меньший по площади.
 */
export const findInnermostRingIndex = (point: PixelPoint, rings: PixelPoint[][]): number | null => {
  let bestIndex: number | null = null
  let bestArea = Number.POSITIVE_INFINITY

  rings.forEach((ring, index) => {
    if (!isPointInRing(point, ring)) return
    const area = getRingArea(ring)
    if (area < bestArea) {
      bestArea = area
      bestIndex = index
    }
  })

  return bestIndex
}

/** Переводит кольцо географических координат в пиксели карты. */
export const projectRingToPixels = (
  coords: RingCoordinates,
  projection: ProjectionLike,
  zoom: number,
): PixelPoint[] => coords.map((coord) => projection.toGlobalPixels(coord, zoom) as PixelPoint)

/** Извлекает пиксельные координаты клика из события карты. */
export const readClickPixels = (event: YmapsEventLike, map: EditorMapLike): PixelPoint | null => {
  const globalPixels = event.get('globalPixels')
  if (Array.isArray(globalPixels) && globalPixels.length === 2) {
    return [Number(globalPixels[0]), Number(globalPixels[1])]
  }

  const pagePixels = event.get('pagePixels')
  if (Array.isArray(pagePixels) && pagePixels.length === 2 && map.converter?.pageToGlobal) {
    const converted = map.converter.pageToGlobal([Number(pagePixels[0]), Number(pagePixels[1])])
    if (Array.isArray(converted) && converted.length === 2) {
      return [Number(converted[0]), Number(converted[1])]
    }
  }

  return null
}

/** Возвращает кольца (контуры) модели многоугольника. */
export const readModelRings = (model: EditorModelLike | null): RingCoordinates[] => {
  if (!model || typeof model.getPathModels !== 'function') return []
  try {
    return model.getPathModels().map((ring) => ring.geometry.getCoordinates())
  } catch {
    return []
  }
}

/** Читает дочерние редакторы многочастного объекта. */
export const readChildEditors = (editor: GeometryEditorLike | null): GeometryEditorLike[] => {
  const subEditors = editor?._subEditors
  if (!subEditors || typeof subEditors !== 'object') return []

  const result: GeometryEditorLike[] = []
  for (const entry of Object.values(subEditors)) {
    if (entry?.editor) result.push(entry.editor)
  }
  return result
}

/** Редактор создан как зависимая часть многочастного объекта. */
export const isDependentEditor = (editor: GeometryEditorLike | null): boolean => {
  if (!editor?.options || typeof editor.options.get !== 'function') return false
  try {
    return Boolean(editor.options.get(DEPENDED_EDITOR_OPTION))
  } catch {
    return false
  }
}

/**
 * Проверяет, что редактируемый линейный объект состоит из нескольких отрезков.
 *
 * Объект берётся из опций редактора, а если редактор открыт для отдельной части —
 * ищется по карте: сравниваются геометрии частей с геометрией редактора.
 */
export const isMultiSegmentLinearObject = (
  editor: GeometryEditorLike | null,
  map?: EditorMapLike | null,
): boolean => {
  const owningType = readOwningGeometryType(editor, map)
  // Обычная линия состоит из одной цепочки точек, составная — из нескольких отрезков.
  return Boolean(owningType && owningType !== LINE_TYPE)
}

type GeometryLike = {
  getType?: () => string
  getLength?: () => number
  getChildGeometry?: (index: number) => unknown
}

type GeoObjectLike = {
  geometry?: GeometryLike
}

/** Определяет тип геометрии объекта, которому принадлежит редактор. */
export const readOwningGeometryType = (
  editor: GeometryEditorLike | null,
  map?: EditorMapLike | null,
): string | null => {
  if (!editor) return null

  const optionGeoObject = readOptionGeoObject(editor)
  const optionType = optionGeoObject?.geometry?.getType?.()
  if (optionType) return optionType

  const editorGeometry = (editor.geometry as GeometryLike | undefined) ?? null
  if (!editorGeometry) return null

  const geoObjects = readMapGeoObjects(map)
  for (const geoObject of geoObjects) {
    const geometry = geoObject?.geometry
    const type = geometry?.getType?.()
    if (!type || type === LINE_TYPE) continue
    if (geometry === editorGeometry) return type

    const length = typeof geometry?.getLength === 'function' ? geometry.getLength() : 0
    for (let index = 0; index < length; index += 1) {
      if (geometry?.getChildGeometry?.(index) === editorGeometry) return type
    }
  }

  return null
}

const readOptionGeoObject = (editor: GeometryEditorLike): GeoObjectLike | null => {
  try {
    const value = editor.options?.get?.('geoObject')
    return value && typeof value === 'object' ? (value as GeoObjectLike) : null
  } catch {
    return null
  }
}

const readMapGeoObjects = (map?: EditorMapLike | null): GeoObjectLike[] => {
  const collection = (map as { geoObjects?: unknown } | null | undefined)?.geoObjects
  if (!collection || typeof collection !== 'object') return []

  const result: GeoObjectLike[] = []
  try {
    const each = (collection as { each?: (cb: (object: unknown) => void) => void }).each
    if (typeof each === 'function') {
      each.call(collection, (object: unknown) => {
        if (object && typeof object === 'object') result.push(object as GeoObjectLike)
      })
      return result
    }
  } catch {
    // Коллекция могла быть изменена во время обхода
  }

  return result
}

export interface MultipartEditorCounterOptions {
  ui: PointCounterUi
  isEnabled?: () => boolean
}

export type EditorHookHandlers = {
  /** Запуск обычного (не составного) редактора. */
  onStart: (editor: GeometryEditorLike) => void
  /** Запуск составного редактора (`MultiGeometry`). */
  onMultiStart?: (editor: GeometryEditorLike) => void
  /** Остановка любого редактора. */
  onStop: (editor: GeometryEditorLike) => void
}

const BASE_HOOK_MARKER = '__nmapPointCounterEditorHooked__'
const MULTI_HOOK_MARKER = '__nmapPointCounterMultiEditorHooked__'

type HookRegistry = { handlers: EditorHookHandlers }

/** Редакторы, за состоянием которых уже следим. */
const trackedEditors = new WeakSet<object>()

/**
 * Следит за состоянием конкретного редактора: редактирует / рисует.
 * Нужно, чтобы canvas-подсчёт включался только при активном рисовании.
 */
const trackEditorState = (editor: GeometryEditorLike): void => {
  if (!editor || typeof editor !== 'object') return
  if (trackedEditors.has(editor)) {
    markGeometryEditorDrawing(editor, editor.state?.get?.('drawing') === true)
    return
  }
  trackedEditors.add(editor)

  markGeometryEditorDrawing(editor, editor.state?.get?.('drawing') === true)

  const events = editor.state?.events
  if (!events || typeof events.add !== 'function') return

  try {
    events.add('change', () => {
      markGeometryEditorDrawing(editor, editor.state?.get?.('drawing') === true)
    })
  } catch {
    // Состояние могло быть уничтожено вместе с редактором
  }
}

/**
 * Пока составной редактор запускает дочерние, их запуск не должен трактоваться
 * как запуск обычного одиночного редактора.
 */
let multiStartupDepth = 0

const installEditorHook = (
  Base: unknown,
  marker: string,
  handlers: EditorHookHandlers,
  selectStart: (current: EditorHookHandlers) => ((editor: GeometryEditorLike) => void) | undefined,
): boolean => {
  if (typeof Base !== 'function') return false

  const proto = (Base as { prototype?: Record<string, unknown> }).prototype
  if (!proto) return false

  const existingRegistry = proto[marker] as HookRegistry | undefined
  if (existingRegistry) {
    existingRegistry.handlers = handlers
    setEditorHooksReady(true)
    return true
  }

  const originalStart = proto.startEditing
  const originalStop = proto.stopEditing
  if (typeof originalStart !== 'function' || typeof originalStop !== 'function') return false

  const originalStartDrawing = proto.startDrawing
  const registry: HookRegistry = { handlers }
  proto[marker] = registry

  const notifyStart = (editor: GeometryEditorLike): void => {
    markGeometryEditorEditing(editor, true)
    trackEditorState(editor)
    const handler = selectStart(registry.handlers)
    if (!handler) return
    try {
      handler(editor)
    } catch {
      // Подсчёт не должен ломать запуск редактора
    }
  }

  proto.startEditing = function (this: GeometryEditorLike, ...args: unknown[]) {
    const result = Reflect.apply(originalStart, this, args)
    notifyStart(this)
    return result
  }

  if (typeof originalStartDrawing === 'function') {
    proto.startDrawing = function (this: GeometryEditorLike, ...args: unknown[]) {
      const result = Reflect.apply(originalStartDrawing, this, args)
      notifyStart(this)
      return result
    }
  }

  proto.stopEditing = function (this: GeometryEditorLike, ...args: unknown[]) {
    markGeometryEditorEditing(this, false)
    try {
      registry.handlers.onStop(this)
    } catch {
      // Подсчёт не должен ломать остановку редактора
    }
    return Reflect.apply(originalStop, this, args)
  }

  setEditorHooksReady(true)

  return true
}

/**
 * Патчит прототип базового редактора геометрии, чтобы получать экземпляры одиночных редакторов.
 * Возвращает true, если прототип уже был обработан (или обработан сейчас).
 */
export const hookGeometryEditorPrototype = (Base: unknown, handlers: EditorHookHandlers): boolean =>
  installEditorHook(Base, BASE_HOOK_MARKER, handlers, (current) => (editor) => {
    if (multiStartupDepth > 0) return
    current.onStart(editor)
  })

/**
 * Патчит прототип составного редактора (`MultiGeometry`), чтобы знать о многочастных объектах.
 * Возвращает true, если прототип уже был обработан (или обработан сейчас).
 */
export const hookMultiGeometryPrototype = (
  MultiGeometry: unknown,
  handlers: EditorHookHandlers,
): boolean => {
  if (typeof MultiGeometry !== 'function') return false

  const proto = (MultiGeometry as { prototype?: Record<string, unknown> }).prototype
  if (!proto) return false

  const existingRegistry = proto[MULTI_HOOK_MARKER] as HookRegistry | undefined
  if (existingRegistry) {
    existingRegistry.handlers = handlers
    setEditorHooksReady(true)
    return true
  }

  const originalStart = proto.startEditing
  const originalStop = proto.stopEditing
  if (typeof originalStart !== 'function' || typeof originalStop !== 'function') return false

  const originalStartDrawing = proto.startDrawing
  const registry: HookRegistry = { handlers }
  proto[MULTI_HOOK_MARKER] = registry

  const notifyStart = (editor: GeometryEditorLike): void => {
    markGeometryEditorEditing(editor, true)
    trackEditorState(editor)
    try {
      registry.handlers.onMultiStart?.(editor)
    } catch {
      // Подсчёт не должен ломать запуск редактора
    }
  }

  const runDuringMultiStartup = <T>(action: () => T): T => {
    multiStartupDepth += 1
    try {
      return action()
    } finally {
      multiStartupDepth -= 1
    }
  }

  proto.startEditing = function (this: GeometryEditorLike, ...args: unknown[]) {
    const result = runDuringMultiStartup(() => Reflect.apply(originalStart, this, args))
    notifyStart(this)
    return result
  }

  if (typeof originalStartDrawing === 'function') {
    proto.startDrawing = function (this: GeometryEditorLike, ...args: unknown[]) {
      const result = runDuringMultiStartup(() => Reflect.apply(originalStartDrawing, this, args))
      notifyStart(this)
      return result
    }
  }

  proto.stopEditing = function (this: GeometryEditorLike, ...args: unknown[]) {
    markGeometryEditorEditing(this, false)
    try {
      registry.handlers.onStop(this)
    } catch {
      // Подсчёт не должен ломать остановку редактора
    }
    return Reflect.apply(originalStop, this, args)
  }

  setEditorHooksReady(true)

  return true
}

export type YmapsModulesLike = {
  require?: (
    modules: string[],
    successCallback: (...modules: unknown[]) => void,
    errorCallback?: () => void,
  ) => void
}

export const EDITOR_HOOK_POLL_MS = 500
export const EDITOR_HOOK_TIMEOUT_MS = 30_000

const defaultGetYmaps = (): unknown => (globalThis as Record<string, unknown>).ymaps

/**
 * Дожидается загрузки ymaps и подписывается на запуск редакторов геометрии.
 * Возвращает функцию очистки.
 */
export const installGeometryEditorHook = (
  handlers: EditorHookHandlers,
  options: {
    getYmaps?: () => unknown
    pollMs?: number
    timeoutMs?: number
  } = {},
): (() => void) => {
  const getYmaps = options.getYmaps ?? defaultGetYmaps
  const pollMs = options.pollMs ?? EDITOR_HOOK_POLL_MS
  const timeoutMs = options.timeoutMs ?? EDITOR_HOOK_TIMEOUT_MS

  let cancelled = false
  let hooked = false
  let requested = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const startedAt = Date.now()

  const requestHook = (ymaps: unknown): void => {
    if (requested || hooked) return
    const modules = (ymaps as { modules?: YmapsModulesLike } | null)?.modules
    if (!modules || typeof modules.require !== 'function') return

    requested = true
    try {
      modules.require(
        ['geometryEditor.Base', 'geometryEditor.MultiGeometry'],
        (Base, MultiGeometry) => {
          if (cancelled) return
          const baseHooked = hookGeometryEditorPrototype(Base, handlers)
          const multiHooked = hookMultiGeometryPrototype(MultiGeometry, handlers)
          hooked = baseHooked || multiHooked
          if (!hooked) requested = false
        },
      )
    } catch {
      requested = false
    }
  }

  const poll = (): void => {
    if (cancelled || hooked) return

    const ymaps = getYmaps()
    if (ymaps) requestHook(ymaps)

    if (cancelled || hooked) return
    if (Date.now() - startedAt >= timeoutMs) return

    timer = setTimeout(poll, pollMs)
  }

  poll()

  return () => {
    cancelled = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
}

type CounterMode = 'off' | 'count' | 'pending' | 'suppress'

type EditorPart = {
  editor: GeometryEditorLike
  model: EditorModelLike
}

/**
 * Счётчик вершин активной части многочастного объекта.
 *
 * Для полигонов считает активную часть, для объектов с линиями — скрывает счётчик целиком.
 */
export class MultipartEditorCounter {
  private root: GeometryEditorLike | null = null
  private isMulti = false
  private mode: CounterMode = 'off'
  private parts: EditorPart[] = []
  private activePart: number | null = null
  private activeRing: number | null = null
  private map: EditorMapLike | null = null
  private loadGeneration = 0
  private cleanupHook: (() => void) | null = null
  private readonly rootListeners: Array<() => void> = []
  private readonly childListeners: Array<() => void> = []
  private readonly ui: PointCounterUi
  private readonly isEnabled?: () => boolean

  /**
   * Объект открыт экраном «Выберите контур для редактирования».
   * Такой объект состоит из нескольких самостоятельных отрезков: их суммарное число
   * не имеет смысла, поэтому счётчик скрыт и после выбора контура.
   */
  private contourFlowLatched = false
  /** Приглашение выбора контура уже отработало: не цепляемся к «зависшему» уведомлению. */
  private promptDismissed = false
  private promptObserver: MutationObserver | null = null
  private promptCheckTimer: number | null = null

  constructor({ ui, isEnabled }: MultipartEditorCounterOptions) {
    this.ui = ui
    this.isEnabled = isEnabled
  }

  /** Подписывается на запуск редакторов геометрии. Возвращает функцию очистки. */
  public start(): () => void {
    this.stop()
    this.cleanupHook = installGeometryEditorHook({
      onStart: (editor) => this.handleEditorStart(editor),
      onMultiStart: (editor) => this.handleMultiEditorStart(editor),
      onStop: (editor) => this.handleEditorStop(editor),
    })
    this.watchContourSelection()
    this.refreshContourSelection()

    return () => this.stop()
  }

  public stop(): void {
    this.cleanupHook?.()
    this.cleanupHook = null
    this.stopContourWatching()
    this.contourFlowLatched = false
    this.detach()
  }

  /** Пересчитывает значение после внешнего сброса (кнопки, Escape, смена настройки). */
  public refresh(): void {
    this.refreshContourSelection()
    this.update()
  }

  /** Сбрасывает выбранную часть и состояние редактирования. */
  public reset(): void {
    this.contourFlowLatched = false
    this.promptDismissed = true

    // Перерисовка может сбросить счётчик, не прекращая редактирование:
    // в этом случае сохраняем наблюдение за тем же редактором.
    const rootStillEditing = this.root?.state?.get?.('editing') === true
    if (rootStillEditing) {
      this.activePart = null
      this.activeRing = null
      this.applyMode()
      this.ui.hide()
      return
    }

    this.detach()
    this.ui.hide()
  }

  /** Обработчик запуска одиночного редактора (вызывается из патча прототипа). */
  public handleEditorStart(editor: GeometryEditorLike): void {
    if (!editor || this.root === editor) return

    const type = editor.geometry?.getType?.()
    if (!type) return

    // Дочерние редакторы многочастного объекта открываются отдельно: не перехватываем
    // у составного объекта управление подсчётом.
    if (isDependentEditor(editor) && this.isMulti && this.root) return

    if (type === POINT_TYPE) {
      // У точки нет бюджета вершин: счётчик не нужен.
      this.suppressFor(editor)
      return
    }

    if (type === LINE_TYPE) {
      // Часть объекта из нескольких отрезков открывается как отдельный редактор линии:
      // суммарное число по таким отрезкам не имеет смысла, счётчик скрываем.
      const map = editor.geometry.getMap?.() ?? null
      const contourFlow = this.contourFlowLatched || isContourSelectionActive()
      if (contourFlow) this.contourFlowLatched = true

      if (editor.state.get(DRAWING_STATE) === true) {
        // Пользователь рисует новую линию — это обычный сценарий, считаем как раньше.
        this.contourFlowLatched = false
        this.promptDismissed = false
        this.detach()
        return
      }

      if (contourFlow || isDependentEditor(editor) || isMultiSegmentLinearObject(editor, map)) {
        this.suppressFor(editor)
        return
      }

      this.beginModelCounting(editor)
      return
    }

    if (type !== POLYGON_TYPE) return
    if (typeof editor.getModel !== 'function') return

    // Полигоны считаются по модели, экран выбора контура к ним не относится.
    this.contourFlowLatched = false
    this.beginModelCounting(editor)
  }

  /** Переводит счётчик на модель редактора: полигон или одиночная линия. */
  private beginModelCounting(editor: GeometryEditorLike): void {
    if (typeof editor.getModel !== 'function') return

    this.detach()
    this.root = editor
    this.isMulti = false
    this.map = editor.geometry.getMap?.() ?? null
    // Пока модель не загрузилась, ничего не показываем и не перетираем.
    this.mode = 'off'
    this.activePart = 0
    this.activeRing = null
    this.applyMode()

    const generation = ++this.loadGeneration
    Promise.resolve(editor.getModel())
      .then((model) => {
        if (this.root !== editor || generation !== this.loadGeneration || !model) return
        this.parts = [{ editor, model }]
        this.mode = 'count'
        this.attachRootListeners()
        this.applyMode()
        this.update()
      })
      .catch(() => {
        // Модель может не загрузиться, если редактор уже закрыт
      })
  }

  /** Режим «объект содержит линии»: счётчик полностью скрыт. */
  private suppressFor(editor: GeometryEditorLike): void {
    this.detach()
    this.root = editor
    this.isMulti = false
    this.map = editor.geometry?.getMap?.() ?? null
    this.mode = 'suppress'
    this.attachRootListeners()
    this.applyMode()
    this.ui.hide()
  }

  /** Обработчик запуска составного редактора (`MultiGeometry`). */
  public handleMultiEditorStart(editor: GeometryEditorLike): void {
    if (!editor || this.root === editor) return

    const type = editor.geometry?.getType?.()
    if (!type) return

    this.detach()
    this.root = editor
    this.isMulti = true
    this.map = editor.geometry?.getMap?.() ?? null
    this.activePart = null
    this.activeRing = null

    if (type !== MULTI_POLYGON_TYPE) {
      // MultiLineString / MultiPoint / GeometryCollection: суммарное число по частям
      // не имеет смысла, поэтому счётчик скрыт целиком.
      this.mode = 'suppress'
      this.attachRootListeners()
      this.applyMode()
      this.ui.hide()
      return
    }

    this.mode = 'pending'
    this.attachRootListeners()
    this.applyMode()
    this.refreshParts()
  }

  /** Обработчик остановки любого редактора (вызывается из патча прототипа). */
  public handleEditorStop(editor: GeometryEditorLike): void {
    if (this.root !== editor) return
    this.detach()
    // После завершения редактирования контура объект снова только показывается.
    this.contourFlowLatched = false
    this.promptDismissed = true
    this.refreshContourSelection()
  }

  /** Следит за появлением приглашения выбрать контур. */
  private watchContourSelection(): void {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return

    this.promptObserver = new MutationObserver(() => {
      this.scheduleContourCheck()
    })

    this.promptObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  private stopContourWatching(): void {
    this.promptObserver?.disconnect()
    this.promptObserver = null
    if (this.promptCheckTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.promptCheckTimer)
    }
    this.promptCheckTimer = null
  }

  private scheduleContourCheck(): void {
    if (this.promptCheckTimer !== null || typeof window === 'undefined') return

    this.promptCheckTimer = window.setTimeout(() => {
      this.promptCheckTimer = null
      this.refreshContourSelection()
    }, 120)
  }

  /** Обновляет признак «редактор просит выбрать контур». */
  public refreshContourSelection(): void {
    const promptVisible = isContourSelectionActive()

    if (promptVisible && !this.promptDismissed) {
      this.contourFlowLatched = true
    }

    if (!promptVisible && this.promptDismissed) {
      // Уведомление убрали — можно снова реагировать на него в следующий раз.
      this.promptDismissed = false
    }

    this.applyMode()
    this.update()
  }

  private refreshParts(): void {
    const root = this.root
    if (!root || !this.isMulti) return

    const children = readChildEditors(root)

    // Части ещё не созданы (или объект только что создан). Держим режим «ожидание»,
    // чтобы canvas/SVG не показали суммарное или чужое значение.
    if (children.length === 0) {
      this.parts = []
      if (this.mode !== 'suppress') this.mode = 'pending'
      this.applyMode()
      this.update()
      return
    }

    const allPolygons = children.every((child) => child.geometry?.getType?.() === POLYGON_TYPE)
    if (!allPolygons) {
      // Линии и смешанные объекты: суммарное число по отрезкам не имеет смысла.
      this.parts = []
      this.mode = 'suppress'
      this.applyMode()
      this.update()
      return
    }

    this.mode = 'count'
    this.applyMode()

    const generation = ++this.loadGeneration
    Promise.all(
      children.map((child) =>
        Promise.resolve(child.getModel ? child.getModel() : null).catch(() => null),
      ),
    )
      .then((models) => {
        if (this.root !== root || generation !== this.loadGeneration) return
        this.parts = children
          .map((child, index) => {
            const model = models[index]
            return model ? { editor: child, model } : null
          })
          .filter((part): part is EditorPart => part !== null)
        this.attachChildListeners()
        this.update()
      })
      .catch(() => {
        // Части могли исчезнуть во время загрузки моделей
      })
  }

  private readonly handleRootStateChange = (): void => {
    if (this.isMulti) {
      this.refreshParts()
      return
    }
    this.update()
  }

  private readonly handleRootChildChange = (): void => {
    if (this.isMulti) {
      this.refreshParts()
      return
    }
    this.update()
  }

  private readonly handleUpdate = (): void => {
    this.update()
  }

  private readonly handleMapClick = (event: YmapsEventLike): void => {
    if (!this.map) return

    const point = readClickPixels(event, this.map)
    if (!point) return

    const hit = this.findPartAtPoint(point)
    if (!hit) return

    this.activePart = hit.part
    this.activeRing = hit.ring
    this.update()
  }

  private findPartAtPoint(point: PixelPoint): { part: number; ring: number } | null {
    const map = this.map
    if (!map) return null

    const projection = map.options?.get?.('projection') as ProjectionLike | undefined
    const zoom = typeof map.getZoom === 'function' ? map.getZoom() : null
    if (!projection || typeof projection.toGlobalPixels !== 'function' || zoom === null) return null

    let best: { part: number; ring: number } | null = null
    let bestArea = Number.POSITIVE_INFINITY

    this.parts.forEach((part, partIndex) => {
      const rings = readModelRings(part.model)
      rings.forEach((coords, ringIndex) => {
        const pixelRing = projectRingToPixels(coords, projection, zoom)
        if (!isPointInRing(point, pixelRing)) return
        const area = getRingArea(pixelRing)
        if (area >= bestArea) return
        bestArea = area
        best = { part: partIndex, ring: ringIndex }
      })
    })

    return best
  }

  private attachRootListeners(): void {
    const root = this.root
    if (!root) return

    this.rootListeners.push(
      this.addListener(root.state.events, 'change', this.handleRootStateChange),
      this.addListener(root.events, 'subeditorstatechange', this.handleRootStateChange),
      this.addListener(root.geometry.events, 'childchange', this.handleRootChildChange),
      this.addListener(root.geometry.events, 'change', this.handleRootChildChange),
      this.addListener(this.map?.events, 'click', this.handleMapClick),
    )
  }

  private attachChildListeners(): void {
    this.clearChildListeners()

    for (const part of this.parts) {
      this.childListeners.push(
        this.addListener(part.editor.state.events, 'change', this.handleUpdate),
        this.addListener(part.editor.geometry.events, 'change', this.handleUpdate),
      )
    }
  }

  private addListener(
    events: YmapsEventsLike | undefined,
    event: string,
    handler: (...args: never[]) => void,
  ): () => void {
    if (!events || typeof events.add !== 'function') return () => {}

    events.add(event, handler as (...args: never[]) => void)

    return () => {
      try {
        events.remove?.(event, handler as (...args: never[]) => void)
      } catch {
        // Редактор мог быть уничтожен вместе с менеджером событий
      }
    }
  }

  private clearRootListeners(): void {
    for (const remove of this.rootListeners.splice(0)) remove()
  }

  private clearChildListeners(): void {
    for (const remove of this.childListeners.splice(0)) remove()
  }

  private detach(): void {
    this.loadGeneration += 1
    this.clearChildListeners()
    this.clearRootListeners()

    if (this.mode !== 'off') {
      this.ui.hide()
    }

    this.root = null
    this.map = null
    this.parts = []
    this.mode = 'off'
    this.isMulti = false
    this.activePart = null
    this.activeRing = null
    this.applyMode()
  }

  private applyMode(): void {
    const disabled = Boolean(this.isEnabled && !this.isEnabled())

    if (disabled || this.mode === 'off') {
      // Экран выбора контура: контуры объекта просто нарисованы, считать нечего.
      setModelCounterActive(false)
      setCounterSuppressed(!disabled && this.contourFlowLatched)
      if (disabled) this.ui.hide()
      return
    }

    if (this.mode === 'suppress' || this.mode === 'pending' || this.contourFlowLatched) {
      // Пока число не посчитано по модели, внешние источники (canvas, SVG, баннер)
      // показывать ничего не должны — иначе мелькает неверное значение.
      setModelCounterActive(false)
      setCounterSuppressed(true)
      this.ui.hide()
      return
    }

    setCounterSuppressed(false)
    setModelCounterActive(true)
  }

  private update(): void {
    if (this.isEnabled && !this.isEnabled()) {
      this.applyMode()
      return
    }

    this.applyMode()

    if (this.mode === 'suppress' || this.mode === 'pending' || this.contourFlowLatched) {
      this.ui.hide()
      return
    }

    if (this.mode !== 'count') return

    if (this.isLineEditor()) {
      this.updateLineCount()
      return
    }

    const drawingPartIndex = this.parts.findIndex(
      (part) => part.editor.state.get(DRAWING_STATE) === true,
    )

    if (drawingPartIndex >= 0) {
      this.activePart = drawingPartIndex
      const drawingRing = this.readDrawingRing(this.parts[drawingPartIndex])
      if (drawingRing !== null) {
        this.activeRing = drawingRing
      }
    }

    const partIndex = drawingPartIndex >= 0 ? drawingPartIndex : this.activePart
    if (partIndex === null || partIndex >= this.parts.length) {
      this.ui.hide()
      return
    }

    const rings = readModelRings(this.parts[partIndex].model)
    if (rings.length === 0) {
      this.activePart = null
      this.activeRing = null
      this.ui.hide()
      return
    }

    // Для одиночного полигона активное кольцо задаётся по умолчанию.
    const fallbackRing = rings.length === 1 ? 0 : null
    const ringIndex = this.activeRing ?? fallbackRing
    if (ringIndex === null || ringIndex >= rings.length) {
      this.activeRing = null
      this.ui.hide()
      return
    }

    this.ui.show(countRingVertices(rings[ringIndex], drawingPartIndex === partIndex))
  }

  /** Редактор сейчас работает с линией (а не с полигоном). */
  private isLineEditor(): boolean {
    return this.root?.geometry?.getType?.() === LINE_TYPE
  }

  /** Считает вершины одиночной линии по модели редактора. */
  private updateLineCount(): void {
    const part = this.parts[0]
    if (!part) {
      this.ui.hide()
      return
    }

    const model = part.model
    const total =
      typeof model.getAllVerticesNumber === 'function' ? model.getAllVerticesNumber() : 0

    if (!Number.isFinite(total) || total <= 0) {
      this.ui.hide()
      return
    }

    const isDrawing = part.editor.state.get(DRAWING_STATE) === true
    this.ui.show(Math.max(0, total - (isDrawing ? 1 : 0)))
  }

  private readDrawingRing(part: EditorPart): number | null {
    const rawIndex = Number(part.editor.state.get(DRAWING_PATH_STATE))
    if (!Number.isInteger(rawIndex) || rawIndex < 0) return null

    const rings = readModelRings(part.model)
    if (rawIndex >= rings.length) return null

    return rawIndex
  }
}
