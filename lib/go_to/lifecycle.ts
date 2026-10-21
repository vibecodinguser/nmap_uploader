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
import { GO_TO_MENU_ENABLED_STORAGE_KEY, getStoredGoToMenuEnabled } from '@/lib/go_to_settings'
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
import { type GoToLifecycleOptions, hasGoToRefreshStorageChange } from './lifecycle_contracts'

export * from './lifecycle_contracts'

export class GoToToolbarLifecycleManager {
  private contentLocale: Locale = 'ru'
  private contentTranslator: TranslateFn = createTranslator(this.contentLocale)
  private waitForAnchorCleanup?: () => void
  private cleanupThemeObserver?: () => void
  private refreshPromise?: Promise<void>
  private isRefreshScheduled = false
  public readonly controller: GoToToolbarController

  constructor(private readonly options?: GoToLifecycleOptions) {
    this.controller = new GoToToolbarController(
      () => this.contentTranslator,
      () => this.contentLocale,
      () => showGoToMenu(),
      () => hideGoToMenu(),
      () => {},
    )
  }

  public async start(): Promise<void> {
    ensureGoToStyles()
    this.cleanupThemeObserver = observeGoToTheme()
    await this.refreshContentLocale()

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pageshow', this.handlePageShow)
    }

    if (this.options?.storage) {
      this.options.storage.onChanged.addListener(this.handleStorageChange)
    }
    if (this.options?.runtime) {
      this.options.runtime.onMessage.addListener(this.handleRuntimeMessage)
    }

    await this.runRefresh()
  }

  public stop(): void {
    try {
      this.cleanupThemeObserver?.()
    } catch {}

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pageshow', this.handlePageShow)
    }

    if (this.options?.storage) {
      this.options.storage.onChanged.removeListener(this.handleStorageChange)
    }
    if (this.options?.runtime) {
      this.options.runtime.onMessage.removeListener(this.handleRuntimeMessage)
    }

    this.waitForAnchorCleanup?.()
    this.controller.removeButtonAndMenu()
  }

  public async refreshContentLocale(): Promise<void> {
    this.contentLocale = await getStoredLocale()
    this.contentTranslator = createTranslator(this.contentLocale)

    const splitButton = getSplitButton()
    if (splitButton) {
      splitButton.setAttribute('aria-label', this.contentTranslator('map.splitView'))
    }
    const uploadButton = getPolygonUploadButton()
    if (uploadButton) {
      uploadButton.setAttribute('aria-label', this.contentTranslator('map.uploadPolygons'))
    }
    const notesButton = getNotesButton()
    if (notesButton) {
      notesButton.setAttribute('aria-label', this.contentTranslator('map.notes'))
    }
  }

  public mountToolbarAtAnchor(
    menuEnabled: boolean,
    splitButtonEnabled: boolean,
    notesButtonEnabled: boolean,
  ): void {
    const anchor = resolveAnchor()
    if (anchor) {
      this.controller.mountToolbar(anchor, menuEnabled, splitButtonEnabled, notesButtonEnabled)
    }
  }

  public waitForAnchorAndMount(): void {
    this.waitForAnchorCleanup?.()
    this.waitForAnchorCleanup = runWhenAnyElementExists(BUTTON_ANCHOR_SELECTORS, (anchor) => {
      void loadGoToToolbarSettings().then(([menuEnabled, splitEnabled, notesEnabled]) => {
        this.controller.mountToolbar(anchor, menuEnabled, splitEnabled, notesEnabled)
      })
    })
  }

  public async applyEnabledState(
    menuEnabled: boolean,
    splitButtonEnabled: boolean,
    notesButtonEnabled: boolean,
  ): Promise<void> {
    const anchor = resolveAnchor()
    if (anchor) {
      this.controller.mountToolbar(anchor, menuEnabled, splitButtonEnabled, notesButtonEnabled)
    } else {
      this.waitForAnchorAndMount()
    }
  }

  public refreshGoToEnabledState = async (): Promise<void> => {
    const [enabled, splitButtonEnabled, notesButtonEnabled] = await loadGoToToolbarSettings()
    await this.applyEnabledState(enabled, splitButtonEnabled, notesButtonEnabled)
  }

  public scheduleRefresh = (): void => {
    this.isRefreshScheduled = true
    void this.runRefresh()
  }

  public runRefresh = async (): Promise<void> => {
    if (this.refreshPromise) {
      this.isRefreshScheduled = true
      await this.refreshPromise
      if (!this.isRefreshScheduled) return
    }

    this.isRefreshScheduled = false
    this.refreshPromise = this.refreshGoToEnabledState()

    try {
      await this.refreshPromise
    } finally {
      this.refreshPromise = undefined
      if (this.isRefreshScheduled) {
        void this.runRefresh()
      }
    }
  }

  private handlePageResume = (): void => {
    repairToolbarIcons()
    this.scheduleRefresh()
  }

  private handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.handlePageResume()
    }
  }

  private handlePageShow = (event: PageTransitionEvent): void => {
    if (event.persisted) {
      this.handlePageResume()
    }
  }

  private handleStorageChange = (
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
              this.mountToolbarAtAnchor(menuEnabled, true, notesEnabled)
            })
          })
        } else {
          this.controller.removeSplitButton()
        }
      }
    }

    if (NOTES_BUTTON_ENABLED_STORAGE_KEY in changes) {
      const next = changes[NOTES_BUTTON_ENABLED_STORAGE_KEY]?.newValue
      if (typeof next === 'boolean') {
        if (next) {
          this.controller.mountNotesButton()
          repairToolbarIcons()
        } else {
          this.controller.removeNotesButton()
        }
      }
    }

    if (LOCALE_STORAGE_KEY in changes) {
      void this.refreshContentLocale().then(() => this.scheduleRefresh())
    }

    if (GO_TO_MENU_ENABLED_STORAGE_KEY in changes) {
      const next = changes[GO_TO_MENU_ENABLED_STORAGE_KEY]?.newValue
      if (typeof next === 'boolean') {
        void Promise.all([getStoredSplitButtonEnabled(), getStoredNotesButtonEnabled()]).then(
          ([splitEnabled, notesEnabled]) => {
            this.mountToolbarAtAnchor(next, splitEnabled, notesEnabled)
          },
        )
      }
    }

    if (hasGoToRefreshStorageChange(changes)) {
      this.scheduleRefresh()
    }
  }

  private handleRuntimeMessage = (message: { action?: string }): void => {
    if (message?.action === GO_TO_REFRESH_ACTION) {
      void loadGoToToolbarSettings().then(([menuEnabled, splitEnabled, notesEnabled]) => {
        this.mountToolbarAtAnchor(menuEnabled, splitEnabled, notesEnabled)
      })
      this.scheduleRefresh()
    }
  }
}
