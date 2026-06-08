import { browser } from 'wxt/browser'
import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { buildNkUserBarCssVars, readNkUserBarTypography } from '@/lib/nk_user_bar_typography'
import {
  CLOSE_PANEL_SIDEBAR_ACTION,
  PANEL_SIDEBAR_WRAPPER_ID,
  removePanelSidebarFromDom,
} from '@/lib/panel_sidebar_notify'

const persistYandexBrowserFlag = async (): Promise<void> => {
  if (!/YaBrowser|Yowser|YaSearchBrowser/i.test(navigator.userAgent)) return
  await browser.storage.local.set({ is_yandex_browser: true })
}

const PANEL_PAGE = '/panel.html' as const
const PANEL_WIDTH = 425
const Z_INDEX = 2_147_483_647

type SidebarUi = {
  mount: () => void
  remove: () => void
}

/** Отдаёт управление main thread между короткими задачами. */
const yieldToMain = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve()
    })
  })

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

/** Подставляет типографику nk-user-bar с host-страницы в документ iframe. */
const applyTypographyToIframe = (iframe: HTMLIFrameElement): void => {
  const apply = (): void => {
    const doc = iframe.contentDocument
    if (!doc) return

    const cssVars = buildNkUserBarCssVars(readNkUserBarTypography())
    doc.documentElement.style.cssText += cssVars
  }

  if (iframe.contentDocument?.readyState === 'complete') {
    apply()
    return
  }

  iframe.addEventListener('load', apply, { once: true })
}

/** Лёгкая замена createIframeUi без wait-element / MutationObserver. */
const createSidebarIframeUi = (ctx: ContentScriptContext): SidebarUi => {
  const wrapper = document.createElement('div')
  wrapper.id = PANEL_SIDEBAR_WRAPPER_ID
  const iframe = document.createElement('iframe')
  wrapper.appendChild(iframe)

  let isMounted = false

  const mount = (): void => {
    if (isMounted) return

    if (!iframe.src) {
      iframe.src = browser.runtime.getURL(PANEL_PAGE)
    }

    styleSidebarWrapper(wrapper)
    styleSidebarIframe(iframe)
    document.body.appendChild(wrapper)
    applyTypographyToIframe(iframe)
    isMounted = true
  }

  const remove = (): void => {
    wrapper.remove()
    isMounted = false
  }

  ctx.onInvalidated(remove)

  return { mount, remove }
}

// WXT подхватывает default export при сборке; статического import нет
// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    void persistYandexBrowserFlag()
    let ui: SidebarUi | undefined
    let isOpen = false

    const ensureUi = (): SidebarUi => {
      ui ??= createSidebarIframeUi(ctx)
      return ui
    }

    const closePanelIfOpen = (): void => {
      const isMountedInDom = Boolean(document.getElementById(PANEL_SIDEBAR_WRAPPER_ID))
      if (!isOpen && !isMountedInDom) return

      ensureUi().remove()
      removePanelSidebarFromDom()
      isOpen = false
    }

    const togglePanel = async (): Promise<void> => {
      const panelUi = ensureUi()

      if (isOpen) {
        panelUi.remove()
        isOpen = false
        return
      }

      await yieldToMain()
      panelUi.mount()
      isOpen = true
    }

    browser.runtime.onMessage.addListener((message) => {
      if (message?.action === CLOSE_PANEL_SIDEBAR_ACTION) {
        closePanelIfOpen()
        return
      }

      if (message?.action !== 'togglePanel') return

      void (async () => {
        await yieldToMain()
        await togglePanel()
      })().catch((error: unknown) => {
        console.error('[nmap_uploader] togglePanel failed:', error)
      })
    })
  },
})
