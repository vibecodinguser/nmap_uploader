/**
 * DOM-адаптер для управления версткой, iframe и маркерами курсоров в сплит-режиме Go To.
 */

import { getOwnedElementById, markNmapOwned } from '@/lib/go_to/ownership'
import {
  CURSOR_MARKER_CLASS,
  CURSOR_MARKER_REMOTE_CLASS,
  CURSOR_MARKER_VISIBLE_CLASS,
  NAK_ROOT_SELECTORS,
  type PanelDimensions,
  type PixelPosition,
  type ResizedElementStyle,
  SPLIT_BANNER_ANCHOR_SELECTORS,
  SPLIT_BANNER_FLOATING_CLASS,
  SPLIT_BANNER_ID,
  SPLIT_BANNER_WARNING_CLASS,
  SPLIT_MAX_RECOMMENDED_ZOOM,
  SPLIT_RESIZED_ATTR,
  SPLIT_ROOT_ID,
} from '@/lib/go_to_split_view/core'
import { GO_TO_SPLIT_ACTIVE_CLASS } from '@/lib/go_to_styles'
import { applyGoToTheme, syncGoToTheme } from '@/lib/go_to_theme'

const getSplitPanelSize = (): PanelDimensions => ({
  width: Math.max(1, Math.round(window.innerWidth / 2)),
  height: Math.max(1, window.innerHeight),
})

export const getLeftPanelSize = (): PanelDimensions => getSplitPanelSize()
export const getRightPanelSize = (): PanelDimensions => getSplitPanelSize()

type NmapsViewportBounds = {
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
  root.className = 'yamapper-split'
  markNmapOwned(root)

  const iframeWrap = document.createElement('div')
  iframeWrap.className = 'yamapper-split__iframe-wrap'

  const frame = document.createElement('iframe')
  frame.className = 'yamapper-split__iframe'
  frame.src = nakarteUrl
  frame.title = 'Nakarte'
  frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade')
  if (onIframeLoad) {
    frame.addEventListener('load', onIframeLoad)
  }

  iframeWrap.appendChild(frame)

  const rightOverlay = createCursorOverlay('yamapper-split__cursor-overlay', false)
  const rightCursorMarker = rightOverlay.firstElementChild as HTMLElement

  const leftOverlay = createCursorOverlay('yamapper-split__left-cursor-overlay', true)
  const leftCursorMarker = leftOverlay.firstElementChild as HTMLElement

  root.appendChild(iframeWrap)
  root.appendChild(rightOverlay)
  document.body.appendChild(root)
  document.body.appendChild(leftOverlay)

  applyGoToTheme(root)
  syncGoToTheme()

  return {
    splitRoot: root,
    iframe: frame,
    leftCursorMarker,
    rightCursorMarker,
    leftOverlay,
  }
}

/**
 * Поле поиска в шапке — якорь баннера. Второй селектор нужен, если разметка
 * поиска изменится, а контейнер останется.
 */
const findBannerAnchor = (): HTMLElement | null => {
  for (const selector of SPLIT_BANNER_ANCHOR_SELECTORS) {
    const el = document.querySelector<HTMLElement>(selector)
    if (el) return el
  }
  return null
}

/**
 * Ставит баннер сразу после поля поиска; без поиска — плавающим поверх карты.
 *
 * Позиция после поля, а не в конце шапки: шапка — flex-строка, её ширину уже
 * занимают поиск и панель с кнопками, и любая плашка в хвосте сжимается в
 * ноль и пропадает с экрана.
 */
const attachBanner = (banner: HTMLElement): void => {
  const anchor = findBannerAnchor()
  if (anchor) {
    banner.classList.remove(SPLIT_BANNER_FLOATING_CLASS)
    anchor.after(banner)
    return
  }

  banner.classList.add(SPLIT_BANNER_FLOATING_CLASS)
  document.body.appendChild(banner)
}

/** Стоит ли баннер там, куда его ставит `attachBanner`. */
const isBannerPlaced = (banner: HTMLElement): boolean => {
  const anchor = findBannerAnchor()
  if (anchor) {
    return anchor.nextElementSibling === banner
  }
  return (
    banner.parentElement === document.body && banner.classList.contains(SPLIT_BANNER_FLOATING_CLASS)
  )
}

/** Текст и зум последнего баннера: нужны, чтобы восстановить его после перерисовки шапки. */
let bannerState: { text: string; zoom?: number } | null = null

const createBannerElement = (text: string, initialZoom?: number): HTMLElement => {
  const banner = document.createElement('div')
  banner.id = SPLIT_BANNER_ID
  banner.className = 'yamapper-split-banner'
  markNmapOwned(banner)
  if (typeof initialZoom === 'number' && initialZoom > SPLIT_MAX_RECOMMENDED_ZOOM) {
    banner.classList.add(SPLIT_BANNER_WARNING_CLASS)
  }
  banner.textContent = text
  banner.setAttribute('role', 'status')
  banner.setAttribute('aria-live', 'polite')
  return banner
}

/**
 * Возвращает баннер на место, если React-дерево редактора его выбросило или
 * перенесло. Шапка перерисовывается при смене раскладки, а баннер живёт в её
 * DOM как чужой узел.
 */
const restoreSplitNoticeBanner = (): void => {
  if (!bannerState) return
  attachBanner(createBannerElement(bannerState.text, bannerState.zoom))
}

export const updateSplitNoticeBannerZoom = (zoom: number): void => {
  if (bannerState) bannerState.zoom = zoom

  const banner = getOwnedElementById(SPLIT_BANNER_ID)
  if (!banner) {
    restoreSplitNoticeBanner()
    return
  }

  banner.classList.toggle(SPLIT_BANNER_WARNING_CLASS, zoom > SPLIT_MAX_RECOMMENDED_ZOOM)

  // Синк-менеджер зовёт нас на каждом тике опроса: здесь же баннер
  // возвращается на место, если React выбросил узел при перерисовке шапки.
  if (!isBannerPlaced(banner)) {
    attachBanner(banner)
  }
}

export const mountSplitNoticeBanner = (text: string, initialZoom?: number): HTMLElement => {
  unmountSplitNoticeBanner()

  bannerState = { text, zoom: initialZoom }
  const banner = createBannerElement(text, initialZoom)
  attachBanner(banner)
  return banner
}

export const unmountSplitNoticeBanner = (): void => {
  bannerState = null
  getOwnedElementById(SPLIT_BANNER_ID)?.remove()
}
