/**
 * Панель заметок в DOM Народной карты.
 *
 * Панель — отдельная страница расширения в iframe: стили редактора не
 * протекают внутрь, а наши — наружу. Хост отвечает только за геометрию окна
 * (нижняя кромка, высота, разворот) и за передачу выбранной заметки.
 */
import { browser } from 'wxt/browser'
import { ensureInjectedStyle, removeInjectedStyle } from '@/lib/injected_styles'
import { withNativeLocaleParam } from '@/lib/locale_bridge'
import { readNativeLocale } from '@/lib/native_locale'
import { readNativeTheme } from '@/lib/native_theme'
import { withNativeThemeParam } from '@/lib/theme_bridge'
import { NOTES_PANEL_STYLES } from './styles'

export const NOTES_PANEL_HOST_ID = 'yamapper-notes-panel'
export const NOTES_PANEL_FRAME_ID = 'yamapper-notes-panel-frame'
export const NOTES_PANEL_HANDLE_ID = 'yamapper-notes-panel-handle'
const NOTES_PANEL_STYLES_ID = 'yamapper-notes-panel-styles'
const NOTES_PANEL_HEIGHT_STORAGE_KEY = 'notes_panel_height_px'

/** Сообщения iframe → хост. */
export const NOTES_PANEL_LAYOUT_MESSAGE = 'NOTES_PANEL_LAYOUT'
export const NOTES_PANEL_CLOSE_MESSAGE = 'NOTES_PANEL_CLOSE'
/** Сообщения хост → iframe. */
export const NOTES_PANEL_STATE_MESSAGE = 'NOTES_PANEL_STATE'
export const NOTES_PANEL_SHOW_NOTE_MESSAGE = 'NOTES_PANEL_SHOW_NOTE'
/**
 * Панель открылась: iframe живёт постоянно, поэтому сам он смену видимости не
 * замечает. По этому сообщению панель перечитывает снимок и один раз за
 * открытие пробует молча восстановить вход или сразу войти в Яндекс.
 */
export const NOTES_PANEL_OPENED_MESSAGE = 'NOTES_PANEL_OPENED'
/** iframe → хост: показать снимок сразу, не дожидаясь ответа Диска. */
export const NOTES_PANEL_PREVIEW_MESSAGE = 'NOTES_PANEL_PREVIEW'
/**
 * iframe → хост: подогнать высоту под содержимое.
 *
 * Число — желаемая высота панели в пикселях, `null` — вернуть прежнюю
 * (пользовательскую) высоту. Карточка свойств выше списка, и открывать её в
 * четверть экрана значило бы прятать нижние блоки под прокруткой.
 */
export const NOTES_PANEL_FIT_HEIGHT_MESSAGE = 'NOTES_PANEL_FIT_HEIGHT'

type NotesPanelLayout = 'compact' | 'full'

const MIN_RATIO = 0.25
const DEFAULT_RATIO = 0.25

type NotesPanelHost = {
  open: () => void
  close: () => void
  toggle: () => void
  isOpen: () => boolean
  /** Открыть панель на свойствах заметки. */
  showNote: (noteId: string) => void
  destroy: () => void
}

const clampHeight = (height: number): number => {
  const viewport = window.innerHeight
  return Math.min(Math.max(height, viewport * MIN_RATIO), viewport)
}

export const ensureNotesPanelStyles = (): void => {
  ensureInjectedStyle(NOTES_PANEL_STYLES_ID, NOTES_PANEL_STYLES)
}

export const removeNotesPanelStyles = (): void => {
  removeInjectedStyle(NOTES_PANEL_STYLES_ID)
}

type NotesPanelHostOptions = {
  /** Панель открылась или закрылась: хост сообщает, чтобы убрать «Редактировать». */
  onVisibilityChange?: (open: boolean) => void
}

export const createNotesPanelHost = ({
  onVisibilityChange,
}: NotesPanelHostOptions = {}): NotesPanelHost => {
  let container: HTMLDivElement | null = null
  let frame: HTMLIFrameElement | null = null
  let layout: NotesPanelLayout = 'compact'
  let compactHeight = Math.round(window.innerHeight * DEFAULT_RATIO)
  /**
   * Высота под содержимое, запрошенная iframe. Пока она задана, она важнее
   * пользовательской: карточка свойств должна открываться целиком. Протяжка
   * ручки и закрытие панели сбрасывают её — ручное управление главнее.
   */
  let fittedHeight: number | null = null
  let dragging = false
  /**
   * Заметка, которую просили показать. iframe может быть ещё не загружен —
   * сообщение, отправленное в этот момент, теряется при навигации, поэтому
   * запоминаем просьбу и повторяем её после `load`.
   */
  let pendingNoteId: string | null = null
  /** Геометрия на момент начала протяжки: высота считается от неё, а не от курсора. */
  let dragStartY = 0
  let dragStartHeight = 0
  let dragPointerId: number | null = null

  const postState = (): void => {
    const target = frame?.contentWindow
    if (!target) return
    target.postMessage({ action: NOTES_PANEL_STATE_MESSAGE, layout }, '*')
  }

  const postShowNote = (noteId: string): void => {
    frame?.contentWindow?.postMessage({ action: NOTES_PANEL_SHOW_NOTE_MESSAGE, noteId }, '*')
  }

  const postOpened = (): void => {
    frame?.contentWindow?.postMessage({ action: NOTES_PANEL_OPENED_MESSAGE }, '*')
  }

  /**
   * Адрес страницы панели.
   *
   * `getURL` бросает, если контекст расширения инвалидирован (расширение
   * перезагрузили при открытой карте). Падать из-за этого нельзя: без адреса
   * панель просто не откроется, а страница карты продолжит работать.
   */
  const resolveFrameUrl = (): string | null => {
    try {
      return browser.runtime.getURL('/notes-panel.html')
    } catch {
      return null
    }
  }

  /**
   * Панель собрана и живёт в документе.
   *
   * Проверка на `isConnected` — не формальность: перезагрузка расширения или
   * перерисовка страницы может вынести iframe из DOM, оставив контейнер с
   * ручкой. Без этой проверки панель открывалась бы пустой белой полосой, а
   * `build` отказывался бы что-либо пересоздавать.
   */
  const isBuilt = (): boolean => container?.isConnected === true && frame?.isConnected === true

  /** Убирает DOM панели, не трогая подписки на события окна. */
  const clearPanelDom = (): void => {
    frame?.remove()
    container?.remove()
    frame = null
    container = null
  }

  /**
   * Сколько высоты контейнера занимает ручка.
   *
   * iframe тянется на остаток, поэтому высота карточки, измеренная внутри
   * iframe, — это ещё не высота контейнера: без ручки содержимое обрезалось бы
   * на её высоту.
   */
  const panelChromeHeight = (): number => {
    const handle = container?.querySelector<HTMLElement>(`#${NOTES_PANEL_HANDLE_ID}`)
    if (!handle) return 0
    const styles = getComputedStyle(handle)
    return (
      handle.offsetHeight +
      (Number.parseFloat(styles.marginTop) || 0) +
      (Number.parseFloat(styles.marginBottom) || 0)
    )
  }

  const applyHeight = (): void => {
    if (!container) return
    container.dataset.layout = layout
    if (layout === 'full') {
      container.style.height = '100vh'
      return
    }
    const height = fittedHeight === null ? compactHeight : fittedHeight + panelChromeHeight()
    container.style.height = `${clampHeight(height)}px`
  }

  const setLayout = (next: NotesPanelLayout): void => {
    layout = next
    applyHeight()
    postState()
  }

  const saveHeight = (): void => {
    browser.storage.local.set({ [NOTES_PANEL_HEIGHT_STORAGE_KEY]: compactHeight }).catch(() => {})
  }

  const endDrag = (): void => {
    if (!dragging) return
    dragging = false

    if (dragPointerId !== null && container) {
      const handle = container.querySelector<HTMLElement>(`#${NOTES_PANEL_HANDLE_ID}`)
      try {
        if (handle?.hasPointerCapture(dragPointerId)) {
          handle.releasePointerCapture(dragPointerId)
        }
      } catch {
        // Захват мог быть снят браузером сам — это не ошибка.
      }
    }
    dragPointerId = null

    if (container) delete container.dataset.dragging
    layout = 'compact'
    applyHeight()
    postState()
    saveHeight()
  }

  const handlePointerMove = (event: PointerEvent): void => {
    if (!dragging) return
    event.preventDefault()

    // Высота считается от стартовой, а не от абсолютной позиции курсора:
    // иначе при старте из полноэкранного режима панель «прыгает».
    const next = dragStartHeight + (dragStartY - event.clientY)
    compactHeight = clampHeight(next)
    applyHeight()
  }

  const handlePointerUp = (): void => {
    endDrag()
  }

  const handleHandlePointerDown = (event: PointerEvent): void => {
    event.preventDefault()

    // При `layout === 'full'` высота берётся из реального положения панели,
    // иначе протяжка начиналась бы не от того места, где видна кромка.
    // Нулевая высота значит, что панель ещё не отрисована: берём расчётную.
    const rect = container?.getBoundingClientRect()
    const visibleHeight = rect && rect.height > 0 ? rect.height : compactHeight
    dragStartY = event.clientY
    dragStartHeight = layout === 'full' ? window.innerHeight : visibleHeight
    dragPointerId = event.pointerId
    dragging = true
    // Протяжка — ручное управление высотой: подгонка под содержимое отступает.
    // Текущая высота становится пользовательской, иначе клик по ручке без
    // движения возвращал бы панель к старой высоте.
    if (fittedHeight !== null) compactHeight = clampHeight(visibleHeight)
    fittedHeight = null

    // Захват указателя обязателен: если тянуть вниз, курсор уходит на iframe,
    // а это отдельный документ — без захвата события до хоста не доходят и
    // панель «не тянется».
    const handle = event.currentTarget as HTMLElement | null
    try {
      handle?.setPointerCapture(event.pointerId)
    } catch {
      // Браузер может отказать (например, для синтетического события).
    }

    if (container) container.dataset.dragging = 'true'
    if (layout === 'full') {
      layout = 'compact'
      postState()
    }
  }

  const handleWindowMessage = (event: MessageEvent): void => {
    if (!frame || event.source !== frame.contentWindow) return

    const data = event.data as { action?: string; layout?: string; height?: number } | null
    if (data?.action === NOTES_PANEL_LAYOUT_MESSAGE) {
      setLayout(data.layout === 'full' ? 'full' : 'compact')
      return
    }
    if (data?.action === NOTES_PANEL_FIT_HEIGHT_MESSAGE) {
      fittedHeight =
        typeof data.height === 'number' && Number.isFinite(data.height) ? data.height : null
      applyHeight()
      return
    }
    if (data?.action === NOTES_PANEL_CLOSE_MESSAGE) {
      close()
    }
  }

  const build = (): boolean => {
    if (isBuilt()) return true
    // Контейнер мог остаться без iframe: перезагрузка расширения выбивает
    // страницу панели из документа, а ручка и сам контейнер остаются. Такую
    // полуразобранную панель нужно убрать, иначе `build` навсегда решит, что
    // строить нечего, и панель будет открываться пустой.
    clearPanelDom()
    const frameUrl = resolveFrameUrl()
    if (!frameUrl) return false

    container = document.createElement('div')
    container.id = NOTES_PANEL_HOST_ID
    container.dataset.layout = layout

    const handle = document.createElement('div')
    handle.id = NOTES_PANEL_HANDLE_ID
    handle.setAttribute('role', 'separator')
    handle.setAttribute('aria-orientation', 'horizontal')
    handle.addEventListener('pointerdown', handleHandlePointerDown)

    frame = document.createElement('iframe')
    frame.id = NOTES_PANEL_FRAME_ID
    frame.title = 'Заметки'
    frame.src = withNativeLocaleParam(
      withNativeThemeParam(frameUrl, readNativeTheme()),
      readNativeLocale(),
    )
    frame.addEventListener('load', () => {
      postState()
      // Панель могли открыть до загрузки документа: сообщение об открытии
      // тогда потерялось, а без него не запустится восстановление входа.
      if (container?.dataset.open === 'true') postOpened()
      // Просьба показать заметку могла прийти до загрузки документа — тогда
      // сообщение потерялось, и повторяем его сейчас.
      if (pendingNoteId) {
        postShowNote(pendingNoteId)
        pendingNoteId = null
      }
    })

    container.append(handle, frame)
    document.body.appendChild(container)
    return true
  }

  const open = (): void => {
    if (!build() || !container) return
    // Панель, открытая кнопкой в тулбаре, показывает список: просьба из
    // прошлого сеанса к новой карточке не относится.
    pendingNoteId = null
    applyHeight()
    container.dataset.open = 'true'
    postState()
    postOpened()
    onVisibilityChange?.(true)
  }

  const close = (): void => {
    if (container?.dataset.open !== 'true') return
    container.dataset.open = 'false'
    // Следующее открытие начинается с пользовательской высоты: подгонка была
    // привязана к конкретной карточке, а не к панели вообще.
    fittedHeight = null
    pendingNoteId = null
    onVisibilityChange?.(false)
  }

  const destroy = (): void => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerUp)
    window.removeEventListener('message', handleWindowMessage)
    clearPanelDom()
    removeNotesPanelStyles()
  }

  const readStoredHeight = async (): Promise<void> => {
    try {
      const stored = await browser.storage.local.get(NOTES_PANEL_HEIGHT_STORAGE_KEY)
      const value = stored[NOTES_PANEL_HEIGHT_STORAGE_KEY]
      if (typeof value === 'number' && Number.isFinite(value)) {
        compactHeight = clampHeight(value)
        applyHeight()
      }
    } catch {
      // Высота — украшение: без неё панель просто откроется по умолчанию.
    }
  }

  readStoredHeight().catch(() => {})

  // Подписки на окно ставятся один раз на весь срок жизни хоста, а не в
  // `build`: панель теперь может пересобраться (её iframe выбивает перезагрузка
  // расширения), и повторная установка слушателей удваивала бы обработку
  // протяжки.
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerUp)
  window.addEventListener('message', handleWindowMessage)

  /** Панель открыта и действительно собрана: полуразобранная — не открыта. */
  const isOpen = (): boolean => isBuilt() && container?.dataset.open === 'true'

  return {
    open,
    close,
    toggle: () => {
      if (isOpen()) close()
      else open()
    },
    isOpen,
    showNote: (noteId: string) => {
      open()
      // iframe мог только что создаться: сообщение до `load` не дойдёт,
      // поэтому просьбу запоминаем и повторяем в обработчике загрузки.
      pendingNoteId = noteId
      postShowNote(noteId)
    },
    destroy,
  }
}
