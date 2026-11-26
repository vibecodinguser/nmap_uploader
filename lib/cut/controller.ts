/**
 * Связка режима разреза с редактором, тулбаром и картой.
 *
 * Контроллер — единственное место, где инструмент знает про DOM и карту:
 * ставит кнопку в нативный тулбар, ловит запуск активности редактора,
 * слушает клики мышью по карте на время работы режима и убирает всё за собой.
 *
 * Клики берутся из DOM, а не из событий `ymaps.Map`: событие `click` карты
 * срабатывает только на пустом месте, а клик по линии или вершине достаётся
 * геообъекту и до карты не доходит. Резать же нужно именно по линии.
 *
 * Важная особенность редактора НЯК: у объекта с несколькими контурами
 * открывается сначала экран выбора контура, а редактор топологии стартует
 * позже и подгружает элементы асинхронно. Поэтому «можно резать» проверяется
 * не один раз при запуске активности, а при каждой перерисовке интерфейса.
 */

import type { TranslateFn } from '@/lib/i18n'
import { observeWebpackModules } from '@/lib/nmaps_webpack_module_observer'
import {
  ensureCutButton,
  findOnMapToolbar,
  getCutButton,
  removeAllCutButtons,
  removeCutButton,
  setCutButtonActive,
} from './button'
import {
  appendLogEntry,
  type CutLogEntry,
  clearCutState,
  isDebugEnabled,
  setCutState,
} from './diagnostics'
import { installActivityHook } from './editor_access'
import { type CutEditor, createEditorBridge } from './editor_bridge'
import { type CutMapLike, CutMode, type CutOutcome, readPageGlobalPixels } from './mode'
import { type CutPins, createCutPins } from './pins'
import { CUT_TARGETS, type CutTarget, isCutTargetCategory, isLineCategory } from './targets'

type CutControllerOptions = {
  getTranslator: () => TranslateFn
  /** Показ сообщения пользователю; подменяется в тестах. */
  onMessage?: (text: string) => void
  /** Подписка на модули НЯК; подменяется в тестах. */
  observe?: (
    globalObject: Record<string, unknown>,
    chunkName: string,
    onModule: (exports: unknown, moduleId: string) => void,
  ) => () => void
}

/**
 * Панель событий `ymaps`: единственный элемент, которому браузер отдаёт клики
 * по карте, линиям и вершинам. Меню вершины, балуны и элементы управления
 * лежат в контейнере карты рядом с ней и картой не считаются.
 */
const MAP_SURFACE_SELECTOR = '[class*="events-pane"]'

/** Сдвиг указателя между нажатием и отпусканием, после которого это перетаскивание, px. */
const DRAG_THRESHOLD_PX = 5

/** Исходы, при которых клик попал в линию: редактору такой клик не отдаём. */
const LINE_HIT_OUTCOMES: ReadonlySet<CutOutcome> = new Set([
  'cut',
  'opened',
  'too-short',
  'unsupported',
])

const readMapContainer = (map: CutMapLike): Element | null => {
  try {
    return map.container?.getElement?.() ?? null
  } catch {
    // Карта могла быть уничтожена
    return null
  }
}

/** Клик пришёлся на саму карту, а не на меню, балун или интерфейс поверх неё. */
const isMapSurfaceTarget = (target: EventTarget | null, map: CutMapLike): boolean => {
  const container = readMapContainer(map)
  if (!container || !(target instanceof Element)) return false
  const surface = target.closest(MAP_SURFACE_SELECTOR)
  return surface !== null && container.contains(surface)
}

export {
  CUT_STATE_ATTR,
  setCutState,
} from './diagnostics'

export class CutController {
  private readonly options: CutControllerOptions
  private readonly mode: CutMode
  /** Активность редактора, запущенная сейчас. */
  private tracked: unknown = null
  /** Умеет ли запомненная активность править элементы: решается при чтении её attrs. */
  private trackedEditable = false
  private editor: CutEditor | null = null
  /** Цель разреза для открытого объекта: растительность или водоём. */
  private target: CutTarget | null = null
  private clickHandler: ((event: MouseEvent) => void) | null = null
  private pressHandler: ((event: MouseEvent) => void) | null = null
  /** Где была нажата кнопка мыши: по сдвигу отличаем клик от перетаскивания. */
  private pressPoint: [number, number] | null = null
  private keyHandler: ((event: KeyboardEvent) => void) | null = null
  private observer: MutationObserver | null = null
  private cleanupHook: (() => void) | null = null
  /** Маркеры разрезов на карте: тот же вид, что у нативных точек разреза. */
  private readonly pins: CutPins

  constructor(options: CutControllerOptions) {
    this.options = options
    this.mode = new CutMode({
      getEditor: () => this.editor,
      onOutcome: (outcome) => this.handleOutcome(outcome),
    })
    this.pins = createCutPins(() => this.editor?.getMap() ?? null)
  }

  /** Подписывается на активности редактора и следит за тулбаром. Возвращает очистку. */
  public start(): () => void {
    this.stop()

    setCutState('loaded')

    // Состояние ставится до установки хука: если модули придут синхронно,
    // `onWrapped` уже не будет перезаписан нулём.
    setCutState('hooked:0')

    this.cleanupHook = installActivityHook(
      {
        onStart: (activity) => {
          this.attachActivity(activity)
        },
        onStop: (activity) => this.detachActivity(activity),
      },
      {
        observe: this.options.observe ?? observeWebpackModules,
        onWrapped: (count) => {
          // Пока не обёрнут ни один класс, редактор откроется мимо хука.
          // Это видно в состоянии: `hooked:0` — наблюдатель стоит, но модули
          // ещё не приходили; `hooked:N` — классы перехвачены.
          if (!this.tracked) setCutState(`hooked:${count}`)
        },
      },
    )

    this.observer = new MutationObserver(() => this.syncButton())
    this.observer.observe(document.documentElement, { childList: true, subtree: true })

    return () => this.stop()
  }

  public stop(): void {
    this.setActive(false)
    this.detachEditor()
    this.observer?.disconnect()
    this.observer = null
    this.cleanupHook?.()
    this.cleanupHook = null
    removeAllCutButtons(CUT_TARGETS)
    clearCutState()
  }

  /**
   * Реагирует на запуск активности.
   *
   * Запоминаем подходящую активность и пытаемся получить из неё редактор.
   * Возвращает `true`, если разрез уже доступен.
   */
  public attachActivity(activity: unknown): boolean {
    this.track(activity)
    this.promote()
    this.syncButton()
    return this.editor !== null
  }

  /** Реагирует на остановку активности: чужую не трогаем. */
  public detachActivity(activity: unknown): void {
    if (this.tracked === null) return
    if (activity !== this.tracked) return
    this.detachEditor()
    setCutState('idle')
  }

  public detachEditor(): void {
    this.tracked = null
    this.trackedEditable = false
    this.editor = null
    this.target = null
    this.mode.forgetRingSeams()
    this.pins.clear()
    this.setActive(false)
    this.removeKeyHandler()
    removeAllCutButtons(CUT_TARGETS)
  }

  /** Переключает режим разреза. */
  public toggle(): void {
    this.setActive(!this.mode.isActive())
  }

  /** Точки разрезов текущей сессии: их же показывают маркеры на карте. */
  public getCutPoints(): number[][] {
    return this.mode.getCutPoints()
  }

  /** Обрабатывает клик по карте в глобальных пикселях. */
  public handleMapClick(globalPixels: [number, number]): CutOutcome {
    if (!this.mode.isActive()) return 'inactive'
    return this.mode.handleClick(globalPixels)
  }

  /**
   * Запоминает активность, если она относится к одной из целей разреза.
   *
   * Редактор открывает несколько активностей подряд: контейнер объекта,
   * экран выбора контура, редактор топологии. Резать умеет только последний,
   * поэтому запоминаем любую подходящую, а решаем по её возможностям.
   */
  private track(activity: unknown): void {
    const bridge = createEditorBridge(activity)
    if (!bridge) return

    const categoryId = bridge.getCategoryId()
    const elementCategoryId = bridge.getElementCategoryId()

    // Хук срабатывает на каждую активность приложения, поэтому подробности
    // собираем только по запросу.
    if (isDebugEnabled()) {
      const entry: CutLogEntry = {
        categoryId,
        elementCategoryId,
        elementRoleId: bridge.getElementRoleId(),
        elements: bridge.getElements().length,
        canCut: bridge.canCut(),
        attrsKeys: this.readAttrsKeys(activity),
      }
      appendLogEntry(entry)
      console.debug('[nmap_cut] activity started', entry)
    }

    if (!isCutTargetCategory(categoryId) && !isCutTargetCategory(elementCategoryId)) {
      if (!this.editor) {
        setCutState(`other:${String(categoryId)}`)
      }
      return
    }

    // Редактор открывает активности вложенно: сначала редактор топологии,
    // затем контейнер объекта. Контейнер умеет меньше, поэтому не должен
    // вытеснять уже найденный рабочий редактор.
    const canEdit = bridge.canEditElements()
    if (canEdit || !this.trackedEditable) {
      this.tracked = activity
      this.trackedEditable = canEdit
    }
  }

  private readAttrsKeys(activity: unknown): string[] | null {
    try {
      const attrs = (activity as { onViewAttrsRequest?: () => unknown }).onViewAttrsRequest?.()
      return attrs && typeof attrs === 'object' ? Object.keys(attrs) : null
    } catch {
      return null
    }
  }

  /**
   * Пытается получить из запомненной активности готовый редактор.
   *
   * Элементы контура подгружаются асинхронно, поэтому вызывается не только при
   * запуске активности, но и при каждой перерисовке интерфейса.
   */
  private promote(): void {
    if (!this.tracked) {
      this.editor = null
      this.trackedEditable = false
      return
    }

    const bridge = createEditorBridge(this.tracked)
    if (!bridge) {
      this.editor = null
      this.trackedEditable = false
      return
    }

    // Заодно обновляем возможности запомненной активности: элементы контура
    // могли догрузиться уже после её запуска.
    const canEdit = bridge.canEditElements()
    this.trackedEditable = canEdit

    const elementCategoryId = bridge.getElementCategoryId()
    const categoryId = bridge.getCategoryId()
    const target = bridge.getTarget()

    if (
      !target ||
      (!isLineCategory(target, elementCategoryId) && !isLineCategory(target, categoryId))
    ) {
      this.editor = null
      this.target = null
      setCutState(`wait:${String(categoryId)}`)
      return
    }

    const elements = bridge.getElements()
    if (!canEdit || elements.length === 0) {
      this.editor = null
      this.target = null
      setCutState(`wait:${String(elementCategoryId ?? categoryId)}`)
      return
    }

    // Резать есть что, но отменить разрез было бы нечем: кнопку не показываем.
    if (!bridge.hasCommandManager()) {
      this.editor = null
      this.target = null
      setCutState('unsupported:commands')
      return
    }

    this.editor = bridge
    this.target = target
    setCutState(`ready:${String(elementCategoryId ?? categoryId)}:${elements.length}`)
  }

  private installKeyHandler(): void {
    if (this.keyHandler) return
    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.mode.isActive()) {
        this.setActive(false)
      }
    }
    document.addEventListener('keydown', this.keyHandler, true)
  }

  private removeKeyHandler(): void {
    if (!this.keyHandler) return
    document.removeEventListener('keydown', this.keyHandler, true)
    this.keyHandler = null
  }

  private setActive(active: boolean): void {
    if (active === this.mode.isActive()) {
      if (active) this.subscribeMapClicks()
      return
    }

    if (active) {
      if (!this.editor) return
      this.mode.start()
      this.installKeyHandler()
      this.subscribeMapClicks()
    } else {
      this.mode.stop()
      this.mode.forgetCutPoints()
      this.unsubscribeMapClicks()
      this.pins.clear()
    }

    if (this.target) {
      const button = getCutButton(this.target)
      if (button) setCutButtonActive(button, active)
    }
  }

  private subscribeMapClicks(): void {
    if (this.clickHandler) return

    this.pressHandler = (event: MouseEvent) => {
      this.pressPoint = [event.clientX, event.clientY]
    }
    this.clickHandler = (event: MouseEvent) => this.handleDomClick(event)

    // Фаза перехвата на документе: обработчик срабатывает раньше редактора и
    // может не отдать ему клик, которым уже разрезана линия.
    document.addEventListener('pointerdown', this.pressHandler, true)
    document.addEventListener('mousedown', this.pressHandler, true)
    document.addEventListener('click', this.clickHandler, true)
  }

  private unsubscribeMapClicks(): void {
    if (this.pressHandler) {
      document.removeEventListener('pointerdown', this.pressHandler, true)
      document.removeEventListener('mousedown', this.pressHandler, true)
    }
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true)
    }
    this.pressHandler = null
    this.clickHandler = null
    this.pressPoint = null
  }

  private handleDomClick(event: MouseEvent): void {
    const press = this.pressPoint
    this.pressPoint = null

    if (!this.mode.isActive() || event.button !== 0) return

    const map = this.editor?.getMap() ?? null
    if (!map) return

    if (!isMapSurfaceTarget(event.target, map)) {
      this.logClick('не карта', event)
      return
    }

    // Карту или вершину тащили: браузер всё равно пришлёт `click`.
    const moved = press ? Math.hypot(event.clientX - press[0], event.clientY - press[1]) : 0
    if (moved > DRAG_THRESHOLD_PX) {
      this.logClick('перетаскивание', event)
      return
    }

    const pixels = readPageGlobalPixels(map, [
      event.clientX + window.scrollX,
      event.clientY + window.scrollY,
    ])
    if (!pixels) {
      this.logClick('нет координат', event)
      return
    }

    const outcome = this.handleMapClick(pixels)
    if (outcome === 'cut' || outcome === 'opened') {
      this.pins.show(this.mode.getCutPoints())
    }
    this.logClick(outcome, event)
    if (LINE_HIT_OUTCOMES.has(outcome)) {
      event.stopPropagation()
    }
  }

  /** Подробный лог кликов: без него «клик ничего не делает» не разобрать. */
  private logClick(result: string, event: MouseEvent): void {
    if (!isDebugEnabled()) return
    const target = event.target instanceof Element ? event.target : null
    console.debug('[nmap_cut] click', {
      result,
      target: target ? `${target.tagName.toLowerCase()}.${String(target.className)}` : null,
      point: [event.clientX, event.clientY],
    })
  }

  private syncButton(): void {
    // Элементы контура могли догрузиться после запуска активности.
    this.promote()

    const target = this.target
    if (!this.editor || !target) {
      removeAllCutButtons(CUT_TARGETS)
      if (this.mode.isActive()) {
        this.setActive(false)
      }
      return
    }
    if (!findOnMapToolbar()) {
      return
    }

    // Кнопка другой цели могла остаться от предыдущего объекта.
    for (const other of CUT_TARGETS) {
      if (other.id !== target.id) removeCutButton(other)
    }

    const translate = this.options.getTranslator()
    ensureCutButton({
      target,
      label: translate(target.labelKey),
      onClick: () => this.toggle(),
    })

    const button = getCutButton(target)
    if (button) setCutButtonActive(button, this.mode.isActive())
  }

  private handleOutcome(outcome: CutOutcome): void {
    if (outcome === 'cut' || outcome === 'miss' || outcome === 'no-editor') {
      return
    }

    const translate = this.options.getTranslator()
    const message =
      outcome === 'opened'
        ? translate('cut.ringOpened')
        : outcome === 'too-short'
          ? translate('cut.tooShort')
          : outcome === 'not-target'
            ? translate('cut.notTarget')
            : translate('cut.unsupported')

    this.options.onMessage?.(message)
  }
}
