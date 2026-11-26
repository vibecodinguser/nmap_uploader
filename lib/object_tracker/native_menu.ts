/**
 * Пункт «Наблюдать» / «Не наблюдать» в нативном меню объекта редактора.
 *
 * Меню «Ещё» (`nk-icon_id_more`) в шапке карточки объекта рендерится порталом
 * (`.nk-portal > .nk-popup > .nk-popup__content > .nk-menu`) и переиспользуется
 * между открытиями: попап не создаётся заново, а получает класс
 * `nk-popup_visible`. Поэтому пункт вставляется один раз, а при каждом открытии
 * обновляется только его состояние.
 *
 * Своё меню не рисуем: подмена нативного попапа ломает штатное поведение
 * редактора. Пункт получает нативные классы `nk-menu-item`, поэтому выглядит
 * как остальные, включая тёмную тему.
 */
import { isElementVisible } from '@/lib/dom_visibility'
import { createTranslator, readNativeLocale, type TranslateFn } from '@/lib/i18n'
import { ensureTrackerStyles } from './ui/styles'
import { showTrackerToast } from './ui/toast'

export const NATIVE_MENU_ITEM_CLASS = 'nmap-ot-menu-item'
export const NATIVE_MENU_ITEM_DISABLED_CLASS = 'nmap-ot-menu-item_disabled'

/**
 * Иконка «Ещё» в шапке карточки объекта.
 *
 * Именно шапка: в карточке есть вторая такая иконка — разворачиватель списка
 * атрибутов (`.nk-labeled-list-layout__expand-control`), у неё своё меню.
 */
const NATIVE_MORE_ICON_SELECTORS = [
  '.nk-geoobject-viewer-view .nk-sidebar-header-view .nk-icon_id_more',
  '.nk-sidebar-header-view .nk-icon_id_more',
] as const

/**
 * Пункты, по которым узнаём меню объекта.
 *
 * Меню карты, справки, инструментов и фильтров тоже содержат `.nk-menu`, но
 * такого набора пунктов в них нет. У водоёмов и АТД редактор не показывает
 * часть действий, поэтому достаточно любого из пунктов.
 */
const NATIVE_OBJECT_MENU_MARKERS = ['Копировать', 'Поделиться', 'Сообщить об ошибке'] as const

const NATIVE_OBJECT_TITLE_SELECTOR = '.nk-geoobject-viewer-view .nk-sidebar-header-view__title'

const OBJECT_HASH_RE = /#!?\/objects\/(\d{1,20})/u
/** Меню открывается асинхронно: пробуем несколько раз, пока попап не появится. */
const SYNC_DELAYS_MS = [0, 40, 120, 300, 700] as const
/** Склейка пачки мутаций портала перед проверкой меню. */
const OBSERVER_SYNC_DELAY_MS = 30
/** После клика по «Ещё» меню считаем объектным, даже если набор пунктов незнаком. */
const TRUSTED_MENU_WINDOW_MS = 5000

/** Мутация относится к попапу меню: открытие (класс) или перерисовка содержимого. */
const isMenuMutation = (record: MutationRecord): boolean => {
  const target = record.target
  if (!(target instanceof Element)) return false

  if (record.type === 'attributes') {
    return target.classList.contains('nk-popup') || target.classList.contains('nk-menu')
  }

  return Boolean(
    target.closest('.nk-popup__content') ||
      target.closest('.nk-menu') ||
      target.classList.contains('nk-portal') ||
      target.classList.contains('nk-popup__content') ||
      target.classList.contains('nk-menu'),
  )
}

type NativeMenuActionResult = {
  ok: boolean
  error?: string
}

type ObjectTrackerNativeMenuOptions = {
  /** Объект уже наблюдается: пункт предлагает убрать его из наблюдения. */
  isTracked: (objectId: string) => boolean
  /** Есть место в списке наблюдения. */
  canAdd: () => boolean
  /** Добавляет объект; ошибки показываются коротким сообщением. */
  onAdd: (objectId: string, title: string) => Promise<NativeMenuActionResult>
  /** Убирает объект из наблюдения. */
  onRemove: (objectId: string) => Promise<NativeMenuActionResult>
  /** Подменяется в тестах. */
  translate?: TranslateFn
}

type NativeMenuContext = {
  objectId: string
  title: string
}

/** Текст пункта без различий в пробелах: редактор ставит неразрывные пробелы. */
const normalizeMenuText = (value: string | null): string =>
  (value ?? '').replace(/\s+/gu, ' ').trim()

/** Достаёт id объекта из hash редактора (`#!/objects/<id>`). */
export const readObjectIdFromUrl = (href: string): string | null => {
  try {
    const match = new URL(href).hash.match(OBJECT_HASH_RE)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

/** Название объекта из шапки карточки; пусто, если карточка ещё не отрисована. */
export const readObjectTitle = (root: ParentNode = document): string => {
  const title = root.querySelector<HTMLElement>(NATIVE_OBJECT_TITLE_SELECTOR)
  return title?.textContent?.trim() ?? ''
}

/**
 * Проверяет, что меню — меню объекта, а не карты, справки или фильтров.
 *
 * Набор пунктов у разных категорий отличается: у водоёмов и АТД редактор
 * может не показывать часть действий, поэтому достаточно одного узнаваемого
 * пункта. Меню справки, инструментов и фильтров таких пунктов не содержат.
 */
export const isObjectMenu = (menu: HTMLElement): boolean => {
  const texts = Array.from(menu.querySelectorAll<HTMLElement>('.nk-menu-item')).map((item) =>
    normalizeMenuText(item.textContent),
  )
  return NATIVE_OBJECT_MENU_MARKERS.some((marker) => texts.includes(marker))
}

/**
 * Ищет открытое меню объекта среди попапов портала.
 *
 * `allowAnyMenu` включается сразу после клика по иконке «Ещё»: тогда меню
 * точно наше, даже если редактор собрал для категории непривычный набор
 * пунктов.
 */
export const findObjectMenu = (
  root: ParentNode = document,
  allowAnyMenu = false,
): HTMLElement | null => {
  // Меню может рендериться и в портал, и локально внутри карточки: берём любой
  // видимый попап с меню, а не только `.nk-portal`.
  const popups = root.querySelectorAll<HTMLElement>('.nk-popup.nk-popup_visible')
  let fallback: HTMLElement | null = null

  for (const popup of popups) {
    if (!isElementVisible(popup)) continue

    const content = popup.querySelector<HTMLElement>('.nk-popup__content')
    if (!content) continue

    for (const child of Array.from(content.children)) {
      if (!(child instanceof HTMLElement) || !child.classList.contains('nk-menu')) continue
      if (isObjectMenu(child)) return child
      fallback ??= child
    }
  }

  return allowAnyMenu ? fallback : null
}

/** Клик пришёлся по иконке «Ещё» в карточке объекта. */
const isMoreIconTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  return NATIVE_MORE_ICON_SELECTORS.some((selector) => Boolean(target.closest(selector)))
}

export class ObjectTrackerNativeMenu {
  private readonly options: ObjectTrackerNativeMenuOptions
  private started = false
  private context: NativeMenuContext | null = null
  private item: HTMLElement | null = null
  private syncTimers: Array<ReturnType<typeof setTimeout>> = []
  private observer: MutationObserver | null = null
  private observerTimer: ReturnType<typeof setTimeout> | null = null
  /** До этого момента меню, открытое после клика по «Ещё», считаем объектным. */
  private trustedMenuUntil = 0

  constructor(options: ObjectTrackerNativeMenuOptions) {
    this.options = options
  }

  public start(): void {
    if (this.started || typeof document === 'undefined') return
    this.started = true
    ensureTrackerStyles()
    document.addEventListener('click', this.handleDocumentClick, true)
    document.addEventListener('keydown', this.handleDocumentKeydown, true)
    this.startObserver()
    this.sync()
  }

  public stop(): void {
    if (!this.started) return
    this.started = false
    document.removeEventListener('click', this.handleDocumentClick, true)
    document.removeEventListener('keydown', this.handleDocumentKeydown, true)
    this.stopObserver()
    this.cancelScheduledSync()
    this.context = null
    this.removeMenuItem()
  }

  /** Обновляет пункт в открытом меню: после добавления из панели или из меню. */
  public sync(): void {
    if (!this.started) return

    const trusted = Date.now() < this.trustedMenuUntil
    const menu = findObjectMenu(document, trusted)
    if (!menu) return

    // URL редактора — источник истины: карточка могла смениться без нашего
    // клика по «Ещё» (переход по истории объекта, возврат назад).
    const context = this.readPageContext() ?? this.context
    if (!context) return

    this.context = context
    const item = this.ensureMenuItem(menu)
    this.applyItemState(item, context)
  }

  private handleDocumentClick = (event: MouseEvent): void => {
    if (!isMoreIconTarget(event.target)) return
    this.rememberMenuContext()
  }

  private handleDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (!isMoreIconTarget(event.target)) return
    this.rememberMenuContext()
  }

  /**
   * Запоминает объект и открывает «доверенное окно».
   *
   * Набор пунктов у водоёмов и АТД отличается от обычных объектов, поэтому
   * сразу после клика по «Ещё» меню считаем объектным без проверки маркеров.
   */
  private rememberMenuContext(): void {
    const context = this.readPageContext()
    if (!context) {
      this.context = null
      return
    }

    this.context = context
    this.trustedMenuUntil = Date.now() + TRUSTED_MENU_WINDOW_MS
    this.scheduleSync()
  }

  private readPageContext(): NativeMenuContext | null {
    if (typeof window === 'undefined') return null
    const objectId = readObjectIdFromUrl(window.location.href)
    if (!objectId) return null
    return { objectId, title: readObjectTitle() }
  }

  /**
   * Следит за порталом редактора.
   *
   * Попап меню переиспользуется: он получает класс `nk-popup_visible` и
   * перерисовывает содержимое. Наблюдатель ловит и открытие, и перерисовку,
   * поэтому пункт возвращается даже если React пересобрал меню.
   */
  private startObserver(): void {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return

    this.observer = new MutationObserver((records) => {
      if (!records.some(isMenuMutation)) return
      this.scheduleObserverSync()
    })
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })
  }

  private stopObserver(): void {
    this.observer?.disconnect()
    this.observer = null
    if (this.observerTimer !== null) {
      clearTimeout(this.observerTimer)
      this.observerTimer = null
    }
  }

  /** Склеивает пачку мутаций в один проход, чтобы не дёргать DOM на каждый узел. */
  private scheduleObserverSync(): void {
    if (this.observerTimer !== null) return
    this.observerTimer = setTimeout(() => {
      this.observerTimer = null
      this.sync()
    }, OBSERVER_SYNC_DELAY_MS)
  }

  private scheduleSync(): void {
    this.cancelScheduledSync()
    for (const delay of SYNC_DELAYS_MS) {
      this.syncTimers.push(setTimeout(() => this.sync(), delay))
    }
  }

  private cancelScheduledSync(): void {
    for (const timer of this.syncTimers) clearTimeout(timer)
    this.syncTimers = []
  }

  private ensureMenuItem(menu: HTMLElement): HTMLElement {
    const group = menu.querySelector<HTMLElement>('.nk-menu__group') ?? menu
    const existing = group.querySelector<HTMLElement>(`.${NATIVE_MENU_ITEM_CLASS}`)
    const item = existing ?? this.createMenuItem()

    // Пункт держим последним: «Удалить» — разрушающее действие, и за ним
    // не должно стоять наше. Редактор перерисовывает меню и может дописать
    // свой пункт после нас, поэтому место проверяем при каждой синхронизации.
    if (group.lastElementChild !== item) {
      group.appendChild(item)
    }

    this.item = item
    return item
  }

  private createMenuItem(): HTMLElement {
    const item = document.createElement('div')
    item.className = `nk-menu-item nk-menu-item_theme_islands nk-menu-item_size_m ${NATIVE_MENU_ITEM_CLASS}`
    item.setAttribute('role', 'menuitem')
    item.tabIndex = 0

    item.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      void this.activate()
    })
    item.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      void this.activate()
    })

    return item
  }

  private applyItemState(item: HTMLElement, context: NativeMenuContext): void {
    const t = this.translate()
    item.dataset.nmapObjectId = context.objectId
    item.dataset.nmapObjectTitle = context.title

    const isTracked = this.options.isTracked(context.objectId)
    const limitReached = !isTracked && !this.options.canAdd()
    const isDisabled = !isTracked && limitReached

    // Наблюдаемый объект получает активный пункт «Не наблюдать»: повторное
    // добавление невозможно, а снять наблюдение из карточки — ожидаемое действие.
    let label = t('objectTracker.menuTrack')
    if (isTracked) {
      label = t('objectTracker.menuUntrack')
    } else if (limitReached) {
      label = t('objectTracker.menuLimit')
    }

    if (item.textContent !== label) {
      item.textContent = label
    }
    item.dataset.nmapTracked = String(isTracked)
    item.classList.toggle(NATIVE_MENU_ITEM_DISABLED_CLASS, isDisabled)
    item.setAttribute('aria-disabled', String(isDisabled))
    item.tabIndex = isDisabled ? -1 : 0
  }

  private async activate(): Promise<void> {
    const item = this.item
    if (!item || item.classList.contains(NATIVE_MENU_ITEM_DISABLED_CLASS)) return

    const objectId = item.dataset.nmapObjectId ?? ''
    const title = item.dataset.nmapObjectTitle ?? ''
    // Смотрим на состояние пункта, а не на хранилище: оно обновляется
    // асинхронно, и повторное нажатие не должно превратиться в добавление.
    const tracked = item.dataset.nmapTracked === 'true'

    const result = tracked
      ? await this.options.onRemove(objectId)
      : await this.options.onAdd(objectId, title)

    if (!result.ok) {
      showTrackerToast(this.describeError(result.error, tracked))
      return
    }

    // Меню закрываем кликом по пустому месту страницы: редактор закрывает так
    // свой попап сам, и это не уводит со страницы.
    this.closeMenu()
  }

  /** Закрывает попап меню объекта кликом по пустому месту страницы. */
  private closeMenu(): void {
    if (typeof document === 'undefined') return
    document.body.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
    )
    document.body.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
    )
  }

  private describeError(error: string | undefined, tracked: boolean): string {
    const t = this.translate()
    switch (error) {
      case 'DUPLICATE':
        return t('objectTracker.errorDuplicate')
      case 'LIMIT_REACHED':
        return t('objectTracker.errorLimit')
      case 'INVALID_ID':
        return t('objectTracker.errorInvalidId')
      default:
        return t(tracked ? 'objectTracker.errorUntrack' : 'objectTracker.errorUnknown')
    }
  }

  private translate(): TranslateFn {
    return this.options.translate ?? createTranslator(readNativeLocale())
  }

  private removeMenuItem(): void {
    if (typeof document === 'undefined') return
    document.querySelectorAll(`.${NATIVE_MENU_ITEM_CLASS}`).forEach((element) => {
      element.remove()
    })
    this.item = null
  }
}
