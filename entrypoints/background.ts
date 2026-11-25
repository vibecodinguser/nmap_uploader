import { type Browser, browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import {
  CLOSE_CURRENT_TAB_ACTION,
  createMessageRouter,
  getToolbarActionApi,
  handleApplyStrokeColor,
  handleCancelPointPicking,
  handleCenterMap,
  handleCloseCurrentTab,
  handleEnsureAuth,
  handleGetAuth,
  handleGoToRefresh,
  handleListOccupiedDates,
  handleLogin,
  handleLogout,
  handleNotesDeleteGroup,
  handleNotesDeleteNote,
  handleNotesDeleteNotes,
  handleNotesDrawFinished,
  handleNotesHiddenChanged,
  handleNotesLoad,
  handleNotesMoveNote,
  handleNotesMoveNotes,
  handleNotesSaveGroup,
  handleNotesSaveNote,
  handleNotesSelect,
  handleNotesStartDraw,
  handleNotesUploadIcon,
  handlePointPicked,
  handleReloadEditor,
  handleSetTrackerDate,
  handleStartPointPicking,
  handleUpload,
  handleUploadNspdGeoJson,
  type MessageHandler,
  migrateLegacyNotesFolderOnStartup,
  openSettingsPopup,
  persistYandexBrowserFlag,
  runBackgroundTask,
  UPLOAD_NSPD_GEOJSON_ACTION,
} from '@/lib/background'
import { GO_TO_REFRESH_ACTION } from '@/lib/go_to_notify'
import { removeLegacyLocaleSetting } from '@/lib/i18n'
import type { RuntimeMessageSender } from '@/lib/message_auth'
import {
  NOTES_DELETE_GROUP_ACTION,
  NOTES_DELETE_NOTE_ACTION,
  NOTES_DELETE_NOTES_ACTION,
  NOTES_DRAW_FINISHED_ACTION,
  NOTES_HIDDEN_CHANGED_ACTION,
  NOTES_LOAD_ACTION,
  NOTES_MOVE_NOTE_ACTION,
  NOTES_MOVE_NOTES_ACTION,
  NOTES_SAVE_GROUP_ACTION,
  NOTES_SAVE_NOTE_ACTION,
  NOTES_SELECT_ACTION,
  NOTES_START_DRAW_ACTION,
  NOTES_UPLOAD_ICON_ACTION,
} from '@/lib/notes/protocol'
import {
  initNspdContentScriptSync,
  syncNspdContentScriptsFromStorage,
} from '@/lib/nspd/content_scripts'
import {
  CANCEL_POINT_PICKING_ACTION,
  POINT_PICKED_ACTION,
  START_POINT_PICKING_ACTION,
} from '@/lib/pick_point_action'
import { installWxtDevLogFilter } from '@/lib/wxt_dev_log_filter'

const handleToolbarClick = (tab: Browser.tabs.Tab): void => {
  const panelTask = openSettingsPopup(tab)
  runBackgroundTask(panelTask, 'openSettingsPopup')
}

const handleInstalled = (): void => {
  const persistTask = persistYandexBrowserFlag()
  runBackgroundTask(persistTask, 'persistYandexBrowserFlag')

  // Браузер очищает динамические content scripts при обновлении — регистрируем заново.
  const nspdTask = syncNspdContentScriptsFromStorage()
  runBackgroundTask(nspdTask, 'syncNspdContentScriptsFromStorage')
}

const messageHandlers: Record<string, MessageHandler> = {
  getAuth: handleGetAuth,
  ensureAuth: handleEnsureAuth,
  login: handleLogin,
  logout: handleLogout,
  listOccupiedDates: handleListOccupiedDates,
  uploadProcessedFiles: handleUpload,
  [NOTES_LOAD_ACTION]: handleNotesLoad,
  [NOTES_SAVE_NOTE_ACTION]: handleNotesSaveNote,
  [NOTES_DELETE_NOTE_ACTION]: handleNotesDeleteNote,
  [NOTES_SAVE_GROUP_ACTION]: handleNotesSaveGroup,
  [NOTES_DELETE_GROUP_ACTION]: handleNotesDeleteGroup,
  [NOTES_MOVE_NOTE_ACTION]: handleNotesMoveNote,
  [NOTES_DELETE_NOTES_ACTION]: handleNotesDeleteNotes,
  [NOTES_MOVE_NOTES_ACTION]: handleNotesMoveNotes,
  [NOTES_UPLOAD_ICON_ACTION]: handleNotesUploadIcon,
  [NOTES_SELECT_ACTION]: handleNotesSelect,
  [NOTES_START_DRAW_ACTION]: handleNotesStartDraw,
  [NOTES_DRAW_FINISHED_ACTION]: handleNotesDrawFinished,
  [NOTES_HIDDEN_CHANGED_ACTION]: handleNotesHiddenChanged,
  reloadEditorPage: handleReloadEditor,
  [GO_TO_REFRESH_ACTION]: handleGoToRefresh,
  [START_POINT_PICKING_ACTION]: handleStartPointPicking,
  [CANCEL_POINT_PICKING_ACTION]: handleCancelPointPicking,
  [POINT_PICKED_ACTION]: handlePointPicked,
  applyStrokeColor: handleApplyStrokeColor,
  centerMap: handleCenterMap,
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

  const localeTask = removeLegacyLocaleSetting()
  runBackgroundTask(localeTask, 'removeLegacyLocaleSetting')

  // Перенос заметок из папки Блокнота не должен ждать, пока откроют панель:
  // пока папка `notes` лежит внутри Блокнота, трекер редактора падает на её
  // манифесте, который принимает за данные трека.
  runBackgroundTask(migrateLegacyNotesFolderOnStartup(), 'notes migration')

  initNspdContentScriptSync()

  const toolbarAction = getToolbarActionApi()
  if (toolbarAction) {
    toolbarAction.onClicked.addListener(handleToolbarClick)
  } else {
    console.error('[yamapper] toolbar action API is unavailable in this browser')
  }

  browser.runtime.onInstalled.addListener(handleInstalled)
  browser.runtime.onMessage.addListener(onMessageHandler)
}

// noinspection JSUnusedGlobalSymbols
// На уровне модуля, а не внутри `main`: этот файл импортируется виртуальной
// точкой входа WXT раньше, чем она поднимет websocket dev-сервера. Иначе первое
// же сообщение о пересборке успело бы напечатать служебные строки.
installWxtDevLogFilter()

export default defineBackground({
  main() {
    initBackground()
  },
})
