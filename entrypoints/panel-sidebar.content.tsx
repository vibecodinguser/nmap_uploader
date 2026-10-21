import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { isYandexBrowser } from '@/lib/browser'
import {
  NMAPS_POINT_PICKED_EVENT,
  notifyCancelPickPoint,
  notifyStartPickPoint,
  parsePointPickedEvent,
} from '@/lib/nmaps_pick_point_notify'
import {
  checkAndNotifyTrackerDate,
  createSidebarIframeUi,
  PANEL_PAGE,
  parseCenterMapMessage,
  type SidebarUi,
  sendTrackerDateToIframe,
  setTrackerDateInDom,
} from '@/lib/panel_sidebar'
import {
  CLOSE_PANEL_SIDEBAR_ACTION,
  isPanelSidebarMountedInDom,
  removePanelSidebarFromDom,
} from '@/lib/panel_sidebar_notify'
import {
  CANCEL_POINT_PICKING_ACTION,
  POINT_PICKED_ACTION,
  START_POINT_PICKING_ACTION,
} from '@/lib/pick_point_action'

const TOGGLE_PANEL_ACTION = 'togglePanel' as const

type RuntimeMessage = Record<string, unknown>

const persistYandexBrowserFlag = async (): Promise<void> => {
  if (isYandexBrowser()) {
    await browser.storage.local.set({ is_yandex_browser: true })
  }
}

const onYieldAnimationFrame = (resolve: () => void): void => {
  requestAnimationFrame(() => {
    resolve()
  })
}

/** Отдаёт управление main thread между короткими задачами. */
const yieldToMain = (): Promise<void> => new Promise(onYieldAnimationFrame)

export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    persistYandexBrowserFlag().catch((error: unknown) => {
      console.error('[nmap_uploader] persistYandexBrowserFlag failed:', error)
    })

    let ui: SidebarUi | undefined

    const ensureUi = (): SidebarUi => {
      ui ??= createSidebarIframeUi(() => browser.runtime.getURL(PANEL_PAGE))
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

    const startTogglePanel = (): void => {
      yieldToMain()
        .then(togglePanel)
        .catch((error: unknown) => {
          console.error('[nmap_uploader] togglePanel failed:', error)
        })
    }

    const handleCenterMap = (message: RuntimeMessage): void => {
      const params = parseCenterMapMessage(message)
      if (params) {
        document.dispatchEvent(
          new CustomEvent('nmaps:centerMap', {
            detail: params,
          }),
        )
      } else {
        console.error('[nmap_uploader panel] Invalid coordinates for centerMap', message)
      }
    }

    const handleSetTrackerDate = (message: RuntimeMessage): void => {
      const nkDate = message.date as string
      if (typeof nkDate === 'string') {
        setTrackerDateInDom(nkDate)
      }
    }

    const dispatchDrawMapObjects = (message: RuntimeMessage): void => {
      document.dispatchEvent(
        new CustomEvent('nmaps:drawObjects', {
          detail: JSON.stringify({
            points: message.points,
            snapTargets: message.snapTargets ?? [],
          }),
        }),
      )
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
          dispatchDrawMapObjects(message)
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
          .catch((error: unknown) => {
            console.error('[nmap_uploader] pointPicked send failed:', error)
          })
      }
    }

    let lastTrackerDate = ''
    const checkTrackerDate = () => {
      lastTrackerDate = checkAndNotifyTrackerDate({
        lastDate: lastTrackerDate,
        onDateChange: (newDate) => {
          sendTrackerDateToIframe(newDate, new URL(browser.runtime.getURL('/')).origin)
          browser.runtime
            .sendMessage({ action: 'TRACKER_DATE_CHANGED', date: newDate })
            .catch(() => {})
        },
      })
    }

    const trackerInterval = setInterval(checkTrackerDate, 1000)
    checkTrackerDate()

    document.addEventListener(NMAPS_POINT_PICKED_EVENT, handlePointPicked)
    browser.runtime.onMessage.addListener(handleRuntimeMessage)

    browser.runtime
      .sendMessage({ action: 'GET_DRAW_MAP_OBJECTS' })
      .then((message) => {
        if (message && Array.isArray(message.points)) {
          dispatchDrawMapObjects(message)
        }
      })
      .catch(() => {})

    ctx.onInvalidated(() => {
      clearInterval(trackerInterval)
      document.removeEventListener(NMAPS_POINT_PICKED_EVENT, handlePointPicked)
      browser.runtime.onMessage.removeListener(handleRuntimeMessage)
      if (ui) {
        ui.remove()
      }
    })
  },
})
