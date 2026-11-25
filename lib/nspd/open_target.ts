import { browser } from 'wxt/browser'
import { OPEN_NSPD_TARGET_ACTION } from '@/lib/background/nspd_handlers'

/**
 * Открывает цель кнопки НСПД.
 *
 * Кнопка живёт в content script на карте, где нет ни `chrome.permissions`, ни
 * `chrome.tabs`. Поэтому решение принимает background: при выданном доступе к
 * `nspd.gov.ru` он открывает сайт, иначе — попап настроек с подсветкой строки
 * «Разрешить доступ». `tabs.create` из фона не блокируется popup-блокировщиком,
 * так что вызов можно делать без синхронного `window.open`.
 */
export const openNspdTarget = async (url: string): Promise<void> => {
  try {
    await browser.runtime.sendMessage({ action: OPEN_NSPD_TARGET_ACTION, url })
  } catch (error: unknown) {
    console.warn('[yamapper] openNspdTarget failed, falling back to direct open:', error)
    window.open(url, '_blank')
  }
}
