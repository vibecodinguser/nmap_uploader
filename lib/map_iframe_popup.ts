import { browser } from 'wxt/browser'

const VIEWPORT_MARGIN = 12
const BUTTON_GAP = 10

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

/** Popup редактора с iframe страницы расширения, привязанный к кнопке панели. */
export const createMapIframePopup = (options: MapIframePopupOptions): MapIframePopup => {
  let popup: HTMLDivElement | null = null
  let activeButton: HTMLElement | null = null

  const positionPopup = (): void => {
    if (!popup || !activeButton) return

    const buttonRect = activeButton.getBoundingClientRect()
    if (buttonRect.width === 0 && buttonRect.height === 0) return

    const availableHeight = Math.max(buttonRect.top - BUTTON_GAP - VIEWPORT_MARGIN, 0)
    const popupWidth = popup.getBoundingClientRect().width
    const maxLeft = Math.max(document.documentElement.clientWidth - popupWidth - VIEWPORT_MARGIN, 0)

    popup.style.bottom = `${document.documentElement.clientHeight - buttonRect.top + BUTTON_GAP}px`
    popup.style.left = `${Math.max(Math.min(buttonRect.left, maxLeft), VIEWPORT_MARGIN)}px`
    popup.style.maxHeight = `${availableHeight}px`
  }

  const close = (): void => {
    document.removeEventListener('click', handleDocumentClick, true)
    document.removeEventListener('keydown', handleDocumentKeyDown)
    window.removeEventListener('resize', positionPopup)
    popup?.remove()
    activeButton?.setAttribute('aria-expanded', 'false')
    popup = null
    activeButton = null
  }

  const handleDocumentClick = (event: MouseEvent): void => {
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

  const armOutsideClick = (createdPopup: HTMLDivElement): void => {
    setTimeout(() => {
      setTimeout(() => {
        if (popup !== createdPopup) return
        document.addEventListener('click', handleDocumentClick, true)
      }, 0)
    }, 0)
  }

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
    positionPopup()
    document.addEventListener('keydown', handleDocumentKeyDown)
    window.addEventListener('resize', positionPopup)
    // Редактор после клика по кнопке шлёт ещё один клик на следующем тике.
    // Слушатель снаружи включается после него, иначе попап сразу закрывается.
    armOutsideClick(createdPopup)
  }

  return {
    isOpen,
    close,
    toggle,
    teardown: close,
  }
}
