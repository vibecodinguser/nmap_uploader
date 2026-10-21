/**
 * Логика определения и сохранения Яндекс Браузера.
 */
import { browser } from 'wxt/browser'
import { detectYandexBrowserInPageContext, isYandexBrowser } from '@/lib/browser'
import { MAP_TAB_URL_PATTERN } from '@/lib/map_tab'

export const persistYandexBrowserFlag = async (): Promise<void> => {
  const yandexBrowser = isYandexBrowser()
  if (yandexBrowser) {
    await browser.storage.local.set({ is_yandex_browser: true })
  }
}

export const readYandexUaFromTab = async (tabId: number): Promise<boolean> => {
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

export const checkTabsForYandexBrowser = async (): Promise<boolean> => {
  const mapTabs = await browser.tabs.query({ url: MAP_TAB_URL_PATTERN })
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

export const resolveIsYandexBrowser = async (): Promise<boolean> => {
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
