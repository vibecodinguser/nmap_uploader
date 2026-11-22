// @vitest-environment happy-dom

/**
 * Инструмент разреза растительности.
 *
 * Редактор НЯК подменяется активностью с тем же контрактом
 * (`start` / `onStart` / `onViewAttrsRequest` / `stop` / `isStarted`):
 * проверяется поведение инструмента, а не внутренности бандла.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTranslator } from '@/lib/i18n'
import { observeWebpackModules } from '@/lib/nmaps_webpack_module_observer'
import {
  createVegetationCutButton,
  ensureVegetationCutButton,
  findOnMapToolbar,
  getVegetationCutButton,
  removeVegetationCutButton,
  setVegetationCutButtonActive,
  VEGETATION_CUT_BUTTON_ID,
  VEGETATION_CUT_ICON_SVG,
} from '@/lib/vegetation_cut/button'
import { VegetationCutController } from '@/lib/vegetation_cut/controller'
import {
  hookModuleExports,
  installActivityHook,
  isActivityClass,
  subscribeActivityClass,
} from '@/lib/vegetation_cut/editor_access'
import { createEditorBridge } from '@/lib/vegetation_cut/editor_bridge'
import {
  installWebpackRuntime,
  pushWebpackChunk,
  type RuntimeChunk,
} from '../nmaps_webpack_runtime_fixture'

const RING: number[][] = [
  [41.42, 44.84],
  [41.421, 44.84],
  [41.421, 44.841],
  [41.42, 44.841],
  [41.42, 44.84],
]

const OPEN_LINE: number[][] = [
  [41.42, 44.84],
  [41.421, 44.84],
  [41.422, 44.84],
  [41.423, 44.84],
]

/** Проекция-заглушка: градусы в «пиксели» с шагом 1e6. */
const createFakeMap = () => {
  const add = vi.fn()
  const remove = vi.fn()
  const map = {
    getZoom: () => 16,
    options: {
      get: (name: string) =>
        name === 'projection'
          ? { toGlobalPixels: (coords: number[]) => [coords[0] * 1e6, coords[1] * 1e6] }
          : undefined,
    },
    events: { add, remove },
  }
  return { map, add, remove }
}

type FakeElement = {
  id: string
  coordinates: number[][]
}

type FakeActivityParams = {
  categoryId?: string
  elementCategoryId?: string
  elementRoleId?: string
  elements?: FakeElement[]
  /** Редактор без обработчика правки: инструмент не должен включаться. */
  withoutChangeHandler?: boolean
}

const createFakeActivity = ({
  categoryId = 'vegetation_fc',
  elementCategoryId = 'vegetation_el',
  elementRoleId = 'part',
  elements = [{ id: 'el-1', coordinates: OPEN_LINE }],
  withoutChangeHandler = false,
}: FakeActivityParams = {}) => {
  const { map, add, remove } = createFakeMap()

  const onChangeElementCoords = vi.fn()
  const addGeoObject = vi.fn()
  const created: Array<Record<string, unknown>> = []

  const makeElement = (element: FakeElement) => ({
    getId: () => element.id,
    getGeometry: () => ({
      getType: () => 'LineString',
      getCoordinates: () => element.coordinates,
      isClosed: () => {
        const first = element.coordinates[0]
        const last = element.coordinates[element.coordinates.length - 1]
        return first[0] === last[0] && first[1] === last[1]
      },
    }),
  })

  const elementObjects = elements.map(makeElement)

  const collection = {
    get: () => elementObjects,
    findById: (id: string) => elementObjects.find((item) => item.getId() === id) ?? null,
    addGeoObject,
  }

  const addElement = (element: FakeElement): void => {
    elementObjects.push(makeElement(element))
  }

  const geoObject = {
    getCategoryId: () => categoryId,
    getId: () => 'contour-1',
    getSlavesByRole: (role: string) => (role === elementRoleId ? collection : null),
  }

  const geoObjectFactory = {
    createGeoObject: (params: Record<string, unknown>) => {
      created.push(params)
      return { ...params, getId: () => `new-${created.length}` }
    },
  }

  const geometryFactory = {
    createPolyline: (coordinates: number[][]) => ({ coordinates }),
  }

  const viewAttrs = {
    map,
    geoObject,
    elementRoleId,
    elementCategoryId,
    elements: collection,
    geoObjectFactory,
    geometryFactory,
    onChangeElementCoords: withoutChangeHandler ? undefined : onChangeElementCoords,
  }

  class FakeActivity {
    public params = { geoObject, elementRoleId }
    public started = false

    start() {
      this.started = true
      return this
    }

    onStart() {
      return true
    }

    stop() {
      this.started = false
      return this
    }

    onStop() {}

    isStarted() {
      return this.started
    }

    onViewAttrsRequest() {
      return viewAttrs
    }
  }

  return {
    activity: new FakeActivity(),
    onChangeElementCoords,
    addGeoObject,
    addElement,
    created,
    map,
    add,
    remove,
  }
}

const mountToolbar = (): HTMLElement => {
  const toolbar = document.createElement('div')
  toolbar.className = 'nk-on-map-toolbar'
  document.body.appendChild(toolbar)
  return toolbar
}

const translator = createTranslator('ru')

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  removeVegetationCutButton()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('кнопка разреза растительности', () => {
  it('одевается в нативные классы тулбара и получает доступное имя', () => {
    const button = createVegetationCutButton('Разрезать растительность')

    expect(button.classList.contains('nk-button')).toBe(true)
    expect(button.classList.contains('nk-button_theme_air')).toBe(true)
    expect(button.classList.contains('nk-button_size_xl')).toBe(true)
    expect(button.classList.contains('nk-on-map-toolbar__item')).toBe(true)
    expect(button.getAttribute('aria-label')).toBe('Разрезать растительность')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.innerHTML).toContain('svg')
  })

  it('рисует ножницы, а не копирует чужую иконку', () => {
    expect(VEGETATION_CUT_ICON_SVG).toContain('<circle')
    expect(VEGETATION_CUT_ICON_SVG).toContain('stroke="currentColor"')
  })

  it('ставится после нативной кнопки разрезания, если она есть', () => {
    const toolbar = mountToolbar()
    const nativeButton = document.createElement('button')
    nativeButton.className = 'nk-button nk-on-map-toolbar__item'
    const nativeIcon = document.createElement('span')
    nativeIcon.className = 'nk-icon nk-icon_id_split'
    nativeButton.appendChild(nativeIcon)
    toolbar.appendChild(nativeButton)

    const button = ensureVegetationCutButton({ label: 'Разрезать', onClick: vi.fn() })

    expect(button?.previousElementSibling).toBe(nativeButton)
  })

  it('добавляется в конец тулбара, если нативной кнопки нет', () => {
    const toolbar = mountToolbar()
    const button = ensureVegetationCutButton({ label: 'Разрезать', onClick: vi.fn() })

    expect(toolbar.lastElementChild).toBe(button)
    expect(findOnMapToolbar()).toBe(toolbar)
  })

  it('не вешает второй обработчик при повторном монтировании', () => {
    mountToolbar()
    const onClick = vi.fn()

    const first = ensureVegetationCutButton({ label: 'Разрезать', onClick })
    ensureVegetationCutButton({ label: 'Разрезать', onClick })
    first?.click()

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('показывает нажатое состояние через нативный класс и aria-pressed', () => {
    const button = createVegetationCutButton('Разрезать')

    setVegetationCutButtonActive(button, true)
    expect(button.classList.contains('nk-button_checked')).toBe(true)
    expect(button.getAttribute('aria-pressed')).toBe('true')

    setVegetationCutButtonActive(button, false)
    expect(button.classList.contains('nk-button_checked')).toBe(false)
    expect(button.getAttribute('aria-pressed')).toBe('false')
  })

  it('убирается из документа', () => {
    const toolbar = mountToolbar()
    toolbar.appendChild(createVegetationCutButton('Разрезать'))
    expect(document.getElementById(VEGETATION_CUT_BUTTON_ID)).not.toBeNull()

    removeVegetationCutButton()
    expect(document.getElementById(VEGETATION_CUT_BUTTON_ID)).toBeNull()
  })
})

describe('перехват активностей редактора', () => {
  it('узнаёт класс активности по контракту', () => {
    const { activity } = createFakeActivity()
    expect(isActivityClass(activity.constructor)).toBe(true)
    expect(isActivityClass({})).toBe(false)
    expect(isActivityClass(() => {})).toBe(false)
  })

  it('сообщает о запуске и остановке активности', () => {
    const onStart = vi.fn()
    const onStop = vi.fn()
    const { activity } = createFakeActivity()

    expect(hookModuleExports({ A: activity.constructor }, { onStart, onStop })).toBe(true)

    activity.start()
    expect(onStart).toHaveBeenCalledWith(activity)

    activity.stop()
    expect(onStop).toHaveBeenCalledWith(activity)
  })

  it('оборачивает прототип один раз и не дублирует вызовы', () => {
    const onStart = vi.fn()
    const onStop = vi.fn()
    const { activity } = createFakeActivity()
    const hooks = { onStart, onStop }

    expect(hookModuleExports({ A: activity.constructor }, hooks)).toBe(true)
    expect(hookModuleExports({ A: activity.constructor }, hooks)).toBe(true)

    activity.start()

    // Обёртка одна: повторная подписка того же набора не даёт двойного вызова.
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('игнорирует модули без активностей', () => {
    const onStart = vi.fn()
    expect(hookModuleExports({ helper: () => {} }, { onStart, onStop: vi.fn() })).toBe(false)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('подписывается заново после перезагрузки расширения', () => {
    // Прототип переживает перезагрузку расширения: старая копия скрипта
    // умирает, а обёрнутые методы остаются в мире страницы.
    const first = { onStart: vi.fn(), onStop: vi.fn() }
    const second = { onStart: vi.fn(), onStop: vi.fn() }
    const { activity } = createFakeActivity()
    const Class = activity.constructor as unknown as Parameters<typeof subscribeActivityClass>[0]

    const unsubscribeFirst = subscribeActivityClass(Class, first)
    expect(unsubscribeFirst).not.toBeNull()

    const unsubscribeSecond = subscribeActivityClass(Class, second)
    expect(unsubscribeSecond).not.toBeNull()

    activity.start()
    expect(second.onStart).toHaveBeenCalledTimes(1)

    // Новая копия снимает подписку — обработчик перестаёт вызываться.
    unsubscribeSecond?.()
    activity.start()
    expect(second.onStart).toHaveBeenCalledTimes(1)
  })

  it('не вызывает мёртвые обработчики прошлой копии', () => {
    const dead = {
      onStart: () => {
        throw new Error('Extension context invalidated')
      },
      onStop: () => {},
    }
    const live = { onStart: vi.fn(), onStop: vi.fn() }
    const { activity } = createFakeActivity()
    const Class = activity.constructor as unknown as Parameters<typeof subscribeActivityClass>[0]

    subscribeActivityClass(Class, dead)
    subscribeActivityClass(Class, live)

    expect(() => activity.start()).not.toThrow()
    expect(live.onStart).toHaveBeenCalledTimes(1)
  })

  describe('на странице НЯК', () => {
    type EditorLike = { start: () => unknown; stop: () => unknown }

    /** Чанк как в `app-bundle`: базовый класс экспортируется, редактор — нет. */
    const createEditorChunk = () => {
      const { activity } = createFakeActivity()
      const Base = activity.constructor as new () => EditorLike
      class TopologyEditor extends Base {}
      const lazyModule = vi.fn()
      const chunk: RuntimeChunk = [
        [265],
        {
          17574: (_module, exports) => {
            exports.A = Base
          },
          74613: (_module, exports, require) => {
            require(17574)
            exports.open = () => new TopologyEditor()
          },
          99999: lazyModule,
        },
      ]
      return { chunk, lazyModule }
    }

    const openEditor = (require: (id: number) => Record<string, unknown>): EditorLike =>
      (require(74613).open as () => EditorLike)()

    it('ловит редактор после обычной загрузки, даже если следом встал другой наблюдатель', () => {
      // Порядок манифеста: разрез, затем трассировка — оба до `app.js`.
      const globalObject: Record<string, unknown> = {}
      const hooks = { onStart: vi.fn(), onStop: vi.fn() }
      const onWrapped = vi.fn()
      installActivityHook(hooks, { globalObject, observe: observeWebpackModules, onWrapped })
      observeWebpackModules(globalObject, 'webpackChunknmaps', () => {})

      const require = installWebpackRuntime(globalObject)
      const { chunk } = createEditorChunk()
      pushWebpackChunk(globalObject, chunk)
      const editor = openEditor(require)

      editor.start()
      expect(onWrapped).toHaveBeenLastCalledWith(1)
      expect(hooks.onStart).toHaveBeenCalledExactlyOnceWith(editor)

      editor.stop()
      expect(hooks.onStop).toHaveBeenCalledExactlyOnceWith(editor)
    })

    it('перестаёт слушать редактор после снятия хука', () => {
      const globalObject: Record<string, unknown> = {}
      const hooks = { onStart: vi.fn(), onStop: vi.fn() }
      const uninstall = installActivityHook(hooks, { globalObject, observe: observeWebpackModules })
      const require = installWebpackRuntime(globalObject)
      const { chunk } = createEditorChunk()
      pushWebpackChunk(globalObject, chunk)
      const editor = openEditor(require)

      uninstall()
      editor.start()

      expect(hooks.onStart).not.toHaveBeenCalled()
    })

    it('при поздней установке не исполняет модули страницы и не подключается', () => {
      // Скрипт попал в уже загруженную вкладку: модули редактора исполнены,
      // остальные ждут своего часа и не должны запускаться из-за нас.
      const globalObject: Record<string, unknown> = {}
      const require = installWebpackRuntime(globalObject)
      const { chunk, lazyModule } = createEditorChunk()
      pushWebpackChunk(globalObject, chunk)
      const editor = openEditor(require)

      const hooks = { onStart: vi.fn(), onStop: vi.fn() }
      const onWrapped = vi.fn()
      installActivityHook(hooks, { globalObject, observe: observeWebpackModules, onWrapped })
      editor.start()

      expect(lazyModule).not.toHaveBeenCalled()
      expect(onWrapped).not.toHaveBeenCalled()
      expect(hooks.onStart).not.toHaveBeenCalled()
    })
  })
})

describe('мост к активности редактора', () => {
  it('читает категории, роль и элементы контура', () => {
    const { activity } = createFakeActivity()
    const bridge = createEditorBridge(activity)

    expect(bridge?.getCategoryId()).toBe('vegetation_fc')
    expect(bridge?.getElementCategoryId()).toBe('vegetation_el')
    expect(bridge?.getElementRoleId()).toBe('part')
    expect(bridge?.getElements()).toEqual([{ id: 'el-1', coordinates: OPEN_LINE, closed: false }])
    expect(bridge?.getMap()).not.toBeNull()
    expect(bridge?.canCut()).toBe(true)
  })

  it('отмечает замкнутый элемент как кольцо', () => {
    const { activity } = createFakeActivity({
      elements: [{ id: 'ring', coordinates: RING }],
    })

    expect(createEditorBridge(activity)?.getElements()[0].closed).toBe(true)
  })

  it('возвращает null, если передан не редактор', () => {
    expect(createEditorBridge(null)).toBeNull()
    expect(createEditorBridge({})).toBeNull()
  })

  it('достаёт настоящую карту из обёртки редактора', () => {
    const { activity } = createFakeActivity()
    const attrs = activity.onViewAttrsRequest() as Record<string, unknown>

    // Редактор отдаёт обёртку map-service: у неё нет events и проекции.
    const wrapper = {
      getZoom: () => 16,
      getYMap: () => attrs.map,
    }
    const withWrapper = createFakeActivity()
    const originalAttrs = withWrapper.activity.onViewAttrsRequest as () => Record<string, unknown>
    withWrapper.activity.onViewAttrsRequest = () => ({ ...originalAttrs(), map: wrapper })

    const map = createEditorBridge(withWrapper.activity)?.getMap()
    expect(map).toBe(attrs.map)
  })

  it('не падает, если обёртка не отдаёт карту', () => {
    const { activity } = createFakeActivity()
    const originalAttrs = activity.onViewAttrsRequest as () => Record<string, unknown>
    const wrapper = { getZoom: () => 16, getYMap: () => null }
    activity.onViewAttrsRequest = () => ({ ...originalAttrs(), map: wrapper })

    expect(createEditorBridge(activity)?.getMap()).toBe(wrapper)
  })

  it('не считает разрез доступным без обработчика правки', () => {
    const { activity } = createFakeActivity({ withoutChangeHandler: true })
    expect(createEditorBridge(activity)?.canCut()).toBe(false)
  })

  it('делит элемент на две части: первую правит, вторую добавляет', () => {
    const { activity, onChangeElementCoords, addGeoObject, created } = createFakeActivity()
    const bridge = createEditorBridge(activity)
    const [left, right] = [
      [OPEN_LINE[0], OPEN_LINE[1]],
      [OPEN_LINE[1], OPEN_LINE[2], OPEN_LINE[3]],
    ]

    expect(bridge?.applyCut('el-1', [left, right])).toBe(true)

    expect(onChangeElementCoords).toHaveBeenCalledTimes(1)
    const [element, coordinates] = onChangeElementCoords.mock.calls[0]
    expect(element.getId()).toBe('el-1')
    expect(coordinates).toEqual(left)

    expect(created).toHaveLength(1)
    expect(created[0].categoryId).toBe('vegetation_el')
    expect(created[0].geometry).toEqual({ coordinates: right })
    expect(addGeoObject).toHaveBeenCalledTimes(1)
  })

  it('размыкает кольцо одной частью и не создаёт новый элемент', () => {
    const { activity, onChangeElementCoords, addGeoObject } = createFakeActivity({
      elements: [{ id: 'ring', coordinates: RING }],
    })
    const bridge = createEditorBridge(activity)
    const opened = [[41.4205, 44.84], ...RING]

    expect(bridge?.applyCut('ring', [opened])).toBe(true)

    expect(onChangeElementCoords).toHaveBeenCalledTimes(1)
    expect(addGeoObject).not.toHaveBeenCalled()
  })

  it('отказывает, если элемента с таким id нет', () => {
    const { activity, onChangeElementCoords } = createFakeActivity()
    const bridge = createEditorBridge(activity)

    expect(bridge?.applyCut('missing', [OPEN_LINE])).toBe(false)
    expect(onChangeElementCoords).not.toHaveBeenCalled()
  })

  it('не пропускает больше двух частей', () => {
    const { activity } = createFakeActivity()
    const bridge = createEditorBridge(activity)

    expect(bridge?.applyCut('el-1', [OPEN_LINE, OPEN_LINE, OPEN_LINE])).toBe(false)
  })
})

describe('режим разреза', () => {
  const createController = (
    options: { onMessage?: (text: string) => void; activity?: FakeActivityParams } = {},
  ) => {
    const fake = createFakeActivity(options.activity)
    const controller = new VegetationCutController({
      getTranslator: () => translator,
      onMessage: options.onMessage,
      observe: () => () => {},
    })
    return { controller, ...fake }
  }

  it('показывает кнопку для линейной растительности', () => {
    mountToolbar()
    const { controller, activity } = createController()

    expect(controller.attachActivity(activity)).toBe(true)
    expect(getVegetationCutButton()).not.toBeNull()
  })

  it('не показывает кнопку для чужой категории', () => {
    mountToolbar()
    const { controller, activity } = createController({
      activity: { categoryId: 'bld', elementCategoryId: 'bld_el' },
    })

    expect(controller.attachActivity(activity)).toBe(false)
    expect(getVegetationCutButton()).toBeNull()
  })

  it('не показывает кнопку, если редактор не умеет делить элемент', () => {
    mountToolbar()
    const { controller, activity } = createController({
      activity: { withoutChangeHandler: true },
    })

    expect(controller.attachActivity(activity)).toBe(false)
  })

  it('делит линию в месте клика', () => {
    mountToolbar()
    const { controller, activity, onChangeElementCoords, addGeoObject } = createController()
    controller.attachActivity(activity)
    controller.toggle()

    const outcome = controller.handleMapClick([41.4215 * 1e6, 44.84 * 1e6])

    expect(outcome).toBe('cut')
    expect(onChangeElementCoords).toHaveBeenCalledTimes(1)
    expect(addGeoObject).toHaveBeenCalledTimes(1)

    const [element, left] = onChangeElementCoords.mock.calls[0]
    expect(element.getId()).toBe('el-1')
    expect(left[0]).toEqual(OPEN_LINE[0])
    expect(left[left.length - 1][0]).toBeCloseTo(41.4215, 6)
  })

  it('размыкает кольцо одной правкой, не добавляя элемент', () => {
    mountToolbar()
    const { controller, activity, onChangeElementCoords, addGeoObject } = createController({
      activity: { elements: [{ id: 'ring', coordinates: RING }] },
    })
    controller.attachActivity(activity)
    controller.toggle()

    const outcome = controller.handleMapClick([41.4205 * 1e6, 44.84 * 1e6])

    expect(outcome).toBe('cut')
    expect(onChangeElementCoords).toHaveBeenCalledTimes(1)
    expect(addGeoObject).not.toHaveBeenCalled()
  })

  it('игнорирует клик мимо линии', () => {
    mountToolbar()
    const onMessage = vi.fn()
    const { controller, activity } = createController({ onMessage })
    controller.attachActivity(activity)
    controller.toggle()

    const outcome = controller.handleMapClick([41.4205 * 1e6, 44.9 * 1e6])

    expect(outcome).toBe('miss')
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('не режет у самого конца линии', () => {
    mountToolbar()
    const onMessage = vi.fn()
    const { controller, activity, onChangeElementCoords } = createController({ onMessage })
    controller.attachActivity(activity)
    controller.toggle()

    const outcome = controller.handleMapClick([41.42 * 1e6, 44.84 * 1e6])

    expect(outcome).toBe('too-short')
    expect(onChangeElementCoords).not.toHaveBeenCalled()
    expect(onMessage).toHaveBeenCalledWith('Слишком короткая часть — разрез не сделан')
  })

  it('не режет, пока режим выключен', () => {
    mountToolbar()
    const { controller, activity, onChangeElementCoords } = createController()
    controller.attachActivity(activity)

    expect(controller.handleMapClick([41.4215 * 1e6, 44.84 * 1e6])).toBe('inactive')
    expect(onChangeElementCoords).not.toHaveBeenCalled()
  })

  it('подписывается на клики карты на время режима и снимает подписку', () => {
    mountToolbar()
    const { controller, activity, add, remove } = createController()
    controller.attachActivity(activity)

    controller.toggle()
    expect(add).toHaveBeenCalledWith('click', expect.any(Function))

    controller.toggle()
    expect(remove).toHaveBeenCalledWith('click', expect.any(Function))
  })

  it('выключается по Escape', () => {
    mountToolbar()
    const { controller, activity } = createController()
    controller.attachActivity(activity)
    controller.toggle()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(controller.handleMapClick([0, 0])).toBe('inactive')
  })

  it('снимает кнопку при закрытии редактора', () => {
    mountToolbar()
    const { controller, activity } = createController()
    controller.attachActivity(activity)
    expect(getVegetationCutButton()).not.toBeNull()

    controller.detachActivity(activity)
    expect(getVegetationCutButton()).toBeNull()
  })

  it('не реагирует на остановку чужой активности', () => {
    mountToolbar()
    const { controller, activity } = createController()
    controller.attachActivity(activity)

    controller.detachActivity({})
    expect(getVegetationCutButton()).not.toBeNull()
  })

  it('помечает состояние на <html> для диагностики', () => {
    mountToolbar()
    const { controller, activity } = createController()
    controller.attachActivity(activity)

    expect(document.documentElement.getAttribute('data-nmap-veg-cut')).toBe('ready:vegetation_el:1')

    controller.detachActivity(activity)
    expect(document.documentElement.getAttribute('data-nmap-veg-cut')).toBe('idle')
  })

  it('показывает, сколько классов активностей перехвачено', () => {
    const setAttribute = vi.spyOn(document.documentElement, 'setAttribute')
    const controller = new VegetationCutController({
      getTranslator: () => translator,
      observe: (_global, _chunk, onModule) => {
        // Модуль с классом активности приходит уже после установки хука.
        onModule({ A: createFakeActivity().activity.constructor }, '17574')
        return () => {}
      },
    })

    controller.start()

    const states = setAttribute.mock.calls
      .filter(([name]) => name === 'data-nmap-veg-cut')
      .map(([, value]) => value)

    expect(states).toContain('hooked:0')
    expect(states.at(-1)).toBe('hooked:1')

    controller.stop()
  })

  it('не считает готовым редактор контейнера без элементов', () => {
    mountToolbar()
    const { controller, activity } = createController({ activity: { elements: [] } })

    expect(controller.attachActivity(activity)).toBe(false)
    expect(document.documentElement.getAttribute('data-nmap-veg-cut')).toBe('wait:vegetation_el')
  })

  it('показывает кнопку, когда элементы контура догрузились позже', async () => {
    mountToolbar()
    const { controller, activity, addElement } = createController({
      activity: { elements: [] },
    })
    const stop = controller.start()

    // Редактор топологии стартует раньше, чем приходит топология контура.
    expect(controller.attachActivity(activity)).toBe(false)
    expect(getVegetationCutButton()).toBeNull()

    addElement({ id: 'el-1', coordinates: OPEN_LINE })
    document.body.appendChild(document.createElement('div'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(getVegetationCutButton()).not.toBeNull()
    expect(document.documentElement.getAttribute('data-nmap-veg-cut')).toBe('ready:vegetation_el:1')

    stop()
  })

  it('контейнер объекта не вытесняет уже найденный редактор топологии', () => {
    mountToolbar()
    const { controller, activity } = createController()
    const { activity: master } = createController({
      activity: { categoryId: 'vegetation', elementCategoryId: '', elements: [] },
    })

    // Порядок как в редакторе: топология стартует внутри onStart контейнера.
    expect(controller.attachActivity(activity)).toBe(true)
    expect(controller.attachActivity(master)).toBe(true)

    expect(getVegetationCutButton()).not.toBeNull()
    expect(document.documentElement.getAttribute('data-nmap-veg-cut')).toBe('ready:vegetation_el:1')
  })
})
