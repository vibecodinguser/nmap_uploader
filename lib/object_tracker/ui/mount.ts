import { TRACKER_PANEL_ID, TRACKER_TAB_ID } from './dom'
import { ensureTrackerStyles } from './styles'

export const TRACKER_TAB_LABEL = 'Мои объекты'

const TAB_CLASS = 'nk-tabs-bar__tab'
const TAB_SELECTED_CLASS = 'nk-tabs-bar__tab_selected'
const TABS_CONTAINER_CLASS = 'nk-tabs-bar__tabs'

export interface TrackerSidebarOptions {
  /** Вызывается при открытии нашей вкладки. */
  onActivate: () => void
}

/** Ищет контейнер вкладок нативной панели. */
export const findTabsContainer = (root: ParentNode = document): HTMLElement | null =>
  root.querySelector<HTMLElement>(`.nk-tabs-bar .${TABS_CONTAINER_CLASS}`)

/** Находит контент нативной вкладки — секцию сразу после полосы вкладок. */
export const findNativeContent = (tabsContainer: HTMLElement): HTMLElement | null => {
  const tabsBar = tabsContainer.closest<HTMLElement>('.nk-tabs-bar')
  const parent = tabsBar?.parentElement
  if (!tabsBar || !parent) {
    return null
  }

  const siblings = Array.from(parent.children)
  const tabsIndex = siblings.indexOf(tabsBar)
  if (tabsIndex < 0) {
    return null
  }

  // Контент идёт после полосы вкладок; шапку панели не берём.
  for (const sibling of siblings.slice(tabsIndex + 1)) {
    if (sibling instanceof HTMLElement && sibling.classList.contains('nk-section')) {
      return sibling
    }
  }

  return null
}

/**
 * Вкладка «Мои объекты» в панели редактора.
 *
 * Ведёт себя как нативная: встаёт последней в полосу вкладок и подменяет
 * содержимое панели, пока выбрана.
 */
export class ObjectTrackerSidebar {
  private readonly options: TrackerSidebarOptions
  private tabElement: HTMLElement | null = null
  private panelElement: HTMLElement | null = null
  private nativeContent: HTMLElement | null = null
  private active = false
  private listenerAttached = false

  constructor(options: TrackerSidebarOptions) {
    this.options = options
  }

  public isMounted(): boolean {
    return Boolean(this.tabElement?.isConnected && this.panelElement?.isConnected)
  }

  public isActive(): boolean {
    return this.active
  }

  public getPanel(): HTMLElement | null {
    return this.panelElement
  }

  /**
   * Монтирует вкладку и панель в текущую разметку.
   * Идемпотентна: при повторном вызове ничего не дублирует.
   */
  public mount(): boolean {
    ensureTrackerStyles()

    const tabsContainer = findTabsContainer()
    if (!tabsContainer) {
      return false
    }

    if (this.isMounted()) {
      return true
    }

    const tab = document.createElement('div')
    tab.id = TRACKER_TAB_ID
    tab.className = `${TAB_CLASS} nmap-ot-tab`
    tab.textContent = TRACKER_TAB_LABEL
    tab.setAttribute('role', 'tab')
    tab.setAttribute('aria-selected', 'false')
    tab.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.activate()
    })

    const panel = document.createElement('div')
    panel.id = TRACKER_PANEL_ID
    panel.className = 'nmap-ot-panel'
    panel.style.display = 'none'

    const tabsBar = tabsContainer.closest<HTMLElement>('.nk-tabs-bar')
    if (!tabsBar) {
      return false
    }

    this.nativeContent = findNativeContent(tabsContainer)

    tabsContainer.appendChild(tab)
    tabsBar.insertAdjacentElement('afterend', panel)

    this.tabElement = tab
    this.panelElement = panel

    this.attachNativeTabListener()
    return true
  }

  /** Снимает вкладку и панель, возвращая нативное содержимое. */
  public unmount(): void {
    this.deactivate()
    this.tabElement?.remove()
    this.panelElement?.remove()
    this.tabElement = null
    this.panelElement = null
    this.nativeContent = null
    this.detachNativeTabListener()
  }

  /** Показывает точку «есть новое» на вкладке. */
  public setHasUnread(hasUnread: boolean): void {
    this.tabElement?.classList.toggle('nmap-ot-tab-unread', hasUnread)
  }

  /** Открывает нашу вкладку. */
  public activate(): void {
    if (!this.tabElement || !this.panelElement) {
      return
    }

    this.active = true

    const tabs = this.tabElement.parentElement?.querySelectorAll<HTMLElement>(`.${TAB_CLASS}`)
    tabs?.forEach((element) => {
      element.classList.toggle(TAB_SELECTED_CLASS, element === this.tabElement)
      element.setAttribute('aria-selected', element === this.tabElement ? 'true' : 'false')
    })

    if (this.nativeContent) {
      this.nativeContent.style.display = 'none'
    }
    this.panelElement.style.display = ''

    this.options.onActivate()
  }

  /** Возвращает нативную вкладку. */
  public deactivate(): void {
    if (!this.tabElement || !this.panelElement) {
      return
    }

    this.active = false
    this.tabElement.classList.remove(TAB_SELECTED_CLASS)
    this.tabElement.setAttribute('aria-selected', 'false')
    this.panelElement.style.display = 'none'

    if (this.nativeContent) {
      this.nativeContent.style.display = ''
    }
  }

  private handleDocumentClick = (event: MouseEvent): void => {
    if (!this.active) {
      return
    }

    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    const tab = target.closest<HTMLElement>(`.${TAB_CLASS}`)
    if (!tab || tab === this.tabElement) {
      return
    }

    this.deactivate()
  }

  private attachNativeTabListener(): void {
    if (this.listenerAttached) {
      return
    }
    document.addEventListener('click', this.handleDocumentClick, true)
    this.listenerAttached = true
  }

  private detachNativeTabListener(): void {
    if (!this.listenerAttached) {
      return
    }
    document.removeEventListener('click', this.handleDocumentClick, true)
    this.listenerAttached = false
  }
}
