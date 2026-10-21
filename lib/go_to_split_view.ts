/**
 * Фасад для режима разделенного экрана (Go To Split View).
 * Предоставляет обратную совместимость для всех внешних потребителей.
 */
import { buildNakarteUrl } from '@/lib/go_to_map_sync'
import {
  applySplitLayout,
  clearSplitLayout,
  LEFT_CURSOR_OVERLAY_CLASS,
  mountSplitDomElements,
  readNmapsLocation,
  type SplitDomElements,
  type SplitLayoutState,
  SplitSyncManager,
  updateSplitButtonState,
} from '@/lib/go_to_split_view/index'
import { notifyNmapsMapResize } from '@/lib/nmaps_map_resize_notify'
import { requestClosePanelSidebar } from '@/lib/panel_sidebar_notify'

export * from '@/lib/go_to_split_view/index'

let isOpen = false
let layoutState: SplitLayoutState | null = null
let domElements: SplitDomElements | null = null
let syncManager: SplitSyncManager | null = null

/** Даёт браузеру применить layout, затем просит ymaps пересчитать тайлы. */
const scheduleNmapsMapResize = (): void => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      notifyNmapsMapResize()
    })
  })
}

const mountSplitView = (): boolean => {
  const location = readNmapsLocation()
  if (!location) return false

  requestClosePanelSidebar()

  layoutState = applySplitLayout()
  domElements = mountSplitDomElements(buildNakarteUrl(location), () => {
    syncManager?.postInitialLocation()
  })

  syncManager = new SplitSyncManager(domElements, location)
  syncManager.initListeners()

  scheduleNmapsMapResize()
  requestAnimationFrame(() => {
    syncManager?.hideCursorMarkers()
  })

  isOpen = true
  updateSplitButtonState(isOpen)
  return true
}

export const isSplitViewOpen = (): boolean => isOpen

export const teardownSplitView = (): void => {
  if (!isOpen) return

  syncManager?.dispose()
  syncManager = null

  domElements?.splitRoot.remove()
  document.querySelector(`.${LEFT_CURSOR_OVERLAY_CLASS}`)?.remove()
  domElements = null

  if (layoutState) {
    clearSplitLayout(layoutState)
    layoutState = null
  }

  scheduleNmapsMapResize()

  isOpen = false
  updateSplitButtonState(isOpen)
}

export const toggleSplitView = (): boolean => {
  if (isOpen) {
    teardownSplitView()
    return true
  }

  return mountSplitView()
}
