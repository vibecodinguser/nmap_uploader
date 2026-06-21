import { browser } from 'wxt/browser'
import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { isYandexBrowser } from '@/lib/browser'
import { buildNkUserBarCssVars, readNkUserBarTypography } from '@/lib/nk_user_bar_typography'
import {
  CLOSE_PANEL_SIDEBAR_ACTION,
  isPanelSidebarMountedInDom,
  PANEL_SIDEBAR_WRAPPER_ID,
  removePanelSidebarFromDom,
} from '@/lib/panel_sidebar_notify'
import { POINT_PICKED_ACTION, START_POINT_PICKING_ACTION } from '@/lib/pick_point_action'
import {
  NMAPS_POINT_PICKED_EVENT,
  notifyStartPickPoint,
  parsePointPickedEvent,
} from '@/lib/nmaps_pick_point_notify'

const PANEL_PAGE = '/panel.html' as const
const PANEL_WIDTH = 425
const Z_INDEX = 2_147_483_647
const TOGGLE_PANEL_ACTION = 'togglePanel' as const
const DOCUMENT_READY_STATE = 'complete' as const

type SidebarUi = {
  mount: () => void
  remove: () => void
}

type RuntimeMessage = {
  action?: string
}

const persistYandexBrowserFlag = async (): Promise<void> => {
  if (isYandexBrowser()) {
    await browser.storage.local.set({ is_yandex_browser: true })
  }
}

const reportPersistYandexBrowserFlagError = (error: unknown): void => {
  console.error('[nmap_uploader] persistYandexBrowserFlag failed:', error)
}

const startPersistYandexBrowserFlag = (): void => {
  const promise = persistYandexBrowserFlag()
  promise.catch(reportPersistYandexBrowserFlagError)
}

const onYieldAnimationFrame = (resolve: () => void): void => {
  const completeYield = (): void => {
    resolve()
  }
  requestAnimationFrame(completeYield)
}

/** Отдаёт управление main thread между короткими задачами. */
const yieldToMain = (): Promise<void> => new Promise(onYieldAnimationFrame)

const styleSidebarWrapper = (wrapper: HTMLElement): void => {
  wrapper.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: ${PANEL_WIDTH}px !important;
    z-index: ${Z_INDEX} !important;
    display: block !important;
    overflow: hidden !important;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12) !important;
  `
}

const styleSidebarIframe = (iframe: HTMLIFrameElement): void => {
  iframe.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    border: none !important;
    display: block !important;
  `
}

const appendSidebarWrapper = (wrapper: HTMLElement): void => {
  document.documentElement.appendChild(wrapper)
}

/** Подставляет типографику nk-user-bar с host-страницы в документ iframe. */
const applyTypographyToIframe = (iframe: HTMLIFrameElement): void => {
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

/** Лёгкая замена createIframeUi без wait-element / MutationObserver. */
const createSidebarIframeUi = (ctx: ContentScriptContext): SidebarUi => {
  const wrapper = document.createElement('div')
  wrapper.id = PANEL_SIDEBAR_WRAPPER_ID
  const iframe = document.createElement('iframe')
  wrapper.appendChild(iframe)

  const mount = (): void => {
    if (!wrapper.isConnected) {
      if (!iframe.src) {
        iframe.src = browser.runtime.getURL(PANEL_PAGE)
      }

      styleSidebarWrapper(wrapper)
      styleSidebarIframe(iframe)
      appendSidebarWrapper(wrapper)
      applyTypographyToIframe(iframe)
    }
  }

  const remove = (): void => {
    if (wrapper.isConnected) {
      wrapper.remove()
    }
  }

  ctx.onInvalidated(remove)

  return { mount, remove }
}

const reportTogglePanelError = (error: unknown): void => {
  console.error('[nmap_uploader] togglePanel failed:', error)
}

// WXT подхватывает default export при сборке; статического import нет
// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    startPersistYandexBrowserFlag()
    let ui: SidebarUi | undefined

    const ensureUi = (): SidebarUi => {
      ui ??= createSidebarIframeUi(ctx)
      return ui
    }

    const closePanelIfOpen = (): void => {
      if (isPanelSidebarMountedInDom()) {
        const panelUi = ensureUi()
        panelUi.remove()
        removePanelSidebarFromDom()
      }
    }

    const togglePanel = async (): Promise<void> => {
      const panelUi = ensureUi()

      if (isPanelSidebarMountedInDom()) {
        panelUi.remove()
      } else {
        await yieldToMain()
        panelUi.mount()
      }
    }

    const runTogglePanel = async (): Promise<void> => {
      await yieldToMain()
      await togglePanel()
    }

    const startTogglePanel = (): void => {
      const promise = runTogglePanel()
      promise.catch(reportTogglePanelError)
    }

    const handleRuntimeMessage = (message: RuntimeMessage): void => {
      if (CLOSE_PANEL_SIDEBAR_ACTION === message?.action) {
        closePanelIfOpen()
      } else if (TOGGLE_PANEL_ACTION === message?.action) {
        startTogglePanel()
      } else if (START_POINT_PICKING_ACTION === message?.action) {
        const geomType = typeof message.geomType === 'string' ? message.geomType : 'Point'
        notifyStartPickPoint(geomType)
      }
    }

    const handlePointPicked = (event: Event): void => {
      const parsed = parsePointPickedEvent(event)
      if (parsed) {
        browser.runtime.sendMessage({
          action: POINT_PICKED_ACTION,
          coords: parsed.coords,
          geomType: parsed.geomType,
        }).catch(reportTogglePanelError)
      }
    }

    document.addEventListener(NMAPS_POINT_PICKED_EVENT, handlePointPicked)
    browser.runtime.onMessage.addListener(handleRuntimeMessage)
  },
})
