import { browser } from 'wxt/browser'
import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { isYandexBrowser } from '@/lib/browser'
import { buildNkUserBarCssVars, readNkUserBarTypography } from '@/lib/nk_user_bar_typography'
import {
  NMAPS_POINT_PICKED_EVENT,
  notifyCancelPickPoint,
  notifyStartPickPoint,
  parsePointPickedEvent,
} from '@/lib/nmaps_pick_point_notify'
import {
  CLOSE_PANEL_SIDEBAR_ACTION,
  isPanelSidebarMountedInDom,
  PANEL_SIDEBAR_WRAPPER_ID,
  removePanelSidebarFromDom,
} from '@/lib/panel_sidebar_notify'
import {
  CANCEL_POINT_PICKING_ACTION,
  POINT_PICKED_ACTION,
  START_POINT_PICKING_ACTION,
} from '@/lib/pick_point_action'

const PANEL_PAGE = '/panel.html' as const
const PANEL_WIDTH = 425
const Z_INDEX = 2_147_483_647
const TOGGLE_PANEL_ACTION = 'togglePanel' as const
const DOCUMENT_READY_STATE = 'complete' as const

type SidebarUi = {
  mount: () => void
  remove: () => void
}

type RuntimeMessage = Record<string, unknown>

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

    const calculateZoomFromBbox = (bbox: number[]): number => {
      const [minLon, minLat, maxLon, maxLat] = bbox
      const width = window.innerWidth - 425 - 40 // 425 is PANEL_WIDTH, 40 margin
      const height = window.innerHeight - 80 // 80 margin

      let zoomX = 18
      let zoomY = 18

      if (width > 0 && height > 0) {
        const lonDiff = maxLon - minLon
        if (lonDiff > 0) {
          zoomX = Math.log2((width * 360) / (256 * lonDiff))
        }

        const latToMercatorY = (l: number) => {
          const rad = (l * Math.PI) / 180
          return Math.log(Math.tan(Math.PI / 4 + rad / 2))
        }
        const yDiff = Math.abs(latToMercatorY(maxLat) - latToMercatorY(minLat))
        if (yDiff > 0) {
          zoomY = Math.log2((height * 2 * Math.PI) / (256 * yDiff))
        }

        const rawZoom = Math.min(zoomX, zoomY, 18)
        return Math.max(Math.floor(rawZoom) - 1, 2)
      }
      return 18
    }

    const handleCenterMap = (message: RuntimeMessage): void => {
      const lat = Number(message.latitude)
      const lon = Number(message.longitude)
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        let zoom = typeof message.zoom === 'number' ? message.zoom : 18

        if (Array.isArray(message.bbox) && message.bbox.length === 4) {
          zoom = calculateZoomFromBbox(message.bbox)
        }

        document.dispatchEvent(
          new CustomEvent('nmaps:centerMap', {
            detail: { latitude: lat, longitude: lon, zoom },
          }),
        )
      } else {
        console.error('[nmap_uploader panel] Invalid coordinates for centerMap', message)
      }
    }

    const handleSetTrackerDate = (message: RuntimeMessage): void => {
      const nkDate = message.date as string
      if (typeof nkDate !== 'string') return

      const targetContainer = document.querySelector(
        '.nk-select.nk-select_theme_islands.nk-select_size_m',
      )
      if (!targetContainer) return

      const button = targetContainer.querySelector(
        'button.nk-select__button',
      ) as HTMLButtonElement | null
      if (!button) return

      const currentText = button.textContent || ''
      if (currentText.includes(nkDate)) return

      // Надежно эмулируем клик (React иногда игнорирует простой button.click())
      button.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: globalThis as unknown as Window,
        }),
      )
      button.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          view: globalThis as unknown as Window,
        }),
      )
      button.click()

      // Ждем пока DOM обновится и появится popup с меню (проверяем каждые 100мс)
      let attempts = 0
      const checkInterval = setInterval(() => {
        attempts++
        // Ищем пункты меню внутри видимого попапа (у Яндекса он может рендериться в портале)
        const menuItems = document.querySelectorAll(
          '.nk-popup .nk-menu__item, [class*="popup_visible"] [class*="menu-item"]',
        )

        if (menuItems.length > 0) {
          clearInterval(checkInterval) // Меню появилось, останавливаем поиск

          let found = false
          for (const item of Array.from(menuItems)) {
            const itemText = item.textContent || ''
            if (itemText.includes(nkDate)) {
              ;(item as HTMLElement).click()
              found = true
              break
            }
          }

          if (!found) {
            // Если не нашли, закрываем меню повторным кликом по кнопке
            button.click()
          }
        } else if (attempts > 10) {
          clearInterval(checkInterval)
        }
      }, 100)
    }

    const handleRuntimeMessage = (message: RuntimeMessage): void => {
      switch (message?.action) {
        case CLOSE_PANEL_SIDEBAR_ACTION:
          closePanelIfOpen()
          break
        case TOGGLE_PANEL_ACTION:
          startTogglePanel()
          break
        case START_POINT_PICKING_ACTION: {
          const geomType = typeof message.geomType === 'string' ? message.geomType : 'Point'
          notifyStartPickPoint(geomType)
          break
        }
        case CANCEL_POINT_PICKING_ACTION:
          notifyCancelPickPoint()
          break
        case 'centerMap':
          handleCenterMap(message)
          break
        case 'DRAW_MAP_OBJECTS':
          document.dispatchEvent(
            new CustomEvent('nmaps:drawObjects', {
              detail: JSON.stringify({ points: message.points }),
            }),
          )
          break
        case 'SET_TRACKER_DATE':
          handleSetTrackerDate(message)
          break
      }
    }

    const handlePointPicked = (event: Event): void => {
      const parsed = parsePointPickedEvent(event)
      if (parsed) {
        browser.runtime
          .sendMessage({
            action: POINT_PICKED_ACTION,
            coords: parsed.coords,
            geomType: parsed.geomType,
          })
          .catch(reportTogglePanelError)
      }
    }

    let lastTrackerDate = ''
    const checkTrackerDate = () => {
      const btns = document.querySelectorAll('.nk-button__text')
      for (const btn of btns) {
        const txt = btn.textContent?.trim() || ''
        if (/\d{2}\.\d{2}\.\d{4}/.test(txt)) {
          if (txt !== lastTrackerDate) {
            lastTrackerDate = txt
            const panelIframe = document.querySelector(
              `#${PANEL_SIDEBAR_WRAPPER_ID} iframe`,
            ) as HTMLIFrameElement | null
            if (panelIframe?.contentWindow) {
              panelIframe.contentWindow.postMessage(
                { action: 'TRACKER_DATE_CHANGED', date: txt },
                new URL(browser.runtime.getURL('/')).origin,
              )
            }
            browser.runtime
              .sendMessage({ action: 'TRACKER_DATE_CHANGED', date: txt })
              .catch(() => {}) // Ignore errors if no one is listening
          }
          break
        }
      }
    }

    setInterval(checkTrackerDate, 1000)
    checkTrackerDate()

    document.addEventListener(NMAPS_POINT_PICKED_EVENT, handlePointPicked)
    browser.runtime.onMessage.addListener(handleRuntimeMessage)
  },
})
