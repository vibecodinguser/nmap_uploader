/**
 * DOM-адаптер для управления версткой, iframe и маркерами курсоров в сплит-режиме Go To.
 */
import {
  CURSOR_MARKER_CLASS,
  CURSOR_MARKER_REMOTE_CLASS,
  CURSOR_MARKER_VISIBLE_CLASS,
  NAK_ROOT_SELECTORS,
  type PanelDimensions,
  type PixelPosition,
  type ResizedElementStyle,
  SPLIT_BANNER_ID,
  SPLIT_HEADER_SELECTORS,
  SPLIT_RESIZED_ATTR,
  SPLIT_ROOT_ID,
} from '@/lib/go_to_split_view/core'
import { GO_TO_SPLIT_ACTIVE_CLASS } from '@/lib/go_to_styles'
import { applyGoToTheme, refreshGoToThemeFromStorage, syncGoToTheme } from '@/lib/go_to_theme'

export const getSplitPanelSize = (): PanelDimensions => ({
  width: Math.max(1, Math.round(window.innerWidth / 2)),
  height: Math.max(1, window.innerHeight),
})

export const getLeftPanelSize = (): PanelDimensions => getSplitPanelSize()
export const getRightPanelSize = (): PanelDimensions => getSplitPanelSize()

export type NmapsViewportBounds = {
  cx: number
  cy: number
  width: number
  height: number
  left: number
  top: number
}

export const getNmapsMapViewportBounds = (): NmapsViewportBounds => {
  const panel = getLeftPanelSize()
  const fallback: NmapsViewportBounds = {
    cx: panel.width / 2,
    cy: panel.height / 2,
    width: panel.width,
    height: panel.height,
    left: 0,
    top: 0,
  }

  if (typeof document === 'undefined') return fallback

  // 1. Проверяем наличие центрального прицела (crosshair)
  const crosshair = document.querySelector(
    '.nk-map-crosshair, [class*="crosshair"], .ymaps-map-crosshair',
  )
  if (crosshair instanceof HTMLElement) {
    const rect = crosshair.getBoundingClientRect()
    if (rect.width > 0 || rect.height > 0) {
      return {
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        width: panel.width,
        height: panel.height,
        left: 0,
        top: 0,
      }
    }
  }

  // 2. Ищем реальный контейнер карты Яндекс (ymaps / nk-map)
  const mapSelectors = [
    "[class*='ymaps-2'][class*='-map']",
    "[class*='ymaps'][class*='map']",
    '.ymaps-2-1-map',
    '.ymaps-map',
    '.nk-map',
    '.nk-map-view',
  ]

  for (const selector of mapSelectors) {
    const candidate = document.querySelector(selector)
    if (candidate instanceof HTMLElement) {
      const rect = candidate.getBoundingClientRect()
      // Контейнер карты левой панели должен находиться в пределах левой половины экрана (0..panel.width)
      if (rect.width > 0 && rect.height > 0 && rect.left < panel.width) {
        const effectiveWidth = Math.min(rect.width, panel.width - Math.max(0, rect.left))
        const cx = rect.left + effectiveWidth / 2
        if (cx > 0 && cx < panel.width) {
          return {
            cx,
            cy: rect.top + rect.height / 2,
            width: effectiveWidth,
            height: rect.height,
            left: rect.left,
            top: rect.top,
          }
        }
      }
    }
  }

  // 3. Проверяем, есть ли открытый левый сайдбар/панель инструментов НЯК
  const sidebarSelectors = [
    '.nk-sidebar-view',
    '.nk-app-view__sidebar',
    '.nk-toolbar-view',
    '[class*="sidebar-view"]',
  ]
  for (const selector of sidebarSelectors) {
    const sidebar = document.querySelector(selector)
    if (sidebar instanceof HTMLElement) {
      const rect = sidebar.getBoundingClientRect()
      if (rect.width > 50 && rect.left >= 0 && rect.right < panel.width) {
        const availableWidth = panel.width - rect.right
        const cx = rect.right + availableWidth / 2
        if (cx > 0 && cx < panel.width) {
          return {
            cx,
            cy: panel.height / 2,
            width: availableWidth,
            height: panel.height,
            left: rect.right,
            top: 0,
          }
        }
      }
    }
  }

  return fallback
}

export const createCursorOverlay = (className: string, isRemote: boolean): HTMLElement => {
  const overlay = document.createElement('div')
  overlay.className = className

  const marker = document.createElement('div')
  marker.className = CURSOR_MARKER_CLASS
  if (isRemote) marker.classList.add(CURSOR_MARKER_REMOTE_CLASS)
  overlay.appendChild(marker)

  return overlay
}

export const setMarkerElementPosition = (
  marker: HTMLElement | null,
  clampedPosition: PixelPosition | null,
): void => {
  if (!marker) return

  if (!clampedPosition) {
    marker.classList.remove(CURSOR_MARKER_VISIBLE_CLASS)
    marker.style.left = ''
    marker.style.top = ''
    return
  }

  marker.style.left = `${clampedPosition.x}px`
  marker.style.top = `${clampedPosition.y}px`
  marker.classList.add(CURSOR_MARKER_VISIBLE_CLASS)
}

export const applyNakRootResize = (targetResizedElements: ResizedElementStyle[]): void => {
  for (const selector of NAK_ROOT_SELECTORS) {
    const element = document.querySelector(selector)
    if (!(element instanceof HTMLElement)) continue
    if (element.hasAttribute(SPLIT_RESIZED_ATTR)) continue

    targetResizedElements.push({
      element,
      width: element.style.width,
      maxWidth: element.style.maxWidth,
    })
    element.style.width = '50vw'
    element.style.maxWidth = '50vw'
    element.setAttribute(SPLIT_RESIZED_ATTR, 'true')
  }
}

export const clearNakRootResize = (targetResizedElements: ResizedElementStyle[]): void => {
  for (const { element, width, maxWidth } of targetResizedElements) {
    element.style.width = width
    element.style.maxWidth = maxWidth
    element.removeAttribute(SPLIT_RESIZED_ATTR)
  }

  // Защита: сброс инлайн-стилей у всех элементов, если они были затронуты или пересозданы
  for (const selector of NAK_ROOT_SELECTORS) {
    const elements = document.querySelectorAll(selector)
    elements.forEach((el) => {
      if (el instanceof HTMLElement && el.hasAttribute(SPLIT_RESIZED_ATTR)) {
        el.style.width = ''
        el.style.maxWidth = ''
        el.removeAttribute(SPLIT_RESIZED_ATTR)
      }
    })
  }
}

export type SplitLayoutState = {
  savedHtmlOverflow: string
  savedBodyOverflow: string
  resizedElements: ResizedElementStyle[]
}

export const applySplitLayout = (): SplitLayoutState => {
  const state: SplitLayoutState = {
    savedHtmlOverflow: document.documentElement.style.overflow,
    savedBodyOverflow: document.body.style.overflow,
    resizedElements: [],
  }

  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  document.documentElement.classList.add(GO_TO_SPLIT_ACTIVE_CLASS)
  applyNakRootResize(state.resizedElements)

  return state
}

export const clearSplitLayout = (state?: SplitLayoutState | null): void => {
  document.documentElement.classList.remove(GO_TO_SPLIT_ACTIVE_CLASS)
  document.body.classList.remove(GO_TO_SPLIT_ACTIVE_CLASS)

  if (state) {
    document.documentElement.style.overflow = state.savedHtmlOverflow
    document.body.style.overflow = state.savedBodyOverflow
    clearNakRootResize(state.resizedElements)
    state.resizedElements = []
    state.savedHtmlOverflow = ''
    state.savedBodyOverflow = ''
  } else {
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    clearNakRootResize([])
  }

  // Гарантированно восстанавливаем ширину html и body
  document.documentElement.style.width = ''
  document.documentElement.style.maxWidth = ''
  document.body.style.width = ''
  document.body.style.maxWidth = ''

  // Форсируем reflow браузера, чтобы сброс стилей гарантированно применился к DOM перед перерасчетом вьюпорта
  if (typeof document !== 'undefined' && document.documentElement) {
    void document.documentElement.offsetHeight
  }
}

export type SplitDomElements = {
  splitRoot: HTMLElement
  iframe: HTMLIFrameElement
  leftCursorMarker: HTMLElement
  rightCursorMarker: HTMLElement
  leftOverlay: HTMLElement
}

export const mountSplitDomElements = (
  nakarteUrl: string,
  onIframeLoad?: () => void,
): SplitDomElements => {
  const root = document.createElement('div')
  root.id = SPLIT_ROOT_ID
  root.className = 'nmap-uploader-split'

  const iframeWrap = document.createElement('div')
  iframeWrap.className = 'nmap-uploader-split__iframe-wrap'

  const frame = document.createElement('iframe')
  frame.className = 'nmap-uploader-split__iframe'
  frame.src = nakarteUrl
  frame.title = 'Nakarte'
  frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade')
  if (onIframeLoad) {
    frame.addEventListener('load', onIframeLoad)
  }

  iframeWrap.appendChild(frame)

  const rightOverlay = createCursorOverlay('nmap-uploader-split__cursor-overlay', false)
  const rightCursorMarker = rightOverlay.firstElementChild as HTMLElement

  const leftOverlay = createCursorOverlay('nmap-uploader-split__left-cursor-overlay', true)
  const leftCursorMarker = leftOverlay.firstElementChild as HTMLElement

  root.appendChild(iframeWrap)
  root.appendChild(rightOverlay)
  document.body.appendChild(root)
  document.body.appendChild(leftOverlay)

  void refreshGoToThemeFromStorage().then(() => {
    applyGoToTheme(root)
    syncGoToTheme()
  })

  return {
    splitRoot: root,
    iframe: frame,
    leftCursorMarker,
    rightCursorMarker,
    leftOverlay,
  }
}

export const findHeaderContainer = (): HTMLElement | null => {
  for (const selector of SPLIT_HEADER_SELECTORS) {
    const el = document.querySelector<HTMLElement>(selector)
    if (el) return el
  }
  return null
}

export const mountSplitNoticeBanner = (text: string): HTMLElement => {
  unmountSplitNoticeBanner()

  const banner = document.createElement('div')
  banner.id = SPLIT_BANNER_ID
  banner.className = 'nmap-uploader-split-banner'
  banner.textContent = text
  banner.setAttribute('role', 'status')
  banner.setAttribute('aria-live', 'polite')

  const header = findHeaderContainer()
  if (header) {
    const rect = header.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      banner.style.top = `${rect.top + rect.height / 2}px`
      banner.style.left = `${rect.left + rect.width / 2}px`
    }
  }

  document.body.appendChild(banner)
  return banner
}

export const unmountSplitNoticeBanner = (): void => {
  document.getElementById(SPLIT_BANNER_ID)?.remove()
}
