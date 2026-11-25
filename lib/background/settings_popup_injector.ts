/**
 * Открытие попапа настроек на вкладке редактора.
 *
 * Попап — не сайдбар: он живёт в content script и открывается сообщением
 * `toggleSettingsPopup`. Если скрипт на вкладке ещё не запустился (вкладка
 * только что открылась), его надо доставить через `scripting.executeScript`.
 */
import { browser } from 'wxt/browser'
import { createTranslator, getBackgroundLocale } from '@/lib/i18n'
import { isMapTabUrl } from '@/lib/map_tab'
import {
  OPEN_SETTINGS_POPUP_ACTION,
  SETTINGS_POPUP_FOCUS_NSPD,
  TOGGLE_SETTINGS_POPUP_ACTION,
} from '@/lib/settings_popup/protocol'
import { sleep } from './tab_navigation'

export const SETTINGS_POPUP_SCRIPT = '/content-scripts/settings-popup.js' as const

export const sendToggleSettingsPopup = async (tabId: number): Promise<void> => {
  await browser.tabs.sendMessage(tabId, { action: TOGGLE_SETTINGS_POPUP_ACTION })
}

export const retrySendToggleSettingsPopup = async (tabId: number): Promise<boolean> => {
  let succeeded = false
  const maxAttempts = 8
  for (let attempt = 0; attempt < maxAttempts && !succeeded; attempt += 1) {
    try {
      await sendToggleSettingsPopup(tabId)
      succeeded = true
    } catch {
      const delay = 150 * (attempt + 1)
      await sleep(delay)
    }
  }
  return succeeded
}

export const toggleSettingsPopup = async (tabId: number, tabUrl?: string): Promise<void> => {
  let url = tabUrl
  if (!isMapTabUrl(url)) {
    const tab = await browser.tabs.get(tabId)
    url = tab.url
  }

  const t = createTranslator(getBackgroundLocale())

  if (!isMapTabUrl(url)) {
    throw new Error(t('background.openMapAndRetry'))
  }

  const toggled = await retrySendToggleSettingsPopup(tabId)
  if (toggled) {
    return
  }

  // Единственный случай, когда доставка нужна вручную: content script не
  // успел запуститься на только что открытой вкладке.
  await browser.scripting.executeScript({
    target: { tabId },
    files: [SETTINGS_POPUP_SCRIPT],
  })

  const retried = await retrySendToggleSettingsPopup(tabId)
  if (!retried) {
    throw new Error(t('background.openPanelFailed'))
  }
}

/**
 * Послать в вкладку команду открыть попап (не переключать на закрытие).
 *
 * `focusNspd` прокручивает попап к строке доступа к НСПД — нужно, когда
 * кнопку НСПД на карте нажали без выданного доступа.
 */
export const sendOpenSettingsPopup = async (tabId: number, focusNspd: boolean): Promise<void> => {
  await browser.tabs.sendMessage(tabId, {
    action: OPEN_SETTINGS_POPUP_ACTION,
    focus: focusNspd ? SETTINGS_POPUP_FOCUS_NSPD : undefined,
  })
}

const retrySendOpenSettingsPopup = async (tabId: number, focusNspd: boolean): Promise<boolean> => {
  let succeeded = false
  const maxAttempts = 8
  for (let attempt = 0; attempt < maxAttempts && !succeeded; attempt += 1) {
    try {
      await sendOpenSettingsPopup(tabId, focusNspd)
      succeeded = true
    } catch {
      const delay = 150 * (attempt + 1)
      await sleep(delay)
    }
  }
  return succeeded
}

/**
 * Открыть попап настроек на вкладке редактора, при необходимости подсветив
 * строку доступа к НСПД. Повторяет логику `toggleSettingsPopup`: если content
 * script ещё не запустился, доставляет его вручную и пытается снова.
 */
export const openSettingsPopupOnTab = async (
  tabId: number,
  tabUrl: string | undefined,
  focusNspd: boolean,
): Promise<void> => {
  let url = tabUrl
  const t = createTranslator(getBackgroundLocale())

  if (!isMapTabUrl(url)) {
    const tab = await browser.tabs.get(tabId)
    url = tab.url
  }

  if (!isMapTabUrl(url)) {
    throw new Error(t('background.openMapAndRetry'))
  }

  const opened = await retrySendOpenSettingsPopup(tabId, focusNspd)
  if (opened) {
    return
  }

  await browser.scripting.executeScript({
    target: { tabId },
    files: [SETTINGS_POPUP_SCRIPT],
  })

  const retried = await retrySendOpenSettingsPopup(tabId, focusNspd)
  if (!retried) {
    throw new Error(t('background.openPanelFailed'))
  }
}
