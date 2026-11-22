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
  ensureVegetationCutButton,
  findOnMapToolbar,
  getVegetationCutButton,
  removeVegetationCutButton,
  setVegetationCutButtonActive,
} from './button'
import { installActivityHook } from './editor_access'
import { createEditorBridge, type VegetationCutEditor } from './editor_bridge'
import { type CutMapLike, type CutOutcome, readPageGlobalPixels, VegetationCutMode } from './mode'
import { isVegetationCategory, isVegetationLineCategory } from './vegetation'

export type VegetationCutControllerOptions = {
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

/**
 * Метка состояния на `<html>`: по ней из консоли видно, дошёл ли инструмент до
 * каждого этапа. Без неё «кнопки нет» одинаково выглядит и когда скрипт не
 * загружен, и когда редактор не поймали.
 *
 * Значения:
 * - `loaded` — скрипт исполнился, хук ещё не поставлен;
 * - `hooked:<N>` — хук активностей установлен, перехвачено N классов;
 * - `idle` — редактор закрыт;
 * - `other:<категория>` — открыт редактор не растительности;
 * - `wait:<категория>` — растительность открыта, но редактор ещё не готов резать;
 * - `unsupported:commands` — у редактора не нашёлся менеджер команд, разрез
 *   нельзя было бы отменить, поэтому инструмент выключен;
 * - `ready:<категория>:<элементов>` — кнопка доступна.
 *
 * Атрибут живёт, пока работает скрипт, и снимается при остановке.
 */
export const VEGETATION_CUT_STATE_ATTR = 'data-nmap-veg-cut'

/**
 * Журнал запусков активностей для разбора проблем: последние 50 записей.
 * Ведётся только при включённой отладке (`VEGETATION_CUT_DEBUG_FLAG`).
 */
export const VEGETATION_CUT_LOG_KEY = '__nmapVegCutLog'

/** Ключ `localStorage`: значение `'1'` включает журнал и подробный лог. */
export const VEGETATION_CUT_DEBUG_FLAG = 'nmap-veg-cut-debug'

export type VegetationCutLogEntry = {
  categoryId: string | null
  elementCategoryId: string | null
  elementRoleId: string | null
  elements: number
  canCut: boolean
  attrsKeys: string[] | null
}

const MAX_LOG_ENTRIES = 50

export const setVegetationCutState = (state: string): void => {
  try {
    document.documentElement.setAttribute(VEGETATION_CUT_STATE_ATTR, state)
  } catch {
    // Документ мог быть уже выгружен
  }
}

const clearVegetationCutState = (): void => {
  try {
    document.documentElement.removeAttribute(VEGETATION_CUT_STATE_ATTR)
  } catch {
    // Документ мог быть уже выгружен
  }
}

const isDebugEnabled = (): boolean => {
  try {
    return (
      typeof localStorage !== 'undefined' && localStorage.getItem(VEGETATION_CUT_DEBUG_FLAG) === '1'
    )
  } catch {
    // Хранилище может быть недоступно (настройки приватности)
    return false
  }
}

const appendLogEntry = (entry: VegetationCutLogEntry): void => {
  try {
    const target = globalThis as Record<string, unknown>
    const log = Array.isArray(target[VEGETATION_CUT_LOG_KEY])
      ? (target[VEGETATION_CUT_LOG_KEY] as VegetationCutLogEntry[])
      : []
    log.push(entry)
    if (log.length > MAX_LOG_ENTRIES) {
      log.splice(0, log.length - MAX_LOG_ENTRIES)
    }
    target[VEGETATION_CUT_LOG_KEY] = log
  } catch {
    // Журнал не должен ломать инструмент
  }
}

export class VegetationCutController {
  private readonly options: VegetationCutControllerOptions
  private readonly mode: VegetationCutMode
  /** Активность редактора растительности, запущенная сейчас. */
  private tracked: unknown = null
  private editor: VegetationCutEditor | null = null
  private clickHandler: ((event: MouseEvent) => void) | null = null
  private pressHandler: ((event: MouseEvent) => void) | null = null
  /** Где была нажата кнопка мыши: по сдвигу отличаем клик от перетаскивания. */
  private pressPoint: [number, number] | null = null
  private keyHandler: ((event: KeyboardEvent) => void) | null = null
  private observer: MutationObserver | null = null
  private cleanupHook: (() => void) | null = null

  constructor(options: VegetationCutControllerOptions) {
    this.options = options
    this.mode = new VegetationCutMode({
      getEditor: () => this.editor,
      onOutcome: (outcome) => this.handleOutcome(outcome),
    })
  }

  /** Подписывается на активности редактора и следит за тулбаром. Возвращает очистку. */
  public start(): () => void {
    this.stop()

    setVegetationCutState('loaded')

    // Состояние ставится до установки хука: если модули придут синхронно,
    // `onWrapped` уже не будет перезаписан нулём.
    setVegetationCutState('hooked:0')

    this.cleanupHook = installActivityHook(
      {
        onStart: (activity) => this.handleActivityStart(activity),
        onStop: (activity) => this.detachActivity(activity),
      },
      {
        observe: this.options.observe ?? observeWebpackModules,
        onWrapped: (count) => {
          // Пока не обёрнут ни один класс, редактор откроется мимо хука.
          // Это видно в состоянии: `hooked:0` — наблюдатель стоит, но модули
          // ещё не приходили; `hooked:N` — классы перехвачены.
          if (!this.tracked) setVegetationCutState(`hooked:${count}`)
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
    removeVegetationCutButton()
    clearVegetationCutState()
  }

  /**
   * Реагирует на запуск активности.
   *
   * Запоминаем последнюю растительную активность и пытаемся получить из неё
   * редактор. Возвращает `true`, если разрез уже доступен.
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
    setVegetationCutState('idle')
  }

  public detachEditor(): void {
    this.tracked = null
    this.editor = null
    this.mode.forgetRingSeams()
    this.setActive(false)
    this.removeKeyHandler()
    removeVegetationCutButton()
  }

  /** Переключает режим разреза. */
  public toggle(): void {
    this.setActive(!this.mode.isActive())
  }

  /** Обрабатывает клик по карте в глобальных пикселях. */
  public handleMapClick(globalPixels: [number, number]): CutOutcome {
    if (!this.mode.isActive()) return 'inactive'
    return this.mode.handleClick(globalPixels)
  }

  private handleActivityStart(activity: unknown): void {
    this.track(activity)
    this.promote()
    this.syncButton()
  }

  /**
   * Запоминает активность, если она про растительность.
   *
   * Редактор открывает несколько активностей подряд: контейнер объекта,
   * экран выбора контура, редактор топологии. Резать умеет только последний,
   * поэтому запоминаем любую растительную, а решаем по её возможностям.
   */
  private track(activity: unknown): void {
    const bridge = createEditorBridge(activity)
    if (!bridge) return

    const categoryId = bridge.getCategoryId()
    const elementCategoryId = bridge.getElementCategoryId()

    // Хук срабатывает на каждую активность приложения, поэтому подробности
    // собираем только по запросу.
    if (isDebugEnabled()) {
      const entry: VegetationCutLogEntry = {
        categoryId,
        elementCategoryId,
        elementRoleId: bridge.getElementRoleId(),
        elements: bridge.getElements().length,
        canCut: bridge.canCut(),
        attrsKeys: this.readAttrsKeys(activity),
      }
      appendLogEntry(entry)
      console.debug('[nmap_vegetation_cut] activity started', entry)
    }

    if (!isVegetationCategory(categoryId) && !isVegetationCategory(elementCategoryId)) {
      if (!this.editor) {
        setVegetationCutState(`other:${String(categoryId)}`)
      }
      return
    }

    // Редактор открывает активности вложенно: сначала редактор топологии,
    // затем контейнер объекта. Контейнер умеет меньше, поэтому не должен
    // вытеснять уже найденный рабочий редактор.
    if (bridge.canEditElements() || !this.isTrackedEditable()) {
      this.tracked = activity
    }
  }

  private isTrackedEditable(): boolean {
    if (!this.tracked) return false
    return createEditorBridge(this.tracked)?.canEditElements() === true
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
      return
    }

    const bridge = createEditorBridge(this.tracked)
    if (!bridge) {
      this.editor = null
      return
    }

    const elementCategoryId = bridge.getElementCategoryId()
    const categoryId = bridge.getCategoryId()

    if (!isVegetationLineCategory(elementCategoryId) && !isVegetationLineCategory(categoryId)) {
      this.editor = null
      setVegetationCutState(`wait:${String(categoryId)}`)
      return
    }

    const elements = bridge.getElements()
    if (!bridge.canEditElements() || elements.length === 0) {
      this.editor = null
      setVegetationCutState(`wait:${String(elementCategoryId ?? categoryId)}`)
      return
    }

    // Резать есть что, но отменить разрез было бы нечем: кнопку не показываем.
    if (!bridge.hasCommandManager()) {
      this.editor = null
      setVegetationCutState('unsupported:commands')
      return
    }

    this.editor = bridge
    setVegetationCutState(`ready:${String(elementCategoryId ?? categoryId)}:${elements.length}`)
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
      this.unsubscribeMapClicks()
    }

    const button = getVegetationCutButton()
    if (button) setVegetationCutButtonActive(button, active)
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
    this.logClick(outcome, event)
    if (LINE_HIT_OUTCOMES.has(outcome)) {
      event.stopPropagation()
    }
  }

  /** Подробный лог кликов: без него «клик ничего не делает» не разобрать. */
  private logClick(result: string, event: MouseEvent): void {
    if (!isDebugEnabled()) return
    const target = event.target instanceof Element ? event.target : null
    console.debug('[nmap_vegetation_cut] click', {
      result,
      target: target ? `${target.tagName.toLowerCase()}.${String(target.className)}` : null,
      point: [event.clientX, event.clientY],
    })
  }

  private syncButton(): void {
    // Элементы контура могли догрузиться после запуска активности.
    this.promote()

    if (!this.editor) {
      if (getVegetationCutButton()) {
        removeVegetationCutButton()
      }
      if (this.mode.isActive()) {
        this.setActive(false)
      }
      return
    }
    if (!findOnMapToolbar()) {
      return
    }

    const translate = this.options.getTranslator()
    ensureVegetationCutButton({
      label: translate('vegetationCut.button'),
      onClick: () => this.toggle(),
    })

    const button = getVegetationCutButton()
    if (button) setVegetationCutButtonActive(button, this.mode.isActive())
  }

  private handleOutcome(outcome: CutOutcome): void {
    if (outcome === 'cut' || outcome === 'miss' || outcome === 'no-editor') {
      return
    }

    const translate = this.options.getTranslator()
    const message =
      outcome === 'opened'
        ? translate('vegetationCut.ringOpened')
        : outcome === 'too-short'
          ? translate('vegetationCut.tooShort')
          : outcome === 'not-vegetation'
            ? translate('vegetationCut.notVegetation')
            : translate('vegetationCut.unsupported')

    this.options.onMessage?.(message)
  }
}
