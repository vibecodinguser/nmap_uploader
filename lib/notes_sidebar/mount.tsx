import { createRoot, type Root } from 'react-dom/client'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { OccupiedDatesProvider } from '@/hooks/useOccupiedDates'
import { isElementVisible } from '@/lib/dom_visibility'
import { createTranslator, getStoredLocale } from '@/lib/i18n'
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale'
import { getStoredNotesButtonEnabled, NOTES_BUTTON_ENABLED_STORAGE_KEY } from '@/lib/notes_button'
import { parseStaticSvg } from '@/lib/parse_static_svg'
import {
  GROUPS_CONTENT_SELECTOR,
  GROUPS_VIEW_MARGIN_TOP,
  GROUPS_VIEW_SELECTOR,
  HEADER_SELECTOR,
  HEADER_TITLE_SELECTOR,
  ISLAND_CLASS,
  NOTES_BACK_ID,
  NOTES_TILE_ID,
  SUGGEST_COLLAPSED_CLASS,
  SUGGEST_SELECTOR,
  TITLE_SHIFT_CLASS_RE,
} from './core'
import { NOTES_BACK_ICON_SVG, NOTES_TILE_ICON_SVG } from './icons'
import { ensureNotesSidebarStyles, removeNotesSidebarStyles } from './styles'
import { NotesCreatePanel } from './ui'

const SYNC_INTERVAL_MS = 1000

/** Пока панели нет, опрашиваем чаще: иначе плитка появляется с задержкой до секунды. */
const WAIT_SYNC_INTERVAL_MS = 100

/** Панель выбора категорий: закрытые копии остаются в DOM, поэтому ищем видимую. */
export const findGroupsView = (): HTMLElement | null => {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(GROUPS_VIEW_SELECTOR))
  return candidates.find(isElementVisible) ?? null
}

/**
 * Блок создания заметки в панели выбора категорий.
 *
 * Панель перерисовывается фреймворком редактора, поэтому вставленные узлы
 * проверяются по таймеру: как только узел пропал, он возвращается на место.
 * Сам React-корень при этом не пересоздаётся — состояние формы переживает
 * перерисовку, пока панель не закрыта.
 *
 * Навигация повторяет нативный переход в группу категорий: стрелка «Назад»
 * встаёт в шапку панели на место отступа заголовка, а блок «Недавно созданные»
 * под списком скрывается.
 */
export class NotesCreateSidebar {
  private tile: HTMLButtonElement | null = null
  private host: HTMLDivElement | null = null
  private root: Root | null = null
  private backColumn: HTMLElement | null = null
  private lastHeader: HTMLElement | null = null
  private savedTitleShift: string | null = null
  private savedViewMarginTop: string | null = null
  private hiddenElements = new Set<HTMLElement>()
  private hiddenDisplays = new WeakMap<HTMLElement, string>()
  private observer: MutationObserver | null = null
  private syncQueued = false
  private headerWarned = false
  private active = false
  private enabled = false
  private resetToken = 0
  private label = ''
  private backLabel = ''
  private heartbeat: ReturnType<typeof setTimeout> | null = null
  private started = false

  public async start(): Promise<void> {
    if (this.started) return
    this.started = true

    ensureNotesSidebarStyles()
    await this.refreshSettings()

    browser.storage.onChanged.addListener(this.handleStorageChange)
    this.sync()
  }

  public stop(): void {
    this.started = false
    browser.storage.onChanged.removeListener(this.handleStorageChange)
    this.stopObserver()
    this.clearHeartbeat()

    this.unmount()
    removeNotesSidebarStyles()
  }

  /** Видимая панель появилась заново — показываем плитку без ожидания таймера. */
  public sync(): void {
    try {
      this.syncNow()
    } catch (error: unknown) {
      console.warn('[nmap_uploader] notes sidebar sync failed:', error)
    } finally {
      this.scheduleNextSync()
    }
  }

  private syncNow(): void {
    if (!this.enabled) {
      this.unmount()
      return
    }

    const view = findGroupsView()
    if (!view) {
      this.unmount()
      return
    }

    const content = view.querySelector<HTMLElement>(GROUPS_CONTENT_SELECTOR)
    if (!content) return

    this.ensureTile(content)
    this.ensurePanel(content)
    this.applyMode(view, content)
  }

  /**
   * Пока панель закрыта, опрашиваем часто: пользователь только что нажал
   * «Создать», и ждать секунду до появления плитки нельзя. Когда плитка на
   * месте — возвращаемся к редкому опросу, чтобы не грузить редактор.
   */
  private scheduleNextSync(): void {
    this.clearHeartbeat()

    if (!this.started || !this.enabled) {
      return
    }

    const delay = this.tile?.isConnected ? SYNC_INTERVAL_MS : WAIT_SYNC_INTERVAL_MS
    this.heartbeat = setTimeout(() => {
      this.heartbeat = null
      this.sync()
    }, delay)
  }

  private clearHeartbeat(): void {
    if (this.heartbeat === null) return
    clearTimeout(this.heartbeat)
    this.heartbeat = null
  }

  /** Пока блок открыт, ловим перерисовку панели и возвращаем стрелку сразу. */
  private startObserver(): void {
    if (this.observer) return
    this.observer = new MutationObserver(() => {
      if (!this.active) return
      this.queueSync()
    })
    this.observer.observe(document.body, { childList: true, subtree: true })
  }

  private stopObserver(): void {
    this.observer?.disconnect()
    this.observer = null
  }

  private queueSync(): void {
    if (this.syncQueued) return
    this.syncQueued = true
    requestAnimationFrame(() => {
      this.syncQueued = false
      this.sync()
    })
  }

  private handleStorageChange = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ): void => {
    if (area !== 'local') return
    if (!(NOTES_BUTTON_ENABLED_STORAGE_KEY in changes) && !(LOCALE_STORAGE_KEY in changes)) {
      return
    }

    this.refreshSettings()
      .then(() => this.sync())
      .catch(() => {})
  }

  private async refreshSettings(): Promise<void> {
    const [enabled, locale] = await Promise.all([getStoredNotesButtonEnabled(), getStoredLocale()])
    const translator = createTranslator(locale)
    this.enabled = enabled
    this.label = translator('map.notes')
    this.backLabel = translator('common.back')
  }

  private createTile(): HTMLButtonElement {
    const tile = document.createElement('button')
    tile.type = 'button'
    tile.id = NOTES_TILE_ID
    tile.className = 'nmap-notes-create__tile'
    tile.setAttribute('aria-expanded', 'false')

    const icon = document.createElement('span')
    icon.className = 'nmap-notes-create__tile-icon'
    icon.appendChild(parseStaticSvg(NOTES_TILE_ICON_SVG))

    const label = document.createElement('span')
    label.className = 'nmap-notes-create__tile-label'
    label.textContent = this.label

    tile.append(icon, label)
    tile.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.open()
    })

    return tile
  }

  private ensureTile(content: HTMLElement): void {
    if (!this.tile) {
      this.tile = this.createTile()
    }

    const label = this.tile.querySelector<HTMLElement>('.nmap-notes-create__tile-label')
    if (label && label.textContent !== this.label) {
      label.textContent = this.label
    }

    if (this.tile.parentElement !== content) {
      content.appendChild(this.tile)
    }
  }

  private ensurePanel(content: HTMLElement): void {
    const parent = content.parentElement ?? content

    if (!this.host || !this.root) {
      const host = document.createElement('div')
      this.host = host
      this.root = createRoot(host)
      this.renderPanel()
    }

    if (this.host.parentElement !== parent) {
      parent.appendChild(this.host)
    }
  }

  private renderPanel(): void {
    if (!this.root) return
    this.root.render(
      <LocaleProvider>
        <OccupiedDatesProvider isLoggedIn>
          <NotesCreatePanel key={this.resetToken} />
        </OccupiedDatesProvider>
      </LocaleProvider>,
    )
  }

  private createBackColumn(): HTMLElement {
    const column = document.createElement('div')
    column.className = 'nk-grid__col nmap-notes-back'

    const button = document.createElement('span')
    button.id = NOTES_BACK_ID
    button.className =
      'nk-icon nk-icon_id_back nk-icon_align_auto nk-icon_colored nk-icon_interactive nmap-notes-back__icon'
    button.setAttribute('role', 'button')
    button.setAttribute('tabindex', '0')
    button.setAttribute('aria-label', this.backLabel)
    button.setAttribute('title', this.backLabel)
    button.appendChild(parseStaticSvg(NOTES_BACK_ICON_SVG))

    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.close()
    })
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        this.close()
      }
    })

    column.appendChild(button)
    return column
  }

  private findHeader(view: HTMLElement): HTMLElement | null {
    const island = view.closest<HTMLElement>(`.${ISLAND_CLASS}`)
    const scoped = island?.querySelector<HTMLElement>(HEADER_SELECTOR)
    if (scoped) return scoped

    // В некоторых сборках шапка лежит не в острове, а прямо в панели.
    const sidebar = view.closest<HTMLElement>('.nk-sidebar-view')
    return sidebar?.querySelector<HTMLElement>(HEADER_SELECTOR) ?? null
  }

  /**
   * Стрелка «Назад» встаёт в шапку нативной панели.
   *
   * В режиме списка заголовок сдвинут на ширину колонки действия
   * (`nk-grid__col_shift_*`). Когда появляется наша стрелка, этот отступ
   * снимается — иначе заголовок уезжает и шапка вылезает за остров.
   */
  private applyHeader(view: HTMLElement): void {
    const header = this.findHeader(view)
    if (!header) {
      if (!this.headerWarned) {
        this.headerWarned = true
        console.warn('[nmap_uploader] notes sidebar: .nk-sidebar-header-view not found')
      }
      return
    }
    this.headerWarned = false
    this.lastHeader = header

    const title = header.querySelector<HTMLElement>(HEADER_TITLE_SELECTOR)

    if (this.active) {
      if (!this.backColumn) {
        this.backColumn = this.createBackColumn()
      }
      if (this.backColumn.parentElement !== header) {
        header.insertBefore(this.backColumn, header.firstChild)
      }

      if (title) {
        const shift = Array.from(title.classList).find((name) => TITLE_SHIFT_CLASS_RE.test(name))
        if (shift) {
          title.classList.remove(shift)
          this.savedTitleShift = shift
        }
      }
      return
    }

    this.backColumn?.remove()

    if (title && this.savedTitleShift && !title.classList.contains(this.savedTitleShift)) {
      title.classList.add(this.savedTitleShift)
    }
    this.savedTitleShift = null
  }

  /**
   * Скрывает всё, чего нет в нативном режиме группы: поиск категорий и блок
   * «Недавно созданные» отдельным островом ниже списка.
   */
  private applyHiddenSections(view: HTMLElement): void {
    if (!this.active) {
      this.restoreHiddenSections()
      return
    }

    const island = view.closest<HTMLElement>(`.${ISLAND_CLASS}`)
    const suggest = island?.querySelector<HTMLElement>(SUGGEST_SELECTOR)
    if (suggest) {
      // Не прячем: блок несёт border-top — это разделитель под заголовком.
      suggest.classList.add(SUGGEST_COLLAPSED_CLASS)
    }

    const next = island?.nextElementSibling
    if (next instanceof HTMLElement && next.classList.contains(ISLAND_CLASS)) {
      this.hideSection(next)
    }
  }

  private hideSection(element: HTMLElement): void {
    if (!this.hiddenElements.has(element)) {
      this.hiddenDisplays.set(element, element.style.display)
      this.hiddenElements.add(element)
    }
    element.style.display = 'none'
  }

  private restoreHiddenSections(): void {
    for (const element of this.hiddenElements) {
      if (element.isConnected) {
        element.style.display = this.hiddenDisplays.get(element) ?? ''
      }
    }
    this.hiddenElements.clear()

    for (const suggest of document.querySelectorAll<HTMLElement>(`.${SUGGEST_COLLAPSED_CLASS}`)) {
      suggest.classList.remove(SUGGEST_COLLAPSED_CLASS)
    }
  }

  private applyMode(view: HTMLElement, content: HTMLElement): void {
    if (!this.host) return

    this.applyHeader(view)
    this.applyHiddenSections(view)

    if (this.active) {
      // Нативный список приподнят отрицательным отступом под заголовок.
      // Наш блок лежит в том же контейнере и без сброса уезжает под линию.
      if (this.savedViewMarginTop === null) {
        this.savedViewMarginTop = view.style.marginTop
      }
      view.style.marginTop = GROUPS_VIEW_MARGIN_TOP
      content.style.display = 'none'
      this.host.style.display = ''
      if (this.tile) this.tile.setAttribute('aria-expanded', 'true')
    } else {
      if (this.savedViewMarginTop !== null) {
        view.style.marginTop = this.savedViewMarginTop
        this.savedViewMarginTop = null
      }
      content.style.display = ''
      this.host.style.display = 'none'
      if (this.tile) this.tile.setAttribute('aria-expanded', 'false')
    }
  }

  private open(): void {
    this.active = true
    this.resetToken += 1
    this.renderPanel()
    this.sync()
    this.startObserver()

    requestAnimationFrame(() => {
      this.host?.scrollIntoView({ block: 'nearest' })
    })
  }

  private close = (): void => {
    this.active = false
    this.stopObserver()
    this.resetToken += 1
    this.renderPanel()
    this.sync()
  }

  private unmount(): void {
    this.active = false
    this.stopObserver()
    this.restoreHiddenSections()

    this.backColumn?.remove()
    this.backColumn = null

    const view = findGroupsView()
    if (view && this.savedViewMarginTop !== null) {
      view.style.marginTop = this.savedViewMarginTop
    }
    this.savedViewMarginTop = null

    const title = this.lastHeader?.querySelector<HTMLElement>(HEADER_TITLE_SELECTOR)
    if (title && this.savedTitleShift && !title.classList.contains(this.savedTitleShift)) {
      title.classList.add(this.savedTitleShift)
    }
    this.savedTitleShift = null
    this.lastHeader = null

    this.tile?.remove()
    this.tile = null

    this.root?.unmount()
    this.root = null
    this.host?.remove()
    this.host = null
  }
}
