/**
 * Вспомогательные утилиты управления вкладками для background сервисов.
 */
import { type Browser, browser } from 'wxt/browser'
import { createTranslator, syncLocaleFromStorage } from '@/lib/i18n'
import { isMapTabUrl, MAP_ORIGIN, MAP_TAB_URL_PATTERN } from '@/lib/map_tab'

export const MAP_HOME = `${MAP_ORIGIN}/` as const
export const MAP_URL_PATTERN = MAP_TAB_URL_PATTERN

export const sleep = (ms: number): Promise<void> => {
  const resolveAfterDelay = (resolve: () => void) => {
    setTimeout(resolve, ms)
  }
  return new Promise<void>(resolveAfterDelay)
}

export const waitForTabReady = async (tabId: number, maxMs = 15_000): Promise<Browser.tabs.Tab> => {
  const started = Date.now()
  const locale = await syncLocaleFromStorage()
  const t = createTranslator(locale)

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

export const focusTab = async (tab: Browser.tabs.Tab): Promise<void> => {
  if (tab.id) {
    await browser.tabs.update(tab.id, { active: true })
    if (tab.windowId) {
      await browser.windows.update(tab.windowId, { focused: true })
    }
  }
}

export const hasDefinedTabId = (tab: Browser.tabs.Tab): boolean => tab.id !== undefined

export const resolveMapTargetTab = async (
  clickedTab: Browser.tabs.Tab,
): Promise<Browser.tabs.Tab> => {
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
          const locale = await syncLocaleFromStorage()
          const t = createTranslator(locale)
          const openMapFailedMessage = t('background.openMapFailed')
          throw new Error(openMapFailedMessage)
        }
        result = await waitForTabReady(created.id)
      }
    }
  }

  return result
}

export const resolveClickedTab = async (
  tab?: { id?: number; [key: string]: unknown } | Browser.tabs.Tab,
): Promise<Browser.tabs.Tab | undefined> => {
  let result: Browser.tabs.Tab | undefined
  if (tab?.id) {
    result = tab as Browser.tabs.Tab
  } else {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
    result = activeTab
  }
  return result
}
