import { type Browser, browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { detectYandexBrowserInPageContext, isYandexBrowser } from '@/lib/browser'
import { getErrorMessage } from '@/lib/errors'
import { GO_TO_REFRESH_ACTION } from '@/lib/go_to_notify'
import { createTranslator, syncLocaleFromStorage } from '@/lib/i18n'
import { collectMapTabIds, isMapTabUrl, MAP_ORIGIN, MAP_TAB_URL_PATTERN } from '@/lib/map_tab'
import {
  isTrustedNmapsOrPanelSender,
  isTrustedPanelSender,
  logRejectedMessage,
  type RuntimeMessageSender,
} from '@/lib/message_auth'
import { CLOSE_PANEL_SIDEBAR_ACTION } from '@/lib/panel_sidebar_notify'
import { START_POINT_PICKING_ACTION } from '@/lib/pick_point_action'
import { reloadMapEditorTabs } from '@/lib/reload_editor_page'
import {
  type ProcessedFileInput,
  type UploadResult,
  uploadProcessedFilesToYandexDisk,
} from '@/lib/upload_service'
import {
  type AuthPayload,
  buildAuthPayload,
  clearAuth,
  ensureYandexAuth,
  getStoredAuth,
  listExistingDateFolders,
  loadUserAvatarDataUrl,
  type YandexUser,
} from '@/lib/yandex/client'

const PANEL_PAGE = '/panel.html'

type SidePanelApi = {
  open: (options: { windowId?: number; tabId?: number }) => Promise<void>
  setOptions: (options: { path: string; enabled?: boolean }) => Promise<void>
}

const getSidePanelApi = (): SidePanelApi | undefined => {
  return (browser as typeof browser & { sidePanel?: SidePanelApi }).sidePanel
}

type ToolbarActionApi = {
  onClicked: {
    addListener: (callback: (tab: Browser.tabs.Tab) => void) => void
  }
}

const getToolbarActionApi = (): ToolbarActionApi | undefined => {
  let result: ToolbarActionApi | undefined
  if (browser.action?.onClicked) {
    result = browser.action
  } else {
    const browserAction = (browser as typeof browser & { browserAction?: ToolbarActionApi })
      .browserAction
    if (browserAction?.onClicked) {
      result = browserAction
    }
  }
  return result
}

const PANEL_SIDEBAR_SCRIPT = '/content-scripts/panel-sidebar.js' as const
const MAP_HOME = `${MAP_ORIGIN}/` as const
const MAP_URL_PATTERN = MAP_TAB_URL_PATTERN
const PANEL_SIDEBAR_REGISTRATION_ID = 'nmap-panel-sidebar' as const

const logBackgroundTaskFailure = (label: string, error: unknown): void => {
  console.warn(`[nmap_uploader] ${label} failed:`, error)
}

const executeBackgroundTask = async (task: Promise<unknown>, label: string): Promise<void> => {
  try {
    await task
  } catch (error: unknown) {
    logBackgroundTaskFailure(label, error)
  }
}

const runBackgroundTask = (task: Promise<unknown>, label: string): void => {
  // Promise is intentionally not awaited to run in background.
  // execution variable is kept to avoid unhandled promise rejection warnings.
  const execution = executeBackgroundTask(task, label)
  void execution
}

const relayMessageToMapTabs = async (
  sender: RuntimeMessageSender,
  message: Record<string, unknown>,
): Promise<void> => {
  const senderTabId = sender.tab?.id
  if (senderTabId && isMapTabUrl(sender.tab?.url)) {
    await browser.tabs.sendMessage(senderTabId, message)
  } else {
    const tabIds = await collectMapTabIds()
    const sendRelayToTab = (tabId: number) => browser.tabs.sendMessage(tabId, message)
    const promises = tabIds.map(sendRelayToTab)
    await Promise.allSettled(promises)
  }
}

const persistYandexBrowserFlag = async (): Promise<void> => {
  const yandexBrowser = isYandexBrowser()
  if (yandexBrowser) {
    await browser.storage.local.set({ is_yandex_browser: true })
  }
}

const readYandexUaFromTab = async (tabId: number): Promise<boolean> => {
  let result = false
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: detectYandexBrowserInPageContext,
    })
    result = Boolean(injection?.result)
  } catch {
    // ignore errors
  }
  return result
}

const checkTabsForYandexBrowser = async (): Promise<boolean> => {
  const mapTabs = await browser.tabs.query({ url: MAP_URL_PATTERN })
  for (const mapTab of mapTabs) {
    if (mapTab.id) {
      const tabIsYandex = await readYandexUaFromTab(mapTab.id)
      if (tabIsYandex) {
        return true
      }
    }
  }
  return false
}

const resolveIsYandexBrowser = async (): Promise<boolean> => {
  if (isYandexBrowser()) {
    await browser.storage.local.set({ is_yandex_browser: true })
    return true
  }

  const stored = await browser.storage.local.get('is_yandex_browser')
  if (true === stored.is_yandex_browser) {
    return true
  }

  const foundInTabs = await checkTabsForYandexBrowser()
  if (foundInTabs) {
    await browser.storage.local.set({ is_yandex_browser: true })
    return true
  }

  return false
}

const shouldUseNativeSidePanel = async (): Promise<boolean> => {
  const isYandex = await resolveIsYandexBrowser()
  const sidePanelApi = getSidePanelApi()
  let useNative = false
  if (!isYandex && sidePanelApi) {
    useNative = true
  }
  return useNative
}

const sleep = (ms: number): Promise<void> => {
  const resolveAfterDelay = (resolve: () => void) => {
    setTimeout(resolve, ms)
  }
  return new Promise<void>(resolveAfterDelay)
}

const sendTogglePanel = async (tabId: number): Promise<void> => {
  await browser.tabs.sendMessage(tabId, { action: 'togglePanel' })
}

const retrySendTogglePanel = async (tabId: number): Promise<boolean> => {
  let succeeded = false
  const maxAttempts = 8
  for (let attempt = 0; attempt < maxAttempts && !succeeded; attempt += 1) {
    try {
      await sendTogglePanel(tabId)
      succeeded = true
    } catch {
      const delay = 150 * (attempt + 1)
      await sleep(delay)
    }
  }
  return succeeded
}

const isPanelSidebarScript = (path: string): boolean => {
  return path.includes('panel-sidebar')
}

const manifestIncludesPanelSidebar = (): boolean => {
  const entries = browser.runtime.getManifest().content_scripts ?? []
  const entryIncludesPanelSidebar = (entry: { js?: string[] }) =>
    entry.js?.some(isPanelSidebarScript) ?? false
  return entries.some(entryIncludesPanelSidebar)
}

const isDuplicateContentScriptIdError = (error: unknown): boolean => {
  return error instanceof Error && error.message.includes('Duplicate script ID')
}

const registerPanelSidebarContentScript = async (): Promise<void> => {
  if (!manifestIncludesPanelSidebar()) {
    const registered = await browser.scripting.getRegisteredContentScripts()
    const isRegisteredPanelSidebar = (script: { id: string }) =>
      script.id === PANEL_SIDEBAR_REGISTRATION_ID
    const isAlreadyRegistered = registered.some(isRegisteredPanelSidebar)
    if (!isAlreadyRegistered) {
      try {
        await browser.scripting.registerContentScripts([
          {
            id: PANEL_SIDEBAR_REGISTRATION_ID,
            matches: ['https://n.maps.yandex.ru/*'],
            js: [PANEL_SIDEBAR_SCRIPT],
            runAt: 'document_idle',
          },
        ])
      } catch (error: unknown) {
        if (!isDuplicateContentScriptIdError(error)) {
          throw error
        }
      }
    }
  }
}

let panelSidebarRegistration: Promise<void> | undefined

const handleEnsurePanelSidebarError = (error: unknown): void => {
  panelSidebarRegistration = undefined
  console.warn('[nmap_uploader] ensurePanelSidebarRegistered failed:', error)
}

const registerPanelSidebarSafely = async (): Promise<void> => {
  try {
    await registerPanelSidebarContentScript()
  } catch (error: unknown) {
    handleEnsurePanelSidebarError(error)
  }
}

const ensurePanelSidebarRegistered = (): Promise<void> => {
  panelSidebarRegistration ??= registerPanelSidebarSafely()
  return panelSidebarRegistration
}

const getBackgroundTranslator = async () => {
  const locale = await syncLocaleFromStorage()
  return createTranslator(locale)
}

const waitForTabReady = async (tabId: number, maxMs = 15_000): Promise<Browser.tabs.Tab> => {
  const started = Date.now()
  const t = await getBackgroundTranslator()

  while (Date.now() - started < maxMs) {
    const tab = await browser.tabs.get(tabId)
    const isReady = 'complete' === tab.status && isMapTabUrl(tab.url)
    if (isReady) {
      return tab
    }
    await sleep(150)
  }

  const message = t('background.mapPageLoadTimeout')
  throw new Error(message)
}

const focusTab = async (tab: Browser.tabs.Tab): Promise<void> => {
  if (tab.id) {
    await browser.tabs.update(tab.id, { active: true })
    if (tab.windowId) {
      await browser.windows.update(tab.windowId, { focused: true })
    }
  }
}

const hasDefinedTabId = (tab: Browser.tabs.Tab): boolean => tab.id !== undefined

const resolveMapTargetTab = async (clickedTab: Browser.tabs.Tab): Promise<Browser.tabs.Tab> => {
  let result: Browser.tabs.Tab

  if (clickedTab.id && isMapTabUrl(clickedTab.url)) {
    result = clickedTab
  } else {
    const queryOptions = {
      url: MAP_URL_PATTERN,
      ...(clickedTab.windowId !== undefined && { windowId: clickedTab.windowId }),
    }
    const tabsInWindow = await browser.tabs.query(queryOptions)
    const mapTabInWindow = tabsInWindow.find(hasDefinedTabId)
    if (mapTabInWindow) {
      await focusTab(mapTabInWindow)
      result = mapTabInWindow
    } else {
      const tabsAnywhere = await browser.tabs.query({ url: MAP_URL_PATTERN })
      const mapTabAnywhere = tabsAnywhere.find(hasDefinedTabId)
      if (mapTabAnywhere) {
        await focusTab(mapTabAnywhere)
        result = mapTabAnywhere
      } else {
        const created = await browser.tabs.create({ url: MAP_HOME, active: true })
        if (!created.id) {
          const t = await getBackgroundTranslator()
          const openMapFailedMessage = t('background.openMapFailed')
          throw new Error(openMapFailedMessage)
        }
        result = await waitForTabReady(created.id)
      }
    }
  }

  return result
}

const toggleInjectedSidebar = async (tabId: number, tabUrl?: string): Promise<void> => {
  let url = tabUrl
  if (!isMapTabUrl(url)) {
    const tab = await browser.tabs.get(tabId)
    url = tab.url
  }

  if (isMapTabUrl(url)) {
    const toggled = await retrySendTogglePanel(tabId)
    if (!toggled) {
      await browser.scripting.executeScript({
        target: { tabId },
        files: [PANEL_SIDEBAR_SCRIPT],
      })

      const retried = await retrySendTogglePanel(tabId)
      if (!retried) {
        const t = await getBackgroundTranslator()
        const openPanelFailedMessage = t('background.openPanelFailed')
        throw new Error(openPanelFailedMessage)
      }
    }
  } else {
    const t = await getBackgroundTranslator()
    const openMapAndRetryMessage = t('background.openMapAndRetry')
    throw new Error(openMapAndRetryMessage)
  }
}

type AuthMessageResponse = {
  ok: boolean
  user: YandexUser | null
  avatarDataUrl: string | null
  error?: string
}

const handleYandexAuthSuccess = async (
  auth: AuthPayload | null,
  sendResponse: (response: AuthMessageResponse) => void,
  cancelError?: string,
): Promise<void> => {
  if (auth?.user) {
    const avatarDataUrl = await loadUserAvatarDataUrl(auth.user)
    sendResponse({
      ok: true,
      user: auth.user,
      avatarDataUrl,
    })
  } else {
    sendResponse({
      ok: false,
      user: null,
      avatarDataUrl: null,
      ...(cancelError && { error: cancelError }),
    })
  }
}

const handleYandexAuthFailure = async (
  error: unknown,
  sendResponse: (response: AuthMessageResponse) => void,
  logLabel: string,
): Promise<void> => {
  console.error(`[nmap_uploader] ${logLabel} failed:`, error)
  const t = await getBackgroundTranslator()
  const authErrorFallback = t('auth.authError')
  const errorMessage = getErrorMessage(error, authErrorFallback)
  sendResponse({
    ok: false,
    user: null,
    avatarDataUrl: null,
    error: errorMessage,
  })
}

const processYandexAuthMessage = async ({
  interactive,
  sendResponse,
  logLabel,
  cancelError,
}: {
  interactive: boolean
  sendResponse: (response: AuthMessageResponse) => void
  logLabel: string
  cancelError?: string
}): Promise<void> => {
  try {
    const auth = await ensureYandexAuth({ interactive })
    const payload = await buildAuthPayload(auth)
    await handleYandexAuthSuccess(payload, sendResponse, cancelError)
  } catch (error: unknown) {
    await handleYandexAuthFailure(error, sendResponse, logLabel)
  }
}

const handleYandexAuthMessage = ({
  interactive,
  sendResponse,
  logLabel,
  cancelError,
}: {
  interactive: boolean
  sendResponse: (response: AuthMessageResponse) => void
  logLabel: string
  cancelError?: string
}): void => {
  const authTask = processYandexAuthMessage({ interactive, sendResponse, logLabel, cancelError })
  runBackgroundTask(authTask, logLabel)
}

const openInjectedPanel = async (tab: Browser.tabs.Tab): Promise<void> => {
  const t = await getBackgroundTranslator()
  const targetTab = await resolveMapTargetTab(tab)
  if (!targetTab.id) {
    const message = t('background.tabNotFound')
    throw new Error(message)
  }

  const isReady = isMapTabUrl(targetTab.url) && 'complete' === targetTab.status
  if (!isReady) {
    await waitForTabReady(targetTab.id)
  }

  const readyTab = await browser.tabs.get(targetTab.id)
  if (!readyTab.id) {
    const message = t('background.tabNotFound')
    throw new Error(message)
  }
  await toggleInjectedSidebar(readyTab.id, readyTab.url)
}

const resolveClickedTab = async (tab: Browser.tabs.Tab): Promise<Browser.tabs.Tab | undefined> => {
  let result: Browser.tabs.Tab | undefined
  if (tab.id) {
    result = tab
  } else {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
    result = activeTab
  }
  return result
}

const tryOpenNativeSidePanel = async (clickedTab: Browser.tabs.Tab): Promise<boolean> => {
  const useNative = await shouldUseNativeSidePanel()
  let openedNatively = false
  if (useNative && clickedTab.windowId) {
    const sidePanel = getSidePanelApi()
    try {
      if (sidePanel) {
        await sidePanel.setOptions({ path: PANEL_PAGE, enabled: true })
        await sidePanel.open({ windowId: clickedTab.windowId })
        openedNatively = true
      }
    } catch (error: unknown) {
      console.warn('[nmap_uploader] native sidePanel.open failed:', error)
    }
  }
  return openedNatively
}

const openPanel = async (tab: Browser.tabs.Tab): Promise<void> => {
  const clickedTab = await resolveClickedTab(tab)
  if (!clickedTab?.id) return

  const isYandex = await resolveIsYandexBrowser()
  if (isYandex) {
    await openInjectedPanel(clickedTab)
    return
  }

  const openedNatively = await tryOpenNativeSidePanel(clickedTab)
  if (!openedNatively) {
    await openInjectedPanel(clickedTab)
  }
}

const handleToolbarClick = (tab: Browser.tabs.Tab): void => {
  const panelTask = openPanel(tab)
  runBackgroundTask(panelTask, 'openPanel')
}

const configureInstalledSidePanel = async (): Promise<void> => {
  const useNative = await shouldUseNativeSidePanel()
  if (useNative) {
    const sidePanel = getSidePanelApi()
    try {
      await sidePanel?.setOptions({ path: PANEL_PAGE, enabled: true })
    } catch (error: unknown) {
      console.warn('[nmap_uploader] sidePanel.setOptions failed:', error)
    }
  }
}

const handleInstalled = (): void => {
  const persistTask = persistYandexBrowserFlag()
  runBackgroundTask(persistTask, 'persistYandexBrowserFlag')

  const registerTask = ensurePanelSidebarRegistered()
  runBackgroundTask(registerTask, 'ensurePanelSidebarRegistered')

  const configureTask = configureInstalledSidePanel()
  runBackgroundTask(configureTask, 'shouldUseNativeSidePanel')
}

// --- Message Handlers ---

type MessageHandler = (
  message: Record<string, unknown>,
  sender: RuntimeMessageSender,
  sendResponse: (response: any) => void,
) => boolean

const processGetAuth = async (
  sendResponse: (response: AuthPayload | { user: null; avatarDataUrl: null }) => void,
): Promise<void> => {
  try {
    const auth = await getStoredAuth()
    const payload = await buildAuthPayload(auth)
    sendResponse(payload)
  } catch {
    sendResponse({ user: null, avatarDataUrl: null })
  }
}

const processLogin = async (
  sendResponse: (response: AuthMessageResponse) => void,
): Promise<void> => {
  const t = await getBackgroundTranslator()
  const authCancelledMessage = t('auth.authCancelled')
  await processYandexAuthMessage({
    interactive: true,
    sendResponse,
    logLabel: 'login',
    cancelError: authCancelledMessage,
  })
}

const processLoginAccessDenied = async (
  sendResponse: (response: AuthMessageResponse) => void,
): Promise<void> => {
  const t = await getBackgroundTranslator()
  const accessDeniedMessage = t('common.accessDenied')
  sendResponse({
    ok: false,
    user: null,
    avatarDataUrl: null,
    error: accessDeniedMessage,
  })
}

const processLogout = async (sendResponse: (response: { ok: boolean }) => void): Promise<void> => {
  try {
    await clearAuth({ explicit: true })
    sendResponse({ ok: true })
  } catch (error: unknown) {
    console.error('[nmap_uploader] logout failed:', error)
    sendResponse({ ok: false })
  }
}

const processListOccupiedDates = async (
  sendResponse: (response: { ok: boolean; dates: string[]; error?: string }) => void,
): Promise<void> => {
  try {
    const auth = await getStoredAuth()
    if (auth) {
      const dates = await listExistingDateFolders({ token: auth.token })
      sendResponse({ ok: true, dates })
    } else {
      sendResponse({ ok: true, dates: [] })
    }
  } catch (error: unknown) {
    console.error('[nmap_uploader] listOccupiedDates failed:', error)
    const t = await getBackgroundTranslator()
    const folderReadErrorFallback = t('auth.folderReadError')
    sendResponse({
      ok: false,
      dates: [],
      error: getErrorMessage(error, folderReadErrorFallback),
    })
  }
}

const getUploadMessagePayload = (
  message: Record<string, unknown>,
): { files: ProcessedFileInput[]; targetDate?: string } => {
  let files: ProcessedFileInput[] = []
  if (Array.isArray(message.files)) {
    files = message.files as ProcessedFileInput[]
  }

  let targetDate: string | undefined
  if ('string' === typeof message.targetDate) {
    targetDate = message.targetDate
  }

  return { files, targetDate }
}

const processUpload = async (
  message: Record<string, unknown>,
  sendResponse: (response: UploadResult) => void,
): Promise<void> => {
  try {
    const { files, targetDate } = getUploadMessagePayload(message)
    const result = await uploadProcessedFilesToYandexDisk({ files, targetDate })
    sendResponse(result)
  } catch (error: unknown) {
    console.error('[nmap_uploader] upload failed:', error)
    const t = await getBackgroundTranslator()
    const uploadErrorFallback = t('auth.uploadError')
    sendResponse({
      ok: false,
      processedCount: 0,
      skippedCount: 0,
      logs: [
        {
          id: crypto.randomUUID(),
          level: 'error',
          message: getErrorMessage(error, uploadErrorFallback),
        },
      ],
    })
  }
}

const processUploadAccessDenied = async (
  sendResponse: (response: UploadResult) => void,
): Promise<void> => {
  const t = await getBackgroundTranslator()
  const accessDeniedMessage = t('common.accessDenied')
  sendResponse({
    ok: false,
    processedCount: 0,
    skippedCount: 0,
    logs: [
      {
        id: crypto.randomUUID(),
        level: 'error',
        message: accessDeniedMessage,
      },
    ],
  })
}

const processReloadEditor = async (
  sender: RuntimeMessageSender,
  sendResponse: (response: { ok: boolean }) => void,
): Promise<void> => {
  try {
    const ok = await reloadMapEditorTabs({ preferredTabId: sender.tab?.id })
    sendResponse({ ok })
  } catch (error: unknown) {
    console.warn('[nmap_uploader] reloadEditorPage failed:', error)
    sendResponse({ ok: false })
  }
}

const processRelayToMapTabs = async (
  sender: RuntimeMessageSender,
  relayMessage: Record<string, unknown>,
  sendResponse: (response: { ok: boolean }) => void,
  logLabel: string,
): Promise<void> => {
  try {
    await relayMessageToMapTabs(sender, relayMessage)
    sendResponse({ ok: true })
  } catch (error: unknown) {
    console.warn(`[nmap_uploader] ${logLabel} relay failed:`, error)
    sendResponse({ ok: false })
  }
}

const handleGetAuth: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const authTask = processGetAuth(sendResponse)
    runBackgroundTask(authTask, 'getAuth')
  } else {
    logRejectedMessage('getAuth', sender)
    sendResponse({ user: null, avatarDataUrl: null })
  }
  return true
}

const handleEnsureAuth: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    handleYandexAuthMessage({
      interactive: Boolean(message.interactive),
      sendResponse,
      logLabel: 'ensureAuth',
    })
  } else {
    logRejectedMessage('ensureAuth', sender)
    sendResponse({ ok: false, user: null, avatarDataUrl: null })
  }
  return true
}

const handleLogin: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const loginTask = processLogin(sendResponse)
    runBackgroundTask(loginTask, 'login')
  } else {
    logRejectedMessage('login', sender)
    const accessDeniedTask = processLoginAccessDenied(sendResponse)
    runBackgroundTask(accessDeniedTask, 'login')
  }
  return true
}

const handleLogout: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const logoutTask = processLogout(sendResponse)
    runBackgroundTask(logoutTask, 'logout')
  } else {
    logRejectedMessage('logout', sender)
    sendResponse({ ok: false })
  }
  return true
}

const handleListOccupiedDates: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const listDatesTask = processListOccupiedDates(sendResponse)
    runBackgroundTask(listDatesTask, 'listOccupiedDates')
  } else {
    logRejectedMessage('listOccupiedDates', sender)
    sendResponse({ ok: false, dates: [] })
  }
  return true
}

const handleUpload: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const uploadTask = processUpload(message, sendResponse)
    runBackgroundTask(uploadTask, 'uploadProcessedFiles')
  } else {
    logRejectedMessage('uploadProcessedFiles', sender)
    const accessDeniedTask = processUploadAccessDenied(sendResponse)
    runBackgroundTask(accessDeniedTask, 'uploadProcessedFiles')
  }
  return true
}

const handleReloadEditor: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const reloadTask = processReloadEditor(sender, sendResponse)
    runBackgroundTask(reloadTask, 'reloadEditorPage')
  } else {
    logRejectedMessage('reloadEditorPage', sender)
    sendResponse({ ok: false })
  }
  return true
}

const handleGoToRefresh: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const relayMessage = { action: GO_TO_REFRESH_ACTION }
    const relayTask = processRelayToMapTabs(sender, relayMessage, sendResponse, 'refreshGoToMenu')
    runBackgroundTask(relayTask, GO_TO_REFRESH_ACTION)
  } else {
    logRejectedMessage(GO_TO_REFRESH_ACTION, sender)
    sendResponse({ ok: false })
  }
  return true
}

const handleClosePanel: MessageHandler = (_message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const relayMessage = { action: CLOSE_PANEL_SIDEBAR_ACTION }
    const relayTask = processRelayToMapTabs(sender, relayMessage, sendResponse, 'closePanelSidebar')
    runBackgroundTask(relayTask, CLOSE_PANEL_SIDEBAR_ACTION)
  } else {
    logRejectedMessage(CLOSE_PANEL_SIDEBAR_ACTION, sender)
    sendResponse({ ok: false })
  }
  return true
}

const handleStartPointPicking: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const geomType = typeof message.geomType === 'string' ? message.geomType : 'Point'
    const relayMessage = { action: START_POINT_PICKING_ACTION, geomType }
    const relayTask = processRelayToMapTabs(sender, relayMessage, sendResponse, 'startPointPicking')
    runBackgroundTask(relayTask, START_POINT_PICKING_ACTION)
  } else {
    logRejectedMessage(START_POINT_PICKING_ACTION, sender)
    sendResponse({ ok: false })
  }
  return true
}

const handleApplyStrokeColor: MessageHandler = (message, sender, sendResponse) => {
  let color = ''
  if ('string' === typeof message.color) {
    color = message.color
  }
  const canRelay = color && isTrustedNmapsOrPanelSender(sender)

  if (canRelay) {
    const relayMessage = { action: 'applyStrokeColor', color }
    const relayTask = processRelayToMapTabs(sender, relayMessage, sendResponse, 'applyStrokeColor')
    runBackgroundTask(relayTask, 'applyStrokeColor')
  } else {
    if (color) {
      logRejectedMessage('applyStrokeColor', sender)
    }
    sendResponse({ ok: false })
  }
  return true
}

const handleCenterMap: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const relayMessage = {
      action: 'centerMap',
      latitude: message.latitude,
      longitude: message.longitude,
      zoom: message.zoom,
      bbox: message.bbox,
    }
    const relayTask = processRelayToMapTabs(sender, relayMessage, sendResponse, 'centerMap')
    runBackgroundTask(relayTask, 'centerMap')
  } else {
    logRejectedMessage('centerMap', sender)
    sendResponse({ ok: false })
  }
  return true
}

const handleGetTrackerDate: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedPanelSender(sender)) {
    const processGetTrackerDate = async () => {
      const targetTab = await resolveClickedTab(sender.tab)
      if (targetTab?.id) {
        try {
          const injection = await browser.scripting.executeScript({
            target: { tabId: targetTab.id },
            func: () => {
              // Ищем активный слой трекеров
              const el = document.querySelector(
                '.nk-map-layers-control-view__layer_id_tracker.nk-menu-item_checked',
              )
              if (el) {
                // Панель настроек трекеров (где лежит кнопка с датой) рендерится отдельно (вне пункта меню).
                // Поэтому ищем кнопку по всему документу.
                const btns = document.querySelectorAll('.nk-button__text')
                for (const btn of btns) {
                  const txt = btn.textContent?.trim() || ''
                  if (/\d{2}\.\d{2}\.\d{4}/.test(txt)) {
                    return txt
                  }
                }
              }
              return null
            },
          })
          const result = injection[0]?.result
          sendResponse({ date: result || null })
        } catch (error) {
          sendResponse({ date: null })
        }
      } else {
        sendResponse({ date: null })
      }
    }
    const task = processGetTrackerDate()
    runBackgroundTask(task, 'getTrackerDate')
  } else {
    logRejectedMessage('getTrackerDate', sender)
    sendResponse({ date: null })
  }
  return true
}

const handleDrawMapObjects: MessageHandler = (message, sender, sendResponse) => {
  if (isTrustedNmapsOrPanelSender(sender)) {
    const relayMessage = {
      action: 'DRAW_MAP_OBJECTS',
      points: message.points,
    }
    const relayTask = processRelayToMapTabs(sender, relayMessage, sendResponse, 'DRAW_MAP_OBJECTS')
    runBackgroundTask(relayTask, 'DRAW_MAP_OBJECTS')
  } else {
    logRejectedMessage('DRAW_MAP_OBJECTS', sender)
    sendResponse({ ok: false })
  }
  return true
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
  applyStrokeColor: handleApplyStrokeColor,
  centerMap: handleCenterMap,
  getTrackerDate: handleGetTrackerDate,
  DRAW_MAP_OBJECTS: handleDrawMapObjects,
}

const onMessageHandler = (
  message: any,
  sender: RuntimeMessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined => {
  const action = message?.action as string | undefined
  let handler: MessageHandler | undefined
  if (action) {
    handler = messageHandlers[action]
  }

  let result: boolean | undefined
  if (handler) {
    result = handler(message, sender, sendResponse)
  }
  return result
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
export default defineBackground(initBackground)
