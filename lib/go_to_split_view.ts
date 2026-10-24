/**
 * Фасад для режима разделенного экрана (Go To Split View).
 * Реализует конечный автомат состояний и детерминированную синхронизацию вьюпорта.
 */
import type { MapLocation } from '@/lib/go_to_link'
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
  type SplitViewStatus,
  updateSplitButtonState,
} from '@/lib/go_to_split_view/index'
import { notifyNmapsMapResize } from '@/lib/nmaps_map_resize_notify'
import { requestClosePanelSidebar } from '@/lib/panel_sidebar_notify'

export * from '@/lib/go_to_split_view/index'

let status: SplitViewStatus = 'closed'
let layoutState: SplitLayoutState | null = null
let domElements: SplitDomElements | null = null
let syncManager: SplitSyncManager | null = null

/** Даёт браузеру применить layout, затем просит ymaps пересчитать тайлы с явным указанием координат. */
const scheduleNmapsMapResize = (location?: MapLocation): void => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      notifyNmapsMapResize(location)
    })
  })
}

const cleanupDomAndSync = (): void => {
  syncManager?.dispose()
  syncManager = null

  domElements?.splitRoot.remove()
  document.querySelector(`.${LEFT_CURSOR_OVERLAY_CLASS}`)?.remove()
  domElements = null

  if (layoutState) {
    clearSplitLayout(layoutState)
    layoutState = null
  }
}

const mountSplitView = (): boolean => {
  if (status !== 'closed') return false
  status = 'opening'

  const location = readNmapsLocation()
  if (!location) {
    status = 'closed'
    return false
  }

  try {
    requestClosePanelSidebar()

    layoutState = applySplitLayout()
    domElements = mountSplitDomElements(buildNakarteUrl(location), () => {
      syncManager?.postInitialLocation()
    })

    syncManager = new SplitSyncManager(domElements, location)
    syncManager.initListeners()

    // Передаем точные координаты для пересчета тайлов и фиксации центра без сдвига
    scheduleNmapsMapResize(location)
    requestAnimationFrame(() => {
      syncManager?.hideCursorMarkers()
    })

    status = 'open'
    updateSplitButtonState(true)
    return true
  } catch (error: unknown) {
    console.warn('[nmap_uploader] mountSplitView failed, rolling back:', error)
    cleanupDomAndSync()
    status = 'closed'
    updateSplitButtonState(false)
    return false
  }
}

export const getSplitViewStatus = (): SplitViewStatus => status

export const isSplitViewOpen = (): boolean => status === 'open' || status === 'opening'

export const teardownSplitView = (): void => {
  if (status === 'closed' || status === 'closing') return
  status = 'closing'

  const lastLocation = syncManager?.getNmapsLocation() ?? readNmapsLocation() ?? undefined

  try {
    cleanupDomAndSync()
    // При закрытии также передаем точные координаты, восстанавливая 100vw без серых тайлов
    scheduleNmapsMapResize(lastLocation)
  } finally {
    status = 'closed'
    updateSplitButtonState(false)
  }
}

export const toggleSplitView = (): boolean => {
  if (status === 'opening' || status === 'closing') {
    // Защита от дребезга и параллельных вызовов
    return false
  }

  if (status === 'open') {
    teardownSplitView()
    return true
  }

  return mountSplitView()
}
