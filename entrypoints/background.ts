import { type Browser, browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import {
  CLOSE_CURRENT_TAB_ACTION,
  configureInstalledSidePanel,
  createMessageRouter,
  ensurePanelSidebarRegistered,
  getToolbarActionApi,
  handleApplyStrokeColor,
  handleCancelPointPicking,
  handleCenterMap,
  handleCloseCurrentTab,
  handleClosePanel,
  handleDrawMapObjects,
  handleEnsureAuth,
  handleGetAuth,
  handleGetDrawMapObjects,
  handleGetTrackerDate,
  handleGoToRefresh,
  handleListOccupiedDates,
  handleLogin,
  handleLogout,
  handleReloadEditor,
  handleSetTrackerDate,
  handleStartPointPicking,
  handleUpload,
  handleUploadNspdGeoJson,
  type MessageHandler,
  openPanel,
  persistYandexBrowserFlag,
  runBackgroundTask,
  UPLOAD_NSPD_GEOJSON_ACTION,
} from '@/lib/background'
import { GO_TO_REFRESH_ACTION } from '@/lib/go_to_notify'
import { syncLocaleFromStorage } from '@/lib/i18n'
import type { RuntimeMessageSender } from '@/lib/message_auth'
import { CLOSE_PANEL_SIDEBAR_ACTION } from '@/lib/panel_sidebar_notify'
import { CANCEL_POINT_PICKING_ACTION, START_POINT_PICKING_ACTION } from '@/lib/pick_point_action'

const handleToolbarClick = (tab: Browser.tabs.Tab): void => {
  const panelTask = openPanel(tab)
  runBackgroundTask(panelTask, 'openPanel')
}

const handleInstalled = (): void => {
  const persistTask = persistYandexBrowserFlag()
  runBackgroundTask(persistTask, 'persistYandexBrowserFlag')

  const registerTask = ensurePanelSidebarRegistered()
  runBackgroundTask(registerTask, 'ensurePanelSidebarRegistered')

  const configureTask = configureInstalledSidePanel()
  runBackgroundTask(configureTask, 'shouldUseNativeSidePanel')
}

const messageHandlers: Record<string, MessageHandler> = {
  getAuth: handleGetAuth,
  ensureAuth: handleEnsureAuth,
  login: handleLogin,
  logout: handleLogout,
  listOccupiedDates: handleListOccupiedDates,
  uploadProcessedFiles: handleUpload,
  reloadEditorPage: handleReloadEditor,
  [GO_TO_REFRESH_ACTION]: handleGoToRefresh,
  [CLOSE_PANEL_SIDEBAR_ACTION]: handleClosePanel,
  [START_POINT_PICKING_ACTION]: handleStartPointPicking,
  [CANCEL_POINT_PICKING_ACTION]: handleCancelPointPicking,
  applyStrokeColor: handleApplyStrokeColor,
  centerMap: handleCenterMap,
  getTrackerDate: handleGetTrackerDate,
  DRAW_MAP_OBJECTS: handleDrawMapObjects,
  GET_DRAW_MAP_OBJECTS: handleGetDrawMapObjects,
  SET_TRACKER_DATE: handleSetTrackerDate,
  [UPLOAD_NSPD_GEOJSON_ACTION]: handleUploadNspdGeoJson,
  [CLOSE_CURRENT_TAB_ACTION]: handleCloseCurrentTab,
}

const backgroundMessageRouter = createMessageRouter({ handlers: messageHandlers })

const onMessageHandler = (
  message: unknown,
  sender: RuntimeMessageSender,
  sendResponse: (response: unknown) => void,
): boolean | undefined => {
  return backgroundMessageRouter.dispatch(message, sender, sendResponse)
}

const initBackground = (): void => {
  const persistTask = persistYandexBrowserFlag()
  runBackgroundTask(persistTask, 'persistYandexBrowserFlag')

  const registerTask = ensurePanelSidebarRegistered()
  runBackgroundTask(registerTask, 'ensurePanelSidebarRegistered')

  const localeTask = syncLocaleFromStorage()
  runBackgroundTask(localeTask, 'syncLocaleFromStorage')

  const toolbarAction = getToolbarActionApi()
  if (toolbarAction) {
    toolbarAction.onClicked.addListener(handleToolbarClick)
  } else {
    console.error('[nmap_uploader] toolbar action API is unavailable in this browser')
  }

  browser.runtime.onInstalled.addListener(handleInstalled)
  browser.runtime.onMessage.addListener(onMessageHandler)
}

// noinspection JSUnusedGlobalSymbols
export default defineBackground({
  main() {
    initBackground()
  },
})
