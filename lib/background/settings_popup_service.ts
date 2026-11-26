/**
 * Открытие панели расширения на вкладке редактора.
 *
 * Нативной боковой панели браузера у нас больше нет: она была вторым видом
 * того же интерфейса настроек, а пользователь просил ровно один — попап в
 * шапке редактора. Здесь остаётся выбор целевой вкладки и её ожидание.
 */
import { type Browser, browser } from 'wxt/browser'
import { isYandexBrowser } from '@/lib/browser'
import { createTranslator, getBackgroundLocale } from '@/lib/i18n'
import { isMapTabUrl } from '@/lib/map_tab'
import { toggleSettingsPopup } from './settings_popup_injector'
import { resolveClickedTab, resolveMapTargetTab, waitForTabReady } from './tab_navigation'

export * from './settings_popup_injector'
export * from './tab_navigation'

/** Отметка «это Яндекс Браузер» для зависимостей, которые её читают. */
export const persistYandexBrowserFlag = async (): Promise<void> => {
  if (isYandexBrowser()) {
    await browser.storage.local.set({ is_yandex_browser: true })
  }
}

type ToolbarActionApi = {
  onClicked: {
    addListener: (callback: (tab: Browser.tabs.Tab) => void) => void
  }
}

export const getToolbarActionApi = (): ToolbarActionApi | undefined => {
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

/**
 * Клик по иконке расширения: попап на вкладке редактора.
 *
 * Если вкладка редактора не открыта, `resolveMapTargetTab` её создаёт, а при
 * неудаче открытие падает с понятной ошибкой — ровно как было у сайдбара.
 */
export const openSettingsPopup = async (tab: Browser.tabs.Tab): Promise<void> => {
  const clickedTab = await resolveClickedTab(tab)
  if (!clickedTab?.id) return

  const t = createTranslator(getBackgroundLocale())

  const targetTab = await resolveMapTargetTab(clickedTab)
  if (!targetTab.id) {
    throw new Error(t('background.tabNotFound'))
  }

  const isReady = isMapTabUrl(targetTab.url) && 'complete' === targetTab.status
  if (!isReady) {
    await waitForTabReady(targetTab.id)
  }

  const readyTab = await browser.tabs.get(targetTab.id)
  if (!readyTab.id) {
    throw new Error(t('background.tabNotFound'))
  }
  await toggleSettingsPopup(readyTab.id, readyTab.url)
}
