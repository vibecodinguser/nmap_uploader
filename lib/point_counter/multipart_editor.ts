/**
 * Счётчик вершин активной части объекта в редакторе НЯК.
 *
 * Редактор Народной карты не помечает активную часть в DOM: и геометрия, и ручки вершин
 * рисуются на canvas. Единственный достоверный источник — модель редактора:
 * - одиночный `Polygon` (контур с внутренними кольцами) считает активное кольцо;
 * - `MultiPolygon` считает активную часть (ту, что рисуется, иначе ту, по которой кликнули);
 * - одиночная `LineString` считает свои вершины;
 * - `MultiLineString`, `MultiPoint`, `Point` и смешанные объекты не считаются вовсе —
 *   суммарное число по отрезкам не имеет смысла, поэтому счётчик скрывается.
 *
 * Чистая геометрия — в `ring_geometry.ts`, перехват редакторов — в `editor_hooks.ts`.
 */

import { isContourSelectionActive } from './contour_selection'
import { setCounterSuppressed, setModelCounterActive } from './counter_source'
import type { PointCounterUi } from './dom_ui'
import { type EditorHookHandlers, installGeometryEditorHook } from './editor_hooks'
import type {
  EditorMapLike,
  EditorModelLike,
  GeometryEditorLike,
  PixelPoint,
  ProjectionLike,
  RingCoordinates,
  YmapsEventLike,
  YmapsEventsLike,
} from './editor_types'
import {
  DEPENDED_EDITOR_OPTION,
  DRAWING_PATH_STATE,
  DRAWING_STATE,
  LINE_TYPE,
  MULTI_POLYGON_TYPE,
  POINT_TYPE,
  POLYGON_TYPE,
} from './editor_types'
import {
  countRingVertices,
  getRingArea,
  isPointInRing,
  projectRingToPixels,
  readClickPixels,
} from './ring_geometry'

export type { EditorHookHandlers }

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

    const handlers: EditorHookHandlers = {
      onStart: (editor) => this.handleEditorStart(editor),
      onMultiStart: (editor) => this.handleMultiEditorStart(editor),
      onStop: (editor) => this.handleEditorStop(editor),
    }
    this.cleanupHook = installGeometryEditorHook(handlers)

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
