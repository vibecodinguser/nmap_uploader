import { buildNkUserBarCssVars, readNkUserBarTypography } from '@/lib/nk_user_bar_typography'
import { PANEL_SIDEBAR_WRAPPER_ID } from '@/lib/panel_sidebar_notify'

export const PANEL_PAGE = '/panel.html' as const
export const PANEL_WIDTH = 425
export const PANEL_Z_INDEX = 2_147_483_647
const DOCUMENT_READY_STATE = 'complete' as const

export interface SidebarUi {
  mount: () => void
  remove: () => void
  readonly wrapper: HTMLElement
  readonly iframe: HTMLIFrameElement
}

export const styleSidebarWrapper = (wrapper: HTMLElement): void => {
  wrapper.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: ${PANEL_WIDTH}px !important;
    z-index: ${PANEL_Z_INDEX} !important;
    display: block !important;
    overflow: hidden !important;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12) !important;
  `
}

export const styleSidebarIframe = (iframe: HTMLIFrameElement): void => {
  iframe.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    border: none !important;
    display: block !important;
  `
}

export const applyTypographyToIframe = (iframe: HTMLIFrameElement): void => {
  const applyTypography = (): void => {
    const doc = iframe.contentDocument
    if (doc) {
      const typography = readNkUserBarTypography()
      const cssVars = buildNkUserBarCssVars(typography)
      doc.documentElement.style.cssText += cssVars
    }
  }

  const isDocumentReady = DOCUMENT_READY_STATE === iframe.contentDocument?.readyState
  if (isDocumentReady) {
    applyTypography()
  } else {
    iframe.addEventListener('load', applyTypography, { once: true })
  }
}

/**
 * Создает DOM-компоненты сайдбара и интерфейс монтирования.
 */
export const createSidebarIframeUi = (getPanelUrl?: () => string): SidebarUi => {
  const wrapper = document.createElement('div')
  wrapper.id = PANEL_SIDEBAR_WRAPPER_ID
  const iframe = document.createElement('iframe')
  wrapper.appendChild(iframe)

  const mount = (): void => {
    if (!wrapper.isConnected) {
      if (!iframe.src) {
        iframe.src = getPanelUrl ? getPanelUrl() : PANEL_PAGE
      }

      styleSidebarWrapper(wrapper)
      styleSidebarIframe(iframe)
      document.documentElement.appendChild(wrapper)
      applyTypographyToIframe(iframe)
    }
  }

  const remove = (): void => {
    if (wrapper.isConnected) {
      wrapper.remove()
    }
  }

  return { mount, remove, wrapper, iframe }
}
