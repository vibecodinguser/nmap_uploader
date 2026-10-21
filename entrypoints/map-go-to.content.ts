import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import {
  BUTTON_ANCHOR_SELECTORS,
  GoToToolbarController,
  getNotesButton,
  getPolygonUploadButton,
  getSplitButton,
  hideGoToMenu,
  loadGoToToolbarSettings,
  repairToolbarIcons,
  resolveAnchor,
  showGoToMenu,
} from '@/lib/go_to'
import { runWhenAnyElementExists } from '@/lib/go_to_dom'
import { GO_TO_REFRESH_ACTION } from '@/lib/go_to_notify'
import {
  GO_TO_ITEMS_STORAGE_KEY,
  GO_TO_MENU_ENABLED_STORAGE_KEY,
  getStoredGoToMenuEnabled,
} from '@/lib/go_to_settings'
import {
  GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY,
  getStoredSplitButtonEnabled,
} from '@/lib/go_to_split_button'
import { ensureGoToStyles } from '@/lib/go_to_styles'
import { observeGoToTheme } from '@/lib/go_to_theme'
import { createTranslator, getStoredLocale, type TranslateFn } from '@/lib/i18n'
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale'
import type { Locale } from '@/lib/i18n/locale.types'
import { getStoredNotesButtonEnabled, NOTES_BUTTON_ENABLED_STORAGE_KEY } from '@/lib/notes_button'

let contentLocale: Locale = 'ru'
let contentTranslator: TranslateFn = createTranslator(contentLocale)
let waitForAnchorCleanup: (() => void) | undefined
let refreshPromise: Promise<void> | undefined
let isRefreshScheduled = false

const refreshContentLocale = async (): Promise<void> => {
  contentLocale = await getStoredLocale()
  contentTranslator = createTranslator(contentLocale)
  const splitButton = getSplitButton()
  if (splitButton) {
    splitButton.setAttribute('aria-label', contentTranslator('map.splitView'))
  }
  const uploadButton = getPolygonUploadButton()
  if (uploadButton) {
    uploadButton.setAttribute('aria-label', contentTranslator('map.uploadPolygons'))
  }
  const notesButton = getNotesButton()
  if (notesButton) {
    notesButton.setAttribute('aria-label', contentTranslator('map.notes'))
  }
}

const controller = new GoToToolbarController(
  () => contentTranslator,
  () => contentLocale,
  () => showGoToMenu(),
  () => hideGoToMenu(),
  (items) => {
    // Рендер элементов делегируется контроллеру
  },
)

const mountToolbarAtAnchor = (
  menuEnabled: boolean,
  splitButtonEnabled: boolean,
  notesButtonEnabled: boolean,
): void => {
  const anchor = resolveAnchor()
  if (anchor) {
    controller.mountToolbar(anchor, menuEnabled, splitButtonEnabled, notesButtonEnabled)
  }
}

const handleAnchorElementFound = (anchor: Element): void => {
  void loadGoToToolbarSettings().then(([menuEnabled, splitEnabled, notesEnabled]) => {
    controller.mountToolbar(anchor, menuEnabled, splitEnabled, notesEnabled)
  })
}

const waitForAnchorAndMount = (): void => {
  waitForAnchorCleanup?.()
  waitForAnchorCleanup = runWhenAnyElementExists(BUTTON_ANCHOR_SELECTORS, handleAnchorElementFound)
}

const applyEnabledState = async (
  menuEnabled: boolean,
  splitButtonEnabled: boolean,
  notesButtonEnabled: boolean,
): Promise<void> => {
  const anchor = resolveAnchor()
  if (anchor) {
    controller.mountToolbar(anchor, menuEnabled, splitButtonEnabled, notesButtonEnabled)
  } else {
    waitForAnchorAndMount()
  }
}

const refreshGoToEnabledState = async (): Promise<void> => {
  const [enabled, splitButtonEnabled, notesButtonEnabled] = await loadGoToToolbarSettings()
  await applyEnabledState(enabled, splitButtonEnabled, notesButtonEnabled)
}

const hasGoToRefreshStorageChange = (changes: Record<string, { newValue?: unknown }>): boolean =>
  GO_TO_MENU_ENABLED_STORAGE_KEY in changes ||
  GO_TO_ITEMS_STORAGE_KEY in changes ||
  GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY in changes ||
  NOTES_BUTTON_ENABLED_STORAGE_KEY in changes

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    ensureGoToStyles()
    const cleanupThemeObserver = observeGoToTheme()
    void refreshContentLocale()

    const runRefresh = async (): Promise<void> => {
      if (refreshPromise) {
        isRefreshScheduled = true
        await refreshPromise
        if (!isRefreshScheduled) return
      }

      isRefreshScheduled = false
      refreshPromise = refreshGoToEnabledState()

      try {
        await refreshPromise
      } finally {
        refreshPromise = undefined
        if (isRefreshScheduled) {
          void runRefresh()
        }
      }
    }

    void runRefresh()

    const scheduleRefresh = (): void => {
      isRefreshScheduled = true
      void runRefresh()
    }

    const handlePageResume = (): void => {
      repairToolbarIcons()
      scheduleRefresh()
    }

    const handleVisibilityChange = (): void => {
      if ('visible' === document.visibilityState) {
        handlePageResume()
      }
    }

    const handlePageShow = (event: PageTransitionEvent): void => {
      if (event.persisted) {
        handlePageResume()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pageshow', handlePageShow)

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ): void => {
      if (area !== 'local') return

      if (GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY in changes) {
        const next = changes[GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]?.newValue
        if (typeof next === 'boolean') {
          if (next) {
            void getStoredGoToMenuEnabled().then((menuEnabled) => {
              void getStoredNotesButtonEnabled().then((notesEnabled: boolean) => {
                mountToolbarAtAnchor(menuEnabled, true, notesEnabled)
              })
            })
          } else {
            controller.removeSplitButton()
          }
        }
      }

      if (NOTES_BUTTON_ENABLED_STORAGE_KEY in changes) {
        const next = changes[NOTES_BUTTON_ENABLED_STORAGE_KEY]?.newValue
        if (typeof next === 'boolean') {
          if (next) {
            controller.mountNotesButton()
            repairToolbarIcons()
          } else {
            controller.removeNotesButton()
          }
        }
      }

      if (LOCALE_STORAGE_KEY in changes) {
        void refreshContentLocale().then(() => scheduleRefresh())
      }

      if (GO_TO_MENU_ENABLED_STORAGE_KEY in changes) {
        const next = changes[GO_TO_MENU_ENABLED_STORAGE_KEY]?.newValue
        if (typeof next === 'boolean') {
          void Promise.all([getStoredSplitButtonEnabled(), getStoredNotesButtonEnabled()]).then(
            ([splitEnabled, notesEnabled]) => {
              mountToolbarAtAnchor(next, splitEnabled, notesEnabled)
            },
          )
        }
      }

      if (hasGoToRefreshStorageChange(changes)) {
        scheduleRefresh()
      }
    }

    const handleRuntimeMessage = (message: { action?: string }): void => {
      if (message?.action === GO_TO_REFRESH_ACTION) {
        void loadGoToToolbarSettings().then(([menuEnabled, splitEnabled, notesEnabled]) => {
          mountToolbarAtAnchor(menuEnabled, splitEnabled, notesEnabled)
        })
        scheduleRefresh()
      }
    }

    browser.storage.onChanged.addListener(handleStorageChange)
    browser.runtime.onMessage.addListener(handleRuntimeMessage)

    ctx.onInvalidated(() => {
      try {
        cleanupThemeObserver()
      } catch {
        // ignore
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handlePageShow)
      try {
        browser.storage.onChanged.removeListener(handleStorageChange)
        browser.runtime.onMessage.removeListener(handleRuntimeMessage)
      } catch {
        // ignore
      }
      waitForAnchorCleanup?.()
      controller.removeButtonAndMenu()
    })
  },
})
