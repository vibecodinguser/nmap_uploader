/**
 * Попап настроек в DOM редактора.
 *
 * Контейнер повторяет вид нативного попапа редактора (остров: фон, радиус,
 * тень), а содержимое — отдельная страница расширения в iframe. Хост отвечает
 * только за геометрию, видимость и фокус: содержимое ему не принадлежит.
 *
 * Узел не живёт в DOM, пока попап закрыт: полное приложение настроек в iframe
 * не должно висеть фоном и держать React-дерево живым.
 */
import { browser } from 'wxt/browser'
import { removeOwnedElementsById } from '@/lib/go_to/ownership'
import { applyGoToTheme, refreshGoToThemeFromStorage, syncGoToTheme } from '@/lib/go_to_theme'
import type { Locale } from '@/lib/i18n/locale.types'
import { createTranslator } from '@/lib/i18n/translate'
import { ensureInjectedStyle, removeInjectedStyle } from '@/lib/injected_styles'
import { getSettingsButton, SETTINGS_APP_BAR_SELECTOR } from './button'
import {
  CLOSE_SETTINGS_POPUP_ACTION,
  SETTINGS_POPUP_FIT_HEIGHT_MESSAGE,
  SETTINGS_POPUP_ID,
  SETTINGS_POPUP_STYLES_ID,
  SETTINGS_POPUP_TITLE_REF,
} from './protocol'
import { SETTINGS_POPUP_STYLES } from './styles'

/**
 * Попап стоит там же, где нативная `.nk-sidebar-view` (уведомления, карточка
 * объекта): `top: 60px` плюс `margin-top: 10px` у `.nk-island`, `right: 16px`.
 */
const SIDEBAR_TOP = 70
/** Отступ от правого и нижнего края окна, как у `.nk-sidebar-view`. */
const VIEWPORT_MARGIN = 16
/**
 * С открытой выезжающей панелью редактор сдвигает `.nk-sidebar-view` левее
 * (`right: 366px` = ширина `.nk-drawer-view` + отступ).
 */
const DRAWER_OPEN_SELECTOR = '.nk-app-view_with-drawer'
const DRAWER_WIDTH = 350

/**
 * Ширина попапа: как у нативной карточки объекта (`.nk-sidebar-view.nk-island`,
 * замер — 408px). `.nk-drawer-view` (350px) — выезжающая панель во всю высоту,
 * а попап под кнопкой шапки по виду ближе к карточке.
 */
export const SETTINGS_POPUP_WIDTH = 408

export type SettingsPopupHostOptions = {
  pagePath: '/panel.html'
  /** Язык названия попапа для скринридеров. */
  locale: Locale
  /** Попап открылся или закрылся: хост сообщает, чтобы обновить кнопку. */
  onVisibilityChange?: (open: boolean) => void
}

export type SettingsPopupHost = {
  open: () => void
  close: () => void
  toggle: () => void
  isOpen: () => boolean
  destroy: () => void
}

/**
 * Стили попапа и кнопки. Идемпотентно, вызывается при каждой синхронизации
 * кнопки: content script на `document_idle` может стартовать раньше, чем у
 * страницы появится `head`, а без стилей кнопка теряет отступ от соседней.
 */
export const ensureSettingsPopupStyles = (): void => {
  ensureInjectedStyle(SETTINGS_POPUP_STYLES_ID, SETTINGS_POPUP_STYLES)
}

export type SettingsPopupRect = {
  left: number
  top: number
  maxHeight: number
}

/**
 * Прямоугольник попапа — как у нативной `.nk-sidebar-view`: правый край в 16px
 * от окна (или левее открытой выезжающей панели), верх на 70px, низ не ближе
 * 16px к краю окна. В узком окне левый край не уходит за 16px.
 */
export const measureSettingsPopupRect = (
  viewportWidth: number,
  viewportHeight: number,
  drawerOpen = false,
): SettingsPopupRect => {
  const right = VIEWPORT_MARGIN + (drawerOpen ? DRAWER_WIDTH : 0)
  return {
    left: Math.max(viewportWidth - SETTINGS_POPUP_WIDTH - right, VIEWPORT_MARGIN),
    top: SIDEBAR_TOP,
    maxHeight: Math.max(viewportHeight - SIDEBAR_TOP - VIEWPORT_MARGIN, 0),
  }
}

export const createSettingsPopupHost = ({
  pagePath,
  locale,
  onVisibilityChange,
}: SettingsPopupHostOptions): SettingsPopupHost => {
  const title = createTranslator(locale)(SETTINGS_POPUP_TITLE_REF)
  let popup: HTMLDivElement | null = null
  let frame: HTMLIFrameElement | null = null
  /** Высота под содержимое; `null` — занять всё доступное место. */
  let fittedHeight: number | null = null
  let created = false

  const isOpen = (): boolean => popup?.isConnected === true

  const position = (): void => {
    if (!popup) {
      return
    }

    const { left, top, maxHeight } = measureSettingsPopupRect(
      document.documentElement.clientWidth,
      document.documentElement.clientHeight,
      document.querySelector(DRAWER_OPEN_SELECTOR) !== null,
    )
    const height = fittedHeight === null ? maxHeight : Math.min(fittedHeight, maxHeight)

    popup.style.width = `${SETTINGS_POPUP_WIDTH}px`
    popup.style.left = `${left}px`
    popup.style.top = `${top}px`
    popup.style.maxHeight = `${maxHeight}px`
    popup.style.height = `${Math.max(height, 0)}px`
  }

  const handleDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target
    if (!(target instanceof Node)) {
      return
    }
    if (popup?.contains(target) || getSettingsButton()?.contains(target)) {
      return
    }
    close()
  }

  const handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      close()
    }
  }

  const handleFrameMessage = (event: MessageEvent): void => {
    if (!frame || event.source !== frame.contentWindow) {
      return
    }
    const data = event.data as { action?: string; height?: number } | null | undefined
    if (data?.action === SETTINGS_POPUP_FIT_HEIGHT_MESSAGE) {
      fittedHeight =
        typeof data.height === 'number' && Number.isFinite(data.height) ? data.height : null
      position()
      return
    }
    if (data?.action === CLOSE_SETTINGS_POPUP_ACTION) {
      close()
    }
  }

  const build = (): void => {
    if (popup) {
      return
    }

    const container = document.createElement('div')
    container.id = SETTINGS_POPUP_ID
    container.className = 'yamapper-settings-popup'
    container.setAttribute('role', 'dialog')
    container.setAttribute('aria-label', title)

    const content = document.createElement('div')
    content.className = 'yamapper-settings-popup__content'

    const iframe = document.createElement('iframe')
    iframe.className = 'yamapper-settings-popup__iframe'
    iframe.title = title
    iframe.src = browser.runtime.getURL(pagePath)

    content.appendChild(iframe)
    container.appendChild(content)
    document.documentElement.appendChild(container)

    popup = container
    frame = iframe
    created = true
  }

  const attachListeners = (): void => {
    document.addEventListener('pointerdown', handleDocumentPointerDown, true)
    document.addEventListener('keydown', handleDocumentKeyDown)
    window.addEventListener('resize', position)
    window.addEventListener('message', handleFrameMessage)
  }

  const detachListeners = (): void => {
    document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
    document.removeEventListener('keydown', handleDocumentKeyDown)
    window.removeEventListener('resize', position)
    window.removeEventListener('message', handleFrameMessage)
  }

  const close = (): void => {
    if (!popup) {
      return
    }
    detachListeners()
    popup.remove()
    popup = null
    frame = null
    fittedHeight = null
    onVisibilityChange?.(false)
    getSettingsButton()?.focus()
  }

  const open = (): void => {
    if (isOpen()) {
      return
    }

    // Тема могла смениться, пока попап был закрыт: перечитываем до показа,
    // иначе белая вспышка на тёмной странице.
    void refreshGoToThemeFromStorage().then(() => {
      ensureSettingsPopupStyles()
      build()
      if (!popup) {
        return
      }
      fittedHeight = null
      applyGoToTheme(popup)
      position()
      syncGoToTheme()
      attachListeners()
      // Фокус отдаём iframe: внутри него живёт React-корень панели.
      frame?.focus()
      onVisibilityChange?.(true)
    })
  }

  const destroy = (): void => {
    detachListeners()
    removeOwnedElementsById(SETTINGS_POPUP_ID)
    popup = null
    frame = null
    if (created) {
      removeInjectedStyle(SETTINGS_POPUP_STYLES_ID)
      created = false
    }
  }

  return {
    open,
    close,
    toggle: () => {
      if (isOpen()) {
        close()
      } else {
        open()
      }
    },
    isOpen,
    destroy,
  }
}

export { SETTINGS_APP_BAR_SELECTOR }
