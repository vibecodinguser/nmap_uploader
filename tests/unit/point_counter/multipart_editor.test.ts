// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PointCounterUi as PointCounterUiType } from '@/lib/point_counter'
import {
  countRingVertices,
  findInnermostRingIndex,
  hookGeometryEditorPrototype,
  hookMultiGeometryPrototype,
  isContourSelectionActive,
  isContourSelectionText,
  isCounterSuppressed,
  isModelCounterActive,
  isPointInRing,
  MultipartEditorCounter,
  markGeometryEditorDrawing,
  markGeometryEditorEditing,
  PointCounterUi,
  patchCanvasForPointCounter,
  readClickPixels,
  resetCounterSource,
  SvgPointCounterObserver,
  setCounterSuppressed,
  setEditorHooksReady,
  setModelCounterActive,
} from '@/lib/point_counter'

type RingCoordinates = number[][]

const createUi = () => {
  const ui = {
    show: vi.fn(),
    hide: vi.fn(),
    showRemaining: vi.fn(),
    isVisible: vi.fn(() => false),
  }

  return ui as unknown as PointCounterUiType & typeof ui
}

type FakeMap = {
  events: {
    add: (event: string, handler: never) => void
    remove: (event: string, handler: never) => void
  }
  getZoom: () => number
  options: { get: (name: string) => unknown }
  click: (globalPixels: [number, number]) => void
  clickHandlerCount: () => number
}

const createFakeMap = (): FakeMap => {
  const clickHandlers = new Set<(event: { get: (key: string) => unknown }) => void>()
  const events = (handlers: Set<never>) => ({
    add: (_event: string, handler: never) => {
      handlers.add(handler)
    },
    remove: (_event: string, handler: never) => {
      handlers.delete(handler)
    },
  })

  return {
    events: events(clickHandlers as unknown as Set<never>),
    getZoom: () => 10,
    options: {
      get: (name: string) =>
        name === 'projection'
          ? { toGlobalPixels: (coords: number[]) => [coords[0] * 100, coords[1] * 100] }
          : undefined,
    },
    click: (globalPixels: [number, number]) => {
      for (const handler of clickHandlers) handler({ get: () => globalPixels })
    },
    clickHandlerCount: () => clickHandlers.size,
  }
}

type FakeEditorOptions = {
  rings: RingCoordinates[]
  drawing?: boolean
  drawingPath?: number
  map?: FakeMap
  type?: string
  dependent?: boolean
  /** Число вершин для модели линии. */
  lineVertices?: number
}

const createFakeEditor = ({
  rings,
  drawing = false,
  drawingPath = 0,
  map: mapOverride,
  type = 'Polygon',
  dependent = false,
  lineVertices,
}: FakeEditorOptions) => {
  const state: Record<string, unknown> = { drawing, drawingPath, editing: true }
  const stateHandlers = new Set<() => void>()
  const geometryHandlers = new Set<() => void>()

  const events = (handlers: Set<never>) => ({
    add: (_event: string, handler: never) => {
      handlers.add(handler)
    },
    remove: (_event: string, handler: never) => {
      handlers.delete(handler)
    },
  })

  const model = {
    getPathModels: () =>
      rings.map((coords) => ({
        geometry: { getCoordinates: () => coords },
      })),
    getAllVerticesNumber: () =>
      lineVertices ?? rings.reduce((sum, coords) => sum + coords.length, 0),
  }

  const map = mapOverride ?? createFakeMap()

  const editor = {
    state: {
      get: (key: string) => state[key],
      events: events(stateHandlers as unknown as Set<never>),
    },
    options: {
      get: (name: string) => (name === 'editorIsDependedInstance' ? dependent : undefined),
    },
    geometry: {
      getType: () => type,
      getMap: () => map,
      events: events(geometryHandlers as unknown as Set<never>),
    },
    getModel: () => Promise.resolve(model),
  }

  return {
    editor,
    map,
    setState: (next: Record<string, unknown>) => {
      Object.assign(state, next)
      for (const handler of stateHandlers) handler()
    },
    triggerGeometryChange: () => {
      for (const handler of geometryHandlers) handler()
    },
    click: (globalPixels: [number, number]) => {
      map.click(globalPixels)
    },
    stateHandlerCount: () => stateHandlers.size,
    clickHandlerCount: () => map.clickHandlerCount(),
    geometryHandlerCount: () => geometryHandlers.size,
  }
}

const SQUARE_A: RingCoordinates = [
  [1, 1],
  [1, 3],
  [3, 3],
  [3, 1],
  [1, 1],
]

const SQUARE_B: RingCoordinates = [
  [5, 5],
  [5, 7],
  [7, 7],
  [7, 5],
  [5, 5],
]

/** Внешний контур с дыркой: клик в дырку должен выбрать внутреннее кольцо. */
const OUTER_WITH_HOLE: RingCoordinates[] = [
  [
    [10, 10],
    [10, 30],
    [30, 30],
    [30, 10],
    [10, 10],
  ],
  [
    [15, 15],
    [15, 25],
    [25, 25],
    [25, 15],
    [15, 15],
  ],
]

/** Контур с шестью вершинами: нужен, чтобы отличить части друг от друга по числу. */
const HEX_SHAPE: RingCoordinates = [
  [5, 5],
  [5, 7],
  [6, 8],
  [7, 7],
  [7, 5],
  [6, 4],
  [5, 5],
]

const createFakeMultiEditor = ({
  parts,
  type = 'MultiPolygon',
}: {
  parts: Array<ReturnType<typeof createFakeEditor>>
  type?: string
}) => {
  const stateHandlers = new Set<() => void>()
  const rootEvents = new Set<() => void>()
  const geometryHandlers = new Set<() => void>()
  const subEditors: Record<string, { editor: unknown }> = {}
  const sharedMap = createFakeMap()

  parts.forEach((part, index) => {
    subEditors[String(index)] = { editor: part.editor }
    // В реальном редакторе у всех частей одна карта — клик приходит в общий обработчик
    part.editor.geometry.getMap = () => sharedMap
  })

  const editor = {
    state: {
      get: (key: string) => ({ drawing: false, editing: true, framing: false })[key],
      events: {
        add: (_event: string, handler: () => void) => stateHandlers.add(handler),
        remove: (_event: string, handler: () => void) => stateHandlers.delete(handler),
      },
    },
    geometry: {
      getType: () => type,
      getMap: () => sharedMap,
      events: {
        add: (_event: string, handler: () => void) => geometryHandlers.add(handler),
        remove: (_event: string, handler: () => void) => geometryHandlers.delete(handler),
      },
    },
    events: {
      add: (_event: string, handler: () => void) => rootEvents.add(handler),
      remove: (_event: string, handler: () => void) => rootEvents.delete(handler),
    },
    _subEditors: subEditors,
  }

  return {
    editor,
    parts,
    map: sharedMap,
    click: (globalPixels: [number, number]) => sharedMap.click(globalPixels),
    triggerChildChange: () => {
      for (const handler of geometryHandlers) handler()
    },
    rootListenerCount: () => stateHandlers.size + rootEvents.size + geometryHandlers.size,
  }
}

describe('point_counter/multipart_editor', () => {
  beforeEach(() => {
    resetCounterSource()
    document.body.replaceChildren()
  })

  afterEach(() => {
    resetCounterSource()
    vi.restoreAllMocks()
  })

  describe('countRingVertices', () => {
    it('не считает замыкающую точку у замкнутого кольца', () => {
      expect(countRingVertices(SQUARE_A)).toBe(4)
      expect(
        countRingVertices([
          [0, 0],
          [0, 1],
          [1, 1],
          [0, 0],
        ]),
      ).toBe(3)
    })

    it('исключает замыкающую точку и вершину под курсором при рисовании', () => {
      // [A, B, C, D, P1, P2, cursor, A] -> 6 поставленных вершин
      const drawingRing: RingCoordinates = [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [2, 2],
        [2, 3],
        [3, 3],
        [0, 0],
      ]
      expect(countRingVertices(drawingRing, true)).toBe(6)
    })

    it('возвращает 0 для пустого кольца', () => {
      expect(countRingVertices([])).toBe(0)
      expect(countRingVertices([], true)).toBe(0)
    })

    it('не вычитает замыкание у незамкнутого кольца', () => {
      expect(
        countRingVertices([
          [0, 0],
          [0, 1],
          [1, 1],
        ]),
      ).toBe(3)
    })
  })

  describe('isPointInRing / findInnermostRingIndex', () => {
    const outer: [number, number][] = [
      [0, 0],
      [0, 100],
      [100, 100],
      [100, 0],
      [0, 0],
    ]
    const hole: [number, number][] = [
      [40, 40],
      [40, 60],
      [60, 60],
      [60, 40],
      [40, 40],
    ]

    it('определяет попадание точки в кольцо', () => {
      expect(isPointInRing([10, 10], outer)).toBe(true)
      expect(isPointInRing([200, 200], outer)).toBe(false)
    })

    it('выбирает самый внутренний контур (дырку) при вложенности', () => {
      expect(findInnermostRingIndex([50, 50], [outer, hole])).toBe(1)
      expect(findInnermostRingIndex([10, 10], [outer, hole])).toBe(0)
      expect(findInnermostRingIndex([200, 200], [outer, hole])).toBeNull()
    })
  })

  describe('readClickPixels', () => {
    const map = {
      events: { add: vi.fn(), remove: vi.fn() },
      converter: { pageToGlobal: (coords: number[]) => [coords[0] + 1, coords[1] + 1] },
    }

    it('берёт globalPixels из события карты', () => {
      const event = { get: (key: string) => (key === 'globalPixels' ? [10, 20] : null) }
      expect(readClickPixels(event, map)).toEqual([10, 20])
    })

    it('пересчитывает pagePixels через converter', () => {
      const event = {
        get: (key: string) =>
          key === 'globalPixels' ? null : key === 'pagePixels' ? [10, 20] : null,
      }
      expect(readClickPixels(event, map)).toEqual([11, 21])
    })

    it('возвращает null без координат', () => {
      expect(readClickPixels({ get: () => null }, map)).toBeNull()
    })
  })

  describe('hookGeometryEditorPrototype', () => {
    it('вызывает onStart/onStop и не патчит прототип повторно', () => {
      const onStart = vi.fn()
      const onStop = vi.fn()
      const originalStart = vi.fn()
      const originalStop = vi.fn()

      class FakeEditor {
        startEditing(...args: unknown[]) {
          return originalStart(...args)
        }

        stopEditing(...args: unknown[]) {
          return originalStop(...args)
        }
      }

      expect(hookGeometryEditorPrototype(FakeEditor, { onStart, onStop })).toBe(true)
      expect(hookGeometryEditorPrototype(FakeEditor, { onStart, onStop })).toBe(true)

      const instance = new FakeEditor()
      instance.startEditing()
      instance.stopEditing()

      expect(originalStart).toHaveBeenCalledTimes(1)
      expect(originalStop).toHaveBeenCalledTimes(1)
      expect(onStart).toHaveBeenCalledWith(instance)
      expect(onStop).toHaveBeenCalledWith(instance)
    })

    it('игнорирует неподходящие значения', () => {
      expect(hookGeometryEditorPrototype(null, { onStart: vi.fn(), onStop: vi.fn() })).toBe(false)
      expect(hookGeometryEditorPrototype({}, { onStart: vi.fn(), onStop: vi.fn() })).toBe(false)
    })

    it('обновляет обработчики при повторной установке хука', () => {
      class FakeEditor {
        startEditing() {}
        stopEditing() {}
      }

      const first = { onStart: vi.fn(), onStop: vi.fn() }
      const second = { onStart: vi.fn(), onStop: vi.fn() }

      hookGeometryEditorPrototype(FakeEditor, first)
      hookGeometryEditorPrototype(FakeEditor, second)

      const instance = new FakeEditor()
      instance.startEditing()

      expect(first.onStart).not.toHaveBeenCalled()
      expect(second.onStart).toHaveBeenCalledWith(instance)
    })
  })

  describe('hookMultiGeometryPrototype', () => {
    it('сообщает о составном редакторе и не считает его дочерние части одиночными', () => {
      const onStart = vi.fn()
      const onMultiStart = vi.fn()
      const onStop = vi.fn()

      class FakeBase {
        startEditing(...args: unknown[]) {
          return args.length
        }

        stopEditing() {}
      }

      class FakeMulti {
        constructor() {
          this.children = [new FakeBase(), new FakeBase()]
        }

        children: FakeBase[]

        startEditing() {
          return this.children.map((child) => child.startEditing())
        }

        stopEditing() {
          for (const child of this.children) child.stopEditing()
        }
      }

      hookGeometryEditorPrototype(FakeBase, { onStart, onMultiStart, onStop })
      expect(hookMultiGeometryPrototype(FakeMulti, { onStart, onMultiStart, onStop })).toBe(true)

      const multi = new FakeMulti()
      multi.startEditing()

      expect(onMultiStart).toHaveBeenCalledWith(multi)
      expect(onStart).not.toHaveBeenCalled()

      multi.stopEditing()
      expect(onStop).toHaveBeenCalledWith(multi)
    })

    it('пропускает зависимые редакторы в обработчик (решение принимает счётчик)', () => {
      const onStart = vi.fn()

      class FakeBase {
        constructor(private readonly depended = false) {}

        startEditing() {
          return this
        }

        stopEditing() {}

        options = {
          get: (name: string) => (name === 'editorIsDependedInstance' ? this.depended : undefined),
        }
      }

      hookGeometryEditorPrototype(FakeBase as never, {
        onStart,
        onStop: vi.fn(),
        onMultiStart: vi.fn(),
      })

      new FakeBase(false).startEditing()
      new FakeBase(true).startEditing()

      expect(onStart).toHaveBeenCalledTimes(2)
    })
  })

  describe('MultipartEditorCounter', () => {
    it('считает активную часть по клику и включает подавление других источников', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const fake = createFakeEditor({ rings: [SQUARE_A, SQUARE_B] })

      counter.handleEditorStart(fake.editor as never)
      await vi.waitFor(() => expect(fake.clickHandlerCount()).toBe(1))

      // Пока часть не выбрана — счётчик скрыт
      expect(ui.show).not.toHaveBeenCalled()
      expect(isModelCounterActive()).toBe(true)

      // Клик внутри первого контура (пиксели 100..300)
      fake.click([200, 200])
      expect(ui.show).toHaveBeenLastCalledWith(4)

      // Клик внутри второго контура (пиксели 500..700)
      fake.click([600, 600])
      expect(ui.show).toHaveBeenLastCalledWith(4)

      // Клик мимо контуров сохраняет последнюю выбранную часть
      fake.click([900, 900])
      expect(ui.show).toHaveBeenCalledTimes(2)

      counter.stop()
      expect(isModelCounterActive()).toBe(false)
    })

    it('переключается на контур, который сейчас рисуется', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const fake = createFakeEditor({ rings: [SQUARE_A, SQUARE_B] })

      counter.handleEditorStart(fake.editor as never)
      await vi.waitFor(() => expect(fake.stateHandlerCount()).toBe(1))

      fake.setState({ drawing: true, drawingPath: 1 })

      // Второй контур замкнут и содержит вершину под курсором: 5 - 2 = 3
      expect(ui.show).toHaveBeenLastCalledWith(3)

      counter.stop()
    })

    it('пересчитывает значение при изменении геометрии', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const rings: RingCoordinates[] = [SQUARE_A.slice(), SQUARE_B.slice()]
      const fake = createFakeEditor({ rings })

      counter.handleEditorStart(fake.editor as never)
      await vi.waitFor(() => expect(fake.geometryHandlerCount()).toBe(1))

      fake.click([200, 200])
      expect(ui.show).toHaveBeenLastCalledWith(4)

      // Пользователь добавил вершину в первый контур
      rings[0] = [
        [1, 1],
        [1, 2],
        [2, 3],
        [3, 3],
        [3, 1],
        [1, 1],
      ]
      fake.triggerGeometryChange()
      expect(ui.show).toHaveBeenLastCalledWith(5)

      counter.stop()
    })

    it('считает одиночный полигон по модели и не вмешивается в canvas', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const fake = createFakeEditor({ rings: [SQUARE_A] })

      counter.handleEditorStart(fake.editor as never)

      // Пока модель загружается, штатный счётчик продолжает работать
      expect(isCounterSuppressed()).toBe(false)

      await vi.waitFor(() => expect(fake.stateHandlerCount()).toBe(1))

      expect(isModelCounterActive()).toBe(true)
      expect(ui.show).toHaveBeenLastCalledWith(4)

      counter.stop()
      expect(isModelCounterActive()).toBe(false)
    })

    it('снимает подавление и слушатели при остановке редактирования', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const fake = createFakeEditor({ rings: [SQUARE_A, SQUARE_B] })

      counter.handleEditorStart(fake.editor as never)
      await vi.waitFor(() => expect(fake.clickHandlerCount()).toBe(1))
      expect(isModelCounterActive()).toBe(true)

      counter.handleEditorStop(fake.editor as never)

      expect(isModelCounterActive()).toBe(false)
      expect(fake.clickHandlerCount()).toBe(0)
      expect(fake.stateHandlerCount()).toBe(0)
      expect(fake.geometryHandlerCount()).toBe(0)
      expect(ui.hide).toHaveBeenCalled()
    })

    it('не показывает счётчик, если функция отключена', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui, isEnabled: () => false })
      const fake = createFakeEditor({ rings: [SQUARE_A, SQUARE_B] })

      counter.handleEditorStart(fake.editor as never)
      await vi.waitFor(() => expect(fake.clickHandlerCount()).toBe(1))

      fake.click([200, 200])
      expect(ui.show).not.toHaveBeenCalled()
      expect(isModelCounterActive()).toBe(false)

      counter.stop()
    })

    it('считает активную часть у многочастного полигона (MultiPolygon)', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const first = createFakeEditor({ rings: [SQUARE_A] })
      const second = createFakeEditor({ rings: [SQUARE_B] })
      const multi = createFakeMultiEditor({ parts: [first, second] })

      counter.handleMultiEditorStart(multi.editor as never)
      await vi.waitFor(() => expect(multi.map.clickHandlerCount()).toBe(1))
      await vi.waitFor(() => expect(first.geometryHandlerCount()).toBe(1))

      expect(isModelCounterActive()).toBe(true)
      expect(ui.show).not.toHaveBeenCalled()

      multi.click([200, 200])
      expect(ui.show).toHaveBeenLastCalledWith(4)

      multi.click([600, 600])
      expect(ui.show).toHaveBeenLastCalledWith(4)

      counter.stop()
    })

    it('выбирает самое внутреннее кольцо внутри части многочастного полигона', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const first = createFakeEditor({ rings: [SQUARE_A] })
      const second = createFakeEditor({ rings: OUTER_WITH_HOLE })
      const multi = createFakeMultiEditor({ parts: [first, second] })

      counter.handleMultiEditorStart(multi.editor as never)
      await vi.waitFor(() => expect(second.geometryHandlerCount()).toBe(1))

      // Клик в дырку второго контура (пиксели 1500..2500) — считаем дырку, а не внешнее кольцо
      multi.click([2000, 2000])
      expect(ui.show).toHaveBeenLastCalledWith(4)

      counter.stop()
    })

    it('скрывает счётчик у многочастной линии (MultiLineString)', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const first = createFakeEditor({ rings: [] })
      const second = createFakeEditor({ rings: [] })
      first.editor.geometry.getType = () => 'LineString'
      second.editor.geometry.getType = () => 'LineString'
      const multi = createFakeMultiEditor({
        parts: [first, second],
        type: 'MultiLineString',
      })

      counter.handleMultiEditorStart(multi.editor as never)
      await vi.waitFor(() => expect(isCounterSuppressed()).toBe(true))

      expect(ui.hide).toHaveBeenCalled()
      expect(ui.show).not.toHaveBeenCalled()
      expect(isModelCounterActive()).toBe(false)

      counter.stop()
      expect(isCounterSuppressed()).toBe(false)
    })

    it('скрывает счётчик у смешанного объекта (полигон + линия)', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const polygon = createFakeEditor({ rings: [SQUARE_A] })
      const line = createFakeEditor({ rings: [] })
      const multi = createFakeMultiEditor({
        parts: [polygon, line],
        type: 'GeometryCollection',
      })

      // Тип части определяется по геометрии дочернего редактора
      line.editor.geometry.getType = () => 'LineString'

      counter.handleMultiEditorStart(multi.editor as never)
      await vi.waitFor(() => expect(isCounterSuppressed()).toBe(true))

      expect(ui.show).not.toHaveBeenCalled()

      counter.stop()
    })

    it('скрывает счётчик у части многочастного линейного объекта, открытой отдельным редактором', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const part = createFakeEditor({ rings: [], type: 'LineString', dependent: true })

      counter.handleEditorStart(part.editor as never)

      expect(isCounterSuppressed()).toBe(true)
      expect(ui.hide).toHaveBeenCalled()
      expect(ui.show).not.toHaveBeenCalled()

      counter.stop()
      expect(isCounterSuppressed()).toBe(false)
    })

    it('скрывает счётчик у одиночной линии, если объект состоит из нескольких отрезков', () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const line = createFakeEditor({ rings: [], type: 'LineString' })

      // Редактор — линейная часть внутри составного объекта на карте
      const parentGeometry = {
        getType: () => 'MultiLineString',
        getLength: () => 2,
        getChildGeometry: () => line.editor.geometry,
      }
      const map = line.map as unknown as { geoObjects?: unknown }
      map.geoObjects = {
        each: (cb: (object: unknown) => void) => cb({ geometry: parentGeometry }),
      }

      counter.handleEditorStart(line.editor as never)

      expect(isCounterSuppressed()).toBe(true)
      expect(ui.show).not.toHaveBeenCalled()

      counter.stop()
      expect(isCounterSuppressed()).toBe(false)
    })

    it('не вмешивается в одиночную линию (обычное рисование дороги)', () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const line = createFakeEditor({ rings: [], type: 'LineString' })

      // Объект, которому принадлежит редактор, — обычная линия из одной цепочки точек
      ;(line.editor.options as { get: (name: string) => unknown }).get = (name: string) =>
        name === 'geoObject'
          ? {
              geometry: {
                getType: () => 'LineString',
              },
            }
          : undefined

      counter.handleEditorStart(line.editor as never)

      expect(isCounterSuppressed()).toBe(false)
      expect(isModelCounterActive()).toBe(false)
      expect(ui.hide).not.toHaveBeenCalled()

      counter.stop()
    })

    it('скрывает счётчик у многочастной линии ещё до появления её частей', () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const multi = createFakeMultiEditor({ parts: [], type: 'MultiLineString' })

      counter.handleMultiEditorStart(multi.editor as never)

      expect(isCounterSuppressed()).toBe(true)
      expect(ui.show).not.toHaveBeenCalled()

      counter.stop()
    })

    it('считает вершины одиночной линии по модели', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const line = createFakeEditor({ rings: [], type: 'LineString', lineVertices: 12 })

      counter.handleEditorStart(line.editor as never)
      await vi.waitFor(() => expect(isModelCounterActive()).toBe(true))

      expect(ui.show).toHaveBeenLastCalledWith(12)

      counter.stop()
    })

    it('скрывает счётчик у точечного объекта', () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const point = createFakeEditor({ rings: [], type: 'Point' })

      counter.handleEditorStart(point.editor as never)

      expect(isCounterSuppressed()).toBe(true)
      expect(ui.show).not.toHaveBeenCalled()

      counter.stop()
      expect(isCounterSuppressed()).toBe(false)
    })

    it('при рисовании новой линии отдаёт подсчёт canvas-источнику', () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const line = createFakeEditor({ rings: [], type: 'LineString', drawing: true })

      counter.handleEditorStart(line.editor as never)

      expect(isCounterSuppressed()).toBe(false)
      expect(isModelCounterActive()).toBe(false)

      counter.stop()
    })

    it('не показывает суммарное значение, пока части многоугольника не загрузились', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const multi = createFakeMultiEditor({ parts: [], type: 'MultiPolygon' })

      counter.handleMultiEditorStart(multi.editor as never)

      // Режим ожидания: внешние источники выключены, значение не показано
      expect(isCounterSuppressed()).toBe(true)
      expect(ui.show).not.toHaveBeenCalled()

      // Части появились
      const first = createFakeEditor({ rings: [SQUARE_A] })
      ;(multi.editor._subEditors as Record<string, { editor: unknown }>)[String(0)] = {
        editor: first.editor,
      }
      multi.triggerChildChange()

      await vi.waitFor(() => expect(isModelCounterActive()).toBe(true))

      await vi.waitFor(() => {
        multi.click([200, 200])
        expect(ui.show).toHaveBeenLastCalledWith(4)
      })

      counter.stop()
    })

    it('скрывает счётчик на экране выбора контура и после выбора отрезка', async () => {
      vi.useFakeTimers()
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      counter.start()

      const notification = document.createElement('div')
      notification.className = 'nk-notification-view nk-notification-view_type_suggest'
      notification.textContent = 'Выберите контур для редактирования'
      document.body.appendChild(notification)

      counter.refresh()
      expect(isCounterSuppressed()).toBe(true)
      expect(ui.show).not.toHaveBeenCalled()

      // Пользователь выбрал контур: приглашение исчезло, открылся редактор отрезка
      notification.remove()
      const part = createFakeEditor({ rings: [], type: 'LineString' })
      counter.handleEditorStart(part.editor as never)

      expect(isCounterSuppressed()).toBe(true)
      expect(ui.show).not.toHaveBeenCalled()

      // Выход из режима сбрасывает признак
      part.setState({ editing: false })
      counter.reset()
      expect(isCounterSuppressed()).toBe(false)

      counter.stop()
      vi.useRealTimers()
    })

    it('сохраняет наблюдение при сбросе во время редактирования', () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })

      const notification = document.createElement('div')
      notification.className = 'nk-notification-view'
      notification.textContent = 'Выберите контур для редактирования'
      document.body.appendChild(notification)

      counter.refresh()
      notification.remove()

      const part = createFakeEditor({ rings: [], type: 'LineString' })
      counter.handleEditorStart(part.editor as never)
      expect(isCounterSuppressed()).toBe(true)

      // Перерисовка: счётчик сбросили, но редактирование продолжается
      counter.reset()
      expect(isCounterSuppressed()).toBe(true)

      counter.stop()
    })

    it('не скрывает счётчик при рисовании новой линии даже после экрана выбора контура', () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })

      const notification = document.createElement('div')
      notification.className = 'nk-notification-view'
      notification.textContent = 'Выберите контур для редактирования'
      document.body.appendChild(notification)

      counter.refresh()
      expect(isCounterSuppressed()).toBe(true)
      notification.remove()

      // Пользователь создаёт новый линейный объект
      const drawingLine = createFakeEditor({ rings: [], type: 'LineString', drawing: true })
      counter.handleEditorStart(drawingLine.editor as never)

      expect(isCounterSuppressed()).toBe(false)
      counter.stop()
    })

    it('пересчитывает части при изменении состава многочастного объекта', async () => {
      const ui = createUi()
      const counter = new MultipartEditorCounter({ ui })
      const first = createFakeEditor({ rings: [SQUARE_A] })
      const multi = createFakeMultiEditor({ parts: [first] })

      counter.handleMultiEditorStart(multi.editor as never)
      await vi.waitFor(() => expect(multi.map.clickHandlerCount()).toBe(1))
      await vi.waitFor(() => expect(first.geometryHandlerCount()).toBe(1))

      multi.click([200, 200])
      expect(ui.show).toHaveBeenLastCalledWith(4)

      // Пользователь добавил вторую часть с шестью вершинами
      const second = createFakeEditor({ rings: [HEX_SHAPE] })
      ;(multi.editor._subEditors as Record<string, { editor: unknown }>)[String(1)] = {
        editor: second.editor,
      }
      multi.triggerChildChange()

      await vi.waitFor(() => {
        multi.click([600, 600])
        expect(ui.show).toHaveBeenLastCalledWith(6)
      })

      counter.stop()
    })
  })

  describe('contour_selection', () => {
    afterEach(() => {
      document.body.replaceChildren()
    })

    it('распознаёт приглашение выбрать контур', () => {
      expect(isContourSelectionText('Выберите контур для редактирования')).toBe(true)
      expect(isContourSelectionText('  выберите   КОНТУР ')).toBe(true)
      expect(isContourSelectionText('Select a contour to edit')).toBe(true)
      expect(isContourSelectionText('Лимит — 500 вершин')).toBe(false)
      expect(isContourSelectionText('')).toBe(false)
      expect(isContourSelectionText(null)).toBe(false)
    })

    it('игнорирует скрытые приглашения', () => {
      const notification = document.createElement('div')
      notification.className = 'nk-notification-view'
      notification.textContent = 'Выберите контур для редактирования'
      notification.style.display = 'none'
      document.body.appendChild(notification)

      expect(isContourSelectionActive()).toBe(false)
      notification.style.display = 'block'
      expect(isContourSelectionActive()).toBe(true)
    })

    it('находит видимое приглашение в DOM', () => {
      const notification = document.createElement('div')
      notification.className = 'nk-notification-view nk-notification-view_type_suggest'
      notification.textContent = 'Выберите контур для редактирования'
      document.body.appendChild(notification)

      expect(isContourSelectionActive()).toBe(true)
    })
  })

  describe('подавление других источников', () => {
    it('canvas-патч не считает, пока ни один редактор не активен', () => {
      vi.useFakeTimers()
      const ui = createUi()
      const mockProto = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
      }

      const globalRecord = globalThis as unknown as Record<string, unknown>
      globalRecord.CanvasRenderingContext2D = () => {}
      ;(globalRecord.CanvasRenderingContext2D as { prototype: unknown }).prototype = mockProto

      patchCanvasForPointCounter({ ui, getLastMapInteractionTime: () => Date.now() })

      // Перехват редакторов установлен, редактор активен, но ничего не рисует:
      // перерисовка карты при панорамировании не должна давать число.
      setEditorHooksReady(true)
      const fakeEditor = {}
      markGeometryEditorEditing(fakeEditor, true)

      const ctx = Object.create(mockProto) as {
        beginPath: () => void
        moveTo: (x: number, y: number) => void
        lineTo: (x: number, y: number) => void
        stroke: () => void
        strokeStyle: string
      }
      ctx.strokeStyle = '#ff00ff'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(10, 10)
      ctx.lineTo(20, 20)
      ctx.stroke()
      vi.advanceTimersByTime(60)

      expect(ui.show).not.toHaveBeenCalled()

      // Пользователь начал рисовать новую геометрию — счётчик снова работает
      markGeometryEditorDrawing(fakeEditor, true)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(10, 10)
      ctx.lineTo(20, 20)
      ctx.stroke()
      vi.advanceTimersByTime(60)

      expect(ui.show).toHaveBeenCalledWith(2)

      markGeometryEditorDrawing(fakeEditor, false)
      markGeometryEditorEditing(fakeEditor, false)
      vi.useRealTimers()
    })

    it('canvas-патч не показывает отложенное значение после включения подавления', () => {
      vi.useFakeTimers()
      const ui = createUi()
      const mockProto = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
      }

      const globalRecord = globalThis as unknown as Record<string, unknown>
      globalRecord.CanvasRenderingContext2D = () => {}
      ;(globalRecord.CanvasRenderingContext2D as { prototype: unknown }).prototype = mockProto

      patchCanvasForPointCounter({ ui, getLastMapInteractionTime: () => Date.now() })

      const ctx = Object.create(mockProto) as {
        beginPath: () => void
        moveTo: (x: number, y: number) => void
        lineTo: (x: number, y: number) => void
        stroke: () => void
        strokeStyle: string
      }
      ctx.strokeStyle = '#ff00ff'

      // Штрих произошёл до старта редактора
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(10, 10)
      ctx.lineTo(20, 20)
      ctx.stroke()

      // Редактор многочастного объекта запустился и скрыл счётчик
      setCounterSuppressed(true)
      vi.advanceTimersByTime(60)

      expect(ui.show).not.toHaveBeenCalled()

      resetCounterSource()
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(10, 10)
      ctx.lineTo(20, 20)
      ctx.stroke()
      vi.advanceTimersByTime(60)

      // 3 сырые точки минус вершина под курсором
      expect(ui.show).toHaveBeenCalledWith(2)
      vi.useRealTimers()
    })

    it('canvas-патч не перетирает значение модели', () => {
      const ui = createUi()
      const mockProto = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
      }

      const globalRecord = globalThis as unknown as Record<string, unknown>
      globalRecord.CanvasRenderingContext2D = () => {}
      ;(globalRecord.CanvasRenderingContext2D as { prototype: unknown }).prototype = mockProto

      patchCanvasForPointCounter({ ui, getLastMapInteractionTime: () => Date.now() })

      vi.useFakeTimers()
      const ctx = Object.create(mockProto) as {
        beginPath: () => void
        moveTo: (x: number, y: number) => void
        lineTo: (x: number, y: number) => void
        stroke: () => void
        strokeStyle: string
      }
      ctx.strokeStyle = '#ff00ff'

      setModelCounterActive(true)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(10, 10)
      ctx.lineTo(20, 20)
      ctx.stroke()
      vi.advanceTimersByTime(60)

      expect(ui.show).not.toHaveBeenCalled()

      resetCounterSource()
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(10, 10)
      ctx.lineTo(20, 20)
      ctx.stroke()
      vi.advanceTimersByTime(60)

      // 3 сырые точки минус вершина под курсором
      expect(ui.show).toHaveBeenCalledWith(2)
      vi.useRealTimers()
    })

    it('UI не показывает значение, пока счётчик скрыт моделью', () => {
      const realUi = new PointCounterUi(() => (key: string) => key)
      realUi.ensureCreated()

      setCounterSuppressed(true)
      realUi.show(4)
      expect(realUi.isVisible()).toBe(false)

      realUi.showRemaining(10)
      expect(realUi.isVisible()).toBe(false)

      resetCounterSource()
      realUi.show(4)
      expect(realUi.isVisible()).toBe(true)
    })

    it('SVG-наблюдатель не перетирает значение модели и игнорирует системный баннер', () => {
      const ui = createUi()
      const observer = new SvgPointCounterObserver({
        ui,
        getLastMapInteractionTime: () => Date.now(),
      })

      const warning = document.createElement('div')
      warning.className = 'nk-toolbar__message'
      warning.textContent = 'Лимит — 500 вершин. Можно нарисовать ещё 11 вершин'
      document.body.appendChild(warning)

      setModelCounterActive(true)

      expect(observer.checkSystemBanner(true)).toBe(true)
      expect(ui.showRemaining).not.toHaveBeenCalled()

      resetCounterSource()
      expect(observer.checkSystemBanner(true)).toBe(true)
      expect(ui.showRemaining).toHaveBeenCalledWith(11)
    })
  })
})
