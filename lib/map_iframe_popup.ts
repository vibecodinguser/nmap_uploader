import { browser } from 'wxt/browser'
import { applyGoToTheme } from '@/lib/go_to_theme'

const VIEWPORT_MARGIN = 12
const BUTTON_GAP = 10
const MIN_USABLE_HEIGHT = 160

type MapIframePopupOptions = {
  popupId: string
  pagePath: string
  popupClassName: string
  contentClassName: string
  iframeClassName: string
}

export type MapIframePopup = {
  isOpen: () => boolean
  close: () => void
  toggle: (button: HTMLElement) => void
  teardown: () => void
}

const isExtensionContextInvalidated = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('Extension context invalidated')

const getExtensionPageUrl = (pagePath: string): string | null => {
  try {
    const getRuntimeUrl = browser.runtime.getURL as (path: string) => string
    return getRuntimeUrl(pagePath)
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      return null
    }
    throw error
  }
}

/** Popup расширения с iframe, привязанный к кнопке панели карты. */
export const createMapIframePopup = (options: MapIframePopupOptions): MapIframePopup => {
  let popup: HTMLDivElement | null = null
  let activeButton: HTMLElement | null = null

  const positionPopup = (): void => {
    if (!popup || !activeButton) return

    const buttonRect = activeButton.getBoundingClientRect()
    if (buttonRect.width === 0 && buttonRect.height === 0) return

    const spaceAbove = Math.max(buttonRect.top - BUTTON_GAP - VIEWPORT_MARGIN, 0)
    const spaceBelow = Math.max(
      document.documentElement.clientHeight - buttonRect.bottom - BUTTON_GAP - VIEWPORT_MARGIN,
      0,
    )
    const openBelow = spaceBelow >= spaceAbove || spaceAbove < MIN_USABLE_HEIGHT
    const availableHeight = openBelow ? spaceBelow : spaceAbove
    const measuredWidth = popup.getBoundingClientRect().width
    const popupWidth = measuredWidth || Math.min(425, document.documentElement.clientWidth - 24)
    const maxLeft = Math.max(document.documentElement.clientWidth - popupWidth - VIEWPORT_MARGIN, 0)

    popup.style.left = `${Math.max(Math.min(buttonRect.left, maxLeft), VIEWPORT_MARGIN)}px`
    popup.style.maxHeight = `${availableHeight}px`

    if (openBelow) {
      popup.style.top = `${buttonRect.bottom + BUTTON_GAP}px`
      popup.style.bottom = 'auto'
    } else {
      popup.style.bottom = `${document.documentElement.clientHeight - buttonRect.top + BUTTON_GAP}px`
      popup.style.top = 'auto'
    }
  }

  const close = (): void => {
    document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
    document.removeEventListener('keydown', handleDocumentKeyDown)
    window.removeEventListener('resize', positionPopup)
    popup?.remove()
    activeButton?.setAttribute('aria-expanded', 'false')
    popup = null
    activeButton = null
  }

  const handleDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target
    if (!(target instanceof Node)) return
    if (popup?.contains(target) || activeButton?.contains(target)) return
    close()
  }

  const handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      close()
    }
  }

  const createPopupElement = (button: HTMLElement): HTMLDivElement | null => {
    const pageUrl = getExtensionPageUrl(options.pagePath)
    if (!pageUrl) {
      return null
    }

    const element = document.createElement('div')
    element.id = options.popupId
    element.className = options.popupClassName

    const content = document.createElement('div')
    content.className = options.contentClassName

    const iframe = document.createElement('iframe')
    iframe.className = options.iframeClassName
    iframe.src = pageUrl
    iframe.title = button.getAttribute('aria-label') ?? ''

    content.appendChild(iframe)
    element.appendChild(content)
    return element
  }

  const isOpen = (): boolean => popup?.isConnected === true

  const toggle = (button: HTMLElement): void => {
    if (isOpen()) {
      close()
      return
    }

    const createdPopup = createPopupElement(button)
    if (!createdPopup) {
      return
    }

    activeButton = button
    popup = createdPopup
    button.setAttribute('aria-expanded', 'true')
    document.documentElement.appendChild(popup)
    applyGoToTheme(createdPopup)
    positionPopup()
    // Открытие идёт из click (после pointerup), поэтому pointerdown текущего жеста уже прошёл.
    document.addEventListener('pointerdown', handleDocumentPointerDown, true)
    document.addEventListener('keydown', handleDocumentKeyDown)
    window.addEventListener('resize', positionPopup)
  }

  return {
    isOpen,
    close,
    toggle,
    teardown: close,
  }
}
