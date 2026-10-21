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

export const clearSplitLayout = (state: SplitLayoutState): void => {
  document.documentElement.classList.remove(GO_TO_SPLIT_ACTIVE_CLASS)
  document.documentElement.style.overflow = state.savedHtmlOverflow
  document.body.style.overflow = state.savedBodyOverflow
  clearNakRootResize(state.resizedElements)
  state.resizedElements = []
  state.savedHtmlOverflow = ''
  state.savedBodyOverflow = ''
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
