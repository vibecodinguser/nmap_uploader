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
import { createFakeActivity, type FakeActivityParams, OPEN_LINE, RING } from './fake_editor'

const STATE_ATTR = 'data-nmap-veg-cut'
const DEBUG_FLAG = 'nmap-veg-cut-debug'

/** Точка на втором отрезке `OPEN_LINE`, не совпадающая с вершиной. */
const CUT_POINT: number[] = [41.4215, 44.84]

const mountToolbar = (): HTMLElement => {
  const toolbar = document.createElement('div')
  toolbar.className = 'nk-on-map-toolbar'
  document.body.appendChild(toolbar)
  return toolbar
}

const readActivityLog = (): unknown => (globalThis as Record<string, unknown>).__nmapVegCutLog

const translator = createTranslator('ru')

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  removeVegetationCutButton()
  document.body.innerHTML = ''
  document.documentElement.removeAttribute(STATE_ATTR)
  localStorage.removeItem(DEBUG_FLAG)
  Reflect.deleteProperty(globalThis, '__nmapVegCutLog')
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
  const LEFT = [OPEN_LINE[0], OPEN_LINE[1]]
  const RIGHT = [OPEN_LINE[1], OPEN_LINE[2], OPEN_LINE[3]]

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
    withWrapper.activity.onViewAttrsRequest = (() => ({
      ...originalAttrs(),
      map: wrapper,
    })) as never

    const map = createEditorBridge(withWrapper.activity)?.getMap()
    expect(map).toBe(attrs.map)
  })

  it('не падает, если обёртка не отдаёт карту', () => {
    const { activity } = createFakeActivity()
    const originalAttrs = activity.onViewAttrsRequest as () => Record<string, unknown>
    const wrapper = { getZoom: () => 16, getYMap: () => null }
    activity.onViewAttrsRequest = (() => ({ ...originalAttrs(), map: wrapper })) as never

    expect(createEditorBridge(activity)?.getMap()).toBe(wrapper)
  })

  it('не считает разрез доступным без обработчика правки', () => {
    const { activity } = createFakeActivity({ withoutChangeHandler: true })
    expect(createEditorBridge(activity)?.canCut()).toBe(false)
  })

  it('не считает разрез доступным без менеджера команд редактора', () => {
    const { activity, drawnParts } = createFakeActivity({ withoutCommandManager: true })
    const bridge = createEditorBridge(activity)

    expect(bridge?.canEditElements()).toBe(true)
    expect(bridge?.hasCommandManager()).toBe(false)
    expect(bridge?.canCut()).toBe(false)
    expect(bridge?.applyCut('el-1', [LEFT, RIGHT])).toBe(false)
    expect(drawnParts()).toEqual({ 'el-1': OPEN_LINE })
  })

  it('делит элемент на две части: обе видны в редакторе, вторая уйдёт на сервер новой', () => {
    const { activity, drawnParts, partsToCreate } = createFakeActivity()
    const bridge = createEditorBridge(activity)

    expect(bridge?.applyCut('el-1', [LEFT, RIGHT])).toBe(true)

    expect(drawnParts()).toEqual({ 'el-1': LEFT, 'new-1': RIGHT })
    expect(partsToCreate()).toEqual([{ id: 'new-1', categoryId: 'vegetation_el' }])
  })

  it('отменяет разрез одним шагом и повторяет его', () => {
    const { activity, commands, drawnParts, partsToCreate } = createFakeActivity()
    createEditorBridge(activity)?.applyCut('el-1', [LEFT, RIGHT])

    commands.undo()
    expect(drawnParts()).toEqual({ 'el-1': OPEN_LINE })
    expect(partsToCreate()).toEqual([])
    // В истории редактора разрез — одна запись, а не две.
    expect(commands.canUndo()).toBe(false)

    commands.redo()
    expect(drawnParts()).toEqual({ 'el-1': LEFT, 'new-1': RIGHT })
    expect(partsToCreate()).toEqual([{ id: 'new-1', categoryId: 'vegetation_el' }])
  })

  it('после отмены редактор не следит за геометрией убранной части', () => {
    const { activity, commands, watchedGeometries } = createFakeActivity()
    createEditorBridge(activity)?.applyCut('el-1', [LEFT, RIGHT])
    expect(watchedGeometries()).toBe(2)

    commands.undo()

    expect(watchedGeometries()).toBe(1)
  })

  it('режет только что созданную часть ещё раз', () => {
    const { activity, drawnParts, partsToCreate } = createFakeActivity()
    const bridge = createEditorBridge(activity)
    bridge?.applyCut('el-1', [LEFT, RIGHT])

    const middle = [OPEN_LINE[1], OPEN_LINE[2]]
    const tail = [OPEN_LINE[2], OPEN_LINE[3]]
    expect(bridge?.applyCut('new-1', [middle, tail])).toBe(true)

    expect(drawnParts()).toEqual({ 'el-1': LEFT, 'new-1': middle, 'new-2': tail })
    expect(partsToCreate().map((part) => part.id)).toEqual(['new-1', 'new-2'])
  })

  it('размыкает кольцо одной частью и не создаёт новый элемент', () => {
    const { activity, commands, drawnParts, partsToCreate } = createFakeActivity({
      elements: [{ id: 'ring', coordinates: RING }],
    })
    const opened = [[41.4205, 44.84], ...RING]

    expect(createEditorBridge(activity)?.applyCut('ring', [opened])).toBe(true)
    expect(drawnParts()).toEqual({ ring: opened })
    expect(partsToCreate()).toEqual([])

    commands.undo()
    expect(drawnParts()).toEqual({ ring: RING })
  })

  it('не трогает линию, если вторую часть создать нельзя', () => {
    const { activity, commands, drawnParts } = createFakeActivity({ brokenFactory: true })

    expect(createEditorBridge(activity)?.applyCut('el-1', [LEFT, RIGHT])).toBe(false)

    expect(drawnParts()).toEqual({ 'el-1': OPEN_LINE })
    expect(commands.canUndo()).toBe(false)
  })

  it('не перехватывает правки редактора после разреза', () => {
    const { activity, commands, onChangeElementCoords, drawnParts } = createFakeActivity()
    createEditorBridge(activity)?.applyCut('el-1', [LEFT, RIGHT])

    // Пользователь двигает вершину сам: правка идёт обычным путём редактора.
    const attrs = activity.onViewAttrsRequest()
    const moved = [OPEN_LINE[0], [41.4205, 44.8401]]
    onChangeElementCoords(attrs.elements.get()[0], moved)

    expect(drawnParts()['el-1']).toEqual(moved)
    commands.undo()
    expect(drawnParts()['el-1']).toEqual(LEFT)
  })

  it('отказывает, если элемента с таким id нет', () => {
    const { activity, drawnParts } = createFakeActivity()
    const bridge = createEditorBridge(activity)

    expect(bridge?.applyCut('missing', [OPEN_LINE])).toBe(false)
    expect(drawnParts()).toEqual({ 'el-1': OPEN_LINE })
  })

  it('не пропускает больше двух частей', () => {
    const { activity, drawnParts } = createFakeActivity()
    const bridge = createEditorBridge(activity)

    expect(bridge?.applyCut('el-1', [OPEN_LINE, OPEN_LINE, OPEN_LINE])).toBe(false)
    expect(drawnParts()).toEqual({ 'el-1': OPEN_LINE })
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

  const clickAt = (controller: VegetationCutController, point: number[]) =>
    controller.handleMapClick([point[0] * 1e6, point[1] * 1e6])

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

  it('не показывает кнопку, если у редактора не нашлось менеджера команд', () => {
    // Без него разрез нельзя отменить целиком: лучше без кнопки, чем с
    // наложением линий после Ctrl+Z.
    mountToolbar()
    const { controller, activity } = createController({
      activity: { withoutCommandManager: true },
    })

    expect(controller.attachActivity(activity)).toBe(false)
    expect(getVegetationCutButton()).toBeNull()
    expect(document.documentElement.getAttribute(STATE_ATTR)).toBe('unsupported:commands')
  })

  it('делит линию в месте клика', () => {
    mountToolbar()
    const { controller, activity, drawnParts, partsToCreate } = createController()
    controller.attachActivity(activity)
    controller.toggle()

    expect(clickAt(controller, CUT_POINT)).toBe('cut')

    const parts = drawnParts()
    expect(Object.keys(parts)).toEqual(['el-1', 'new-1'])
    expect(parts['el-1'][0]).toEqual(OPEN_LINE[0])
    expect(parts['el-1'].at(-1)?.[0]).toBeCloseTo(CUT_POINT[0], 6)
    // Части стыкуются в точке разреза без зазора.
    expect(parts['new-1'][0]).toEqual(parts['el-1'].at(-1))
    expect(parts['new-1'].at(-1)).toEqual(OPEN_LINE[3])
    expect(partsToCreate()).toEqual([{ id: 'new-1', categoryId: 'vegetation_el' }])
  })

  it('отменяет разрез одним Ctrl+Z редактора', () => {
    mountToolbar()
    const { controller, activity, commands, drawnParts, partsToCreate } = createController()
    controller.attachActivity(activity)
    controller.toggle()
    clickAt(controller, CUT_POINT)

    commands.undo()

    expect(drawnParts()).toEqual({ 'el-1': OPEN_LINE })
    expect(partsToCreate()).toEqual([])
    expect(commands.canUndo()).toBe(false)
  })

  it('режет подряд, не выключая режим', () => {
    mountToolbar()
    const { controller, activity, drawnParts } = createController()
    controller.attachActivity(activity)
    controller.toggle()

    expect(clickAt(controller, [41.4205, 44.84])).toBe('cut')
    expect(clickAt(controller, [41.4225, 44.84])).toBe('cut')

    expect(Object.keys(drawnParts())).toEqual(['el-1', 'new-1', 'new-2'])
  })

  describe('замкнутая линия', () => {
    /** Точки на нижней и на правой стороне квадрата `RING`. */
    const FIRST_CLICK: number[] = [41.4205, 44.84]
    const SECOND_CLICK: number[] = [41.421, 44.8405]

    const openRingEditor = (onMessage?: (text: string) => void) => {
      mountToolbar()
      const context = createController({
        onMessage,
        activity: { elements: [{ id: 'ring', coordinates: RING }] },
      })
      context.controller.attachActivity(context.activity)
      context.controller.toggle()
      return context
    }

    it('первым кликом ставит первую границу и подсказывает, что делать дальше', () => {
      const onMessage = vi.fn()
      const { controller, drawnParts, partsToCreate } = openRingEditor(onMessage)

      expect(clickAt(controller, FIRST_CLICK)).toBe('opened')

      // Кольцо остаётся одной линией, которая начинается и кончается в точке клика.
      const parts = drawnParts()
      expect(Object.keys(parts)).toEqual(['ring'])
      expect(parts.ring).toHaveLength(RING.length + 1)
      expect(parts.ring[0][0]).toBeCloseTo(FIRST_CLICK[0], 6)
      expect(parts.ring.at(-1)).toEqual(parts.ring[0])
      expect(partsToCreate()).toEqual([])
      expect(onMessage).toHaveBeenCalledWith(
        'Первая граница поставлена — следующий клик разделит линию',
      )
    })

    it('вторым кликом делит кольцо на две части между двумя кликами', () => {
      const { controller, drawnParts, partsToCreate } = openRingEditor()
      clickAt(controller, FIRST_CLICK)

      expect(clickAt(controller, SECOND_CLICK)).toBe('cut')

      const parts = drawnParts()
      expect(Object.keys(parts)).toEqual(['ring', 'new-1'])
      expect(parts.ring[0][0]).toBeCloseTo(FIRST_CLICK[0], 6)
      expect(parts.ring.at(-1)?.[1]).toBeCloseTo(SECOND_CLICK[1], 6)
      // Части стыкуются в обеих точках: контур остаётся замкнутым.
      expect(parts['new-1'][0]).toEqual(parts.ring.at(-1))
      expect(parts['new-1'].at(-1)).toEqual(parts.ring[0])
      expect(partsToCreate()).toEqual([{ id: 'new-1', categoryId: 'vegetation_el' }])
    })

    it('клик по началу линии ставит первую границу без пустого шага в истории', () => {
      const { controller, commands, drawnParts } = openRingEditor()

      expect(clickAt(controller, RING[0])).toBe('opened')

      expect(drawnParts()).toEqual({ ring: RING })
      expect(commands.canUndo()).toBe(false)
      expect(clickAt(controller, SECOND_CLICK)).toBe('cut')
      expect(Object.keys(drawnParts())).toEqual(['ring', 'new-1'])
    })

    it('после отмены первой границы следующий клик снова ставит первую границу', () => {
      const { controller, commands, drawnParts } = openRingEditor()
      clickAt(controller, FIRST_CLICK)
      commands.undo()

      expect(clickAt(controller, SECOND_CLICK)).toBe('opened')

      expect(Object.keys(drawnParts())).toEqual(['ring'])
    })

    it('после отмены деления кольцо снова делится одним кликом', () => {
      const { controller, commands, drawnParts } = openRingEditor()
      clickAt(controller, FIRST_CLICK)
      clickAt(controller, SECOND_CLICK)
      commands.undo()

      expect(clickAt(controller, [41.4205, 44.841])).toBe('cut')

      expect(Object.keys(drawnParts())).toEqual(['ring', 'new-2'])
    })

    it('не делит кольцо вплотную к первой границе', () => {
      const onMessage = vi.fn()
      const { controller, drawnParts } = openRingEditor(onMessage)
      clickAt(controller, FIRST_CLICK)
      const afterFirstClick = drawnParts()

      expect(clickAt(controller, [41.420501, 44.84])).toBe('too-short')

      expect(drawnParts()).toEqual(afterFirstClick)
      expect(onMessage).toHaveBeenLastCalledWith('Слишком короткая часть — разрез не сделан')
    })

    it('забывает первую границу, когда редактор закрыт', () => {
      const { controller, activity } = openRingEditor()
      clickAt(controller, FIRST_CLICK)

      controller.detachActivity(activity)
      controller.attachActivity(activity)
      controller.toggle()

      expect(clickAt(controller, SECOND_CLICK)).toBe('opened')
    })
  })

  it('игнорирует клик мимо линии', () => {
    mountToolbar()
    const onMessage = vi.fn()
    const { controller, activity, drawnParts } = createController({ onMessage })
    controller.attachActivity(activity)
    controller.toggle()

    expect(clickAt(controller, [41.4205, 44.9])).toBe('miss')

    expect(drawnParts()).toEqual({ 'el-1': OPEN_LINE })
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('не режет у самого конца линии', () => {
    mountToolbar()
    const onMessage = vi.fn()
    const { controller, activity, drawnParts } = createController({ onMessage })
    controller.attachActivity(activity)
    controller.toggle()

    expect(clickAt(controller, OPEN_LINE[0])).toBe('too-short')

    expect(drawnParts()).toEqual({ 'el-1': OPEN_LINE })
    expect(onMessage).toHaveBeenCalledWith('Слишком короткая часть — разрез не сделан')
  })

  it('не режет, пока режим выключен', () => {
    mountToolbar()
    const { controller, activity, drawnParts } = createController()
    controller.attachActivity(activity)

    expect(clickAt(controller, CUT_POINT)).toBe('inactive')
    expect(drawnParts()).toEqual({ 'el-1': OPEN_LINE })
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

    expect(document.documentElement.getAttribute(STATE_ATTR)).toBe('ready:vegetation_el:1')

    controller.detachActivity(activity)
    expect(document.documentElement.getAttribute(STATE_ATTR)).toBe('idle')
  })

  it('убирает метку состояния со страницы при остановке', () => {
    const { controller } = createController()

    const stop = controller.start()
    expect(document.documentElement.hasAttribute(STATE_ATTR)).toBe(true)

    stop()
    expect(document.documentElement.hasAttribute(STATE_ATTR)).toBe(false)
  })

  it('не ведёт журнал активностей, пока отладка выключена', () => {
    const { controller, activity } = createController()

    controller.attachActivity(activity)

    expect(readActivityLog()).toBeUndefined()
  })

  it('ведёт журнал активностей при включённой отладке', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    localStorage.setItem(DEBUG_FLAG, '1')
    const { controller, activity } = createController()

    controller.attachActivity(activity)

    expect(readActivityLog()).toEqual([
      expect.objectContaining({
        categoryId: 'vegetation_fc',
        elementCategoryId: 'vegetation_el',
        elements: 1,
        canCut: true,
      }),
    ])
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
      .filter(([name]) => name === STATE_ATTR)
      .map(([, value]) => value)

    expect(states).toContain('hooked:0')
    expect(states.at(-1)).toBe('hooked:1')

    controller.stop()
  })

  it('не считает готовым редактор контейнера без элементов', () => {
    mountToolbar()
    const { controller, activity } = createController({ activity: { elements: [] } })

    expect(controller.attachActivity(activity)).toBe(false)
    expect(document.documentElement.getAttribute(STATE_ATTR)).toBe('wait:vegetation_el')
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
    expect(document.documentElement.getAttribute(STATE_ATTR)).toBe('ready:vegetation_el:1')

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
    expect(document.documentElement.getAttribute(STATE_ATTR)).toBe('ready:vegetation_el:1')
  })
})
