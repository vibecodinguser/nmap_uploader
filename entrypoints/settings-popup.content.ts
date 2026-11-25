import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { observeNativeLocale, readNativeLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/locale.types'
import {
  ensureSettingsButton,
  repairSettingsButtonIcon,
  syncSettingsButtonPressed,
} from '@/lib/settings_popup/button'
import {
  createSettingsPopupHost,
  ensureSettingsPopupStyles,
  type SettingsPopupHost,
} from '@/lib/settings_popup/host'
import {
  CLOSE_SETTINGS_POPUP_ACTION,
  OPEN_SETTINGS_POPUP_ACTION,
  SETTINGS_BUTTON_ID,
  SETTINGS_POPUP_FOCUS_NSPD,
  SETTINGS_POPUP_ID,
  TOGGLE_SETTINGS_POPUP_ACTION,
} from '@/lib/settings_popup/protocol'

/** Кнопка живёт в шапке редактора и может исчезнуть при её перерисовке. */
const BUTTON_SYNC_INTERVAL_MS = 1000
/**
 * Быстрый период до первой удачной вставки: `document_idle` опережает
 * отрисовку React-дерева редактора, и в первые сотни миллисекунд шапки в DOM
 * ещё нет. Ждать полную секунду ради появления одной кнопки незачем.
 */
const BUTTON_SYNC_FAST_INTERVAL_MS = 100

/**
 * Вход в настройки: кнопка в шапке редактора и попап под ней.
 *
 * Настройки — отдельная страница расширения в iframe: стили редактора не
 * протекают внутрь, а наши — наружу. Content script владеет только кнопкой и
 * геометрией попапа; содержимое живёт внутри iframe.
 */
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    let locale: Locale = readNativeLocale()
    let host: SettingsPopupHost

    const syncButton = (): void => {
      // Стили нужны кнопке (отступ от соседней), а не только попапу: head
      // страницы может появиться позже старта скрипта.
      ensureSettingsPopupStyles()
      const button = ensureSettingsButton({
        locale,
        onClick: () => {
          host.toggle()
        },
      })
      if (button) {
        repairSettingsButtonIcon()
      }
    }

    host = createSettingsPopupHost({
      pagePath: '/panel.html',
      locale,
      onVisibilityChange: (open) => {
        syncSettingsButtonPressed(open)
      },
    })

    /**
     * Язык попапа берётся один раз при создании: iframe не пересоздаётся при
     * смене языка, а кнопку и заголовок переводим на месте. Источник — язык
     * редактора (ADR 0021), а не пользовательская настройка.
     */
    const refreshLocale = (next: Locale): void => {
      locale = next
      syncButton()
    }

    const stopLocaleObserver = observeNativeLocale(refreshLocale)

    const handleRuntimeMessage = (message: Record<string, unknown>): void => {
      switch (message.action) {
        case TOGGLE_SETTINGS_POPUP_ACTION:
          host.toggle()
          break
        case OPEN_SETTINGS_POPUP_ACTION:
          // Открыть, даже если попап уже открыт: не переключать на закрытие.
          // `open` сам подсветит строку НСПД, если попап уже был открыт.
          host.open({ focusNspd: message.focus === SETTINGS_POPUP_FOCUS_NSPD })
          break
        case CLOSE_SETTINGS_POPUP_ACTION:
          host.close()
          break
        default:
          break
      }
    }
    browser.runtime.onMessage.addListener(handleRuntimeMessage)

    // Кнопка до-вставляется, если шапка отрисовалась позже скрипта или была
    // перерисована React-деревом редактора. До первой удачной вставки частый
    // таймер, после — редкий: дальше он только чинит выбитую кнопку.
    syncButton()
    let buttonSyncInterval = BUTTON_SYNC_FAST_INTERVAL_MS
    let buttonSyncTimer = window.setInterval(tickButtonSync, buttonSyncInterval)

    function tickButtonSync(): void {
      syncButton()
      if (buttonSyncInterval === BUTTON_SYNC_INTERVAL_MS) {
        return
      }
      if (!document.getElementById(SETTINGS_BUTTON_ID)) {
        return
      }
      // Первая удачная вставка: переключаемся на редкий период.
      window.clearInterval(buttonSyncTimer)
      buttonSyncInterval = BUTTON_SYNC_INTERVAL_MS
      buttonSyncTimer = window.setInterval(tickButtonSync, buttonSyncInterval)
    }

    ctx.onInvalidated(() => {
      window.clearInterval(buttonSyncTimer)
      stopLocaleObserver()
      browser.runtime.onMessage.removeListener(handleRuntimeMessage)
      host.destroy()
      document.getElementById(SETTINGS_BUTTON_ID)?.remove()
      document.getElementById(SETTINGS_POPUP_ID)?.remove()
    })
  },
})
