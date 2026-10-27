import { GoToToolbarController, loadGoToToolbarSettings, repairToolbarIcons } from '@/lib/go_to'
import {
  hideGoToMenu,
  openGoToLink,
  renderMenuItems,
  showGoToMenu,
} from '@/lib/go_to/menu_controller'
import { GO_TO_REFRESH_ACTION } from '@/lib/go_to_notify'
import { GO_TO_MENU_ENABLED_STORAGE_KEY, getStoredGoToMenuEnabled } from '@/lib/go_to_settings'
import {
  GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY,
  getStoredSplitButtonEnabled,
} from '@/lib/go_to_split_button'
import { ensureGoToStyles } from '@/lib/go_to_styles'
import { observeGoToTheme } from '@/lib/go_to_theme'
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale'
import { getStoredNotesButtonEnabled, NOTES_BUTTON_ENABLED_STORAGE_KEY } from '@/lib/notes_button'
import { NSPD_BUTTON_ENABLED_STORAGE_KEY } from '@/lib/nspd/nspd_button'
import { type GoToLifecycleOptions, hasGoToRefreshStorageChange } from './lifecycle_contracts'
import { attachPageVisibilityListeners } from './page_visibility_listeners'
import { GoToToolbarMountManager } from './toolbar_mount_manager'

export * from './lifecycle_contracts'
export * from './page_visibility_listeners'
export * from './toolbar_mount_manager'

export class GoToToolbarLifecycleManager {
  private cleanupThemeObserver?: () => void
  private cleanupVisibilityListeners?: () => void
  private refreshPromise?: Promise<void>
  private isRefreshScheduled = false
  public readonly controller: GoToToolbarController
  public readonly mountManager: GoToToolbarMountManager

  constructor(private readonly options?: GoToLifecycleOptions) {
    let mountMgr: GoToToolbarMountManager | undefined

    this.controller = new GoToToolbarController(
      () => mountMgr?.getTranslator() ?? ((key: string) => key),
      () => mountMgr?.getLocale() ?? 'ru',
      () => showGoToMenu(),
      () => hideGoToMenu(),
      (items) => {
        renderMenuItems(items, mountMgr?.getLocale() ?? 'ru', (sourceName, keepFocus) => {
          openGoToLink(sourceName, keepFocus, hideGoToMenu)
        })
      },
    )

    this.mountManager = new GoToToolbarMountManager(this.controller)
    mountMgr = this.mountManager
  }

  public async start(): Promise<void> {
    ensureGoToStyles()
    this.cleanupThemeObserver = observeGoToTheme()
    await this.mountManager.refreshContentLocale()

    this.cleanupVisibilityListeners = attachPageVisibilityListeners({
      onPageResume: this.scheduleRefresh,
    })

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

    if (this.cleanupVisibilityListeners) {
      this.cleanupVisibilityListeners()
      this.cleanupVisibilityListeners = undefined
    }

    if (this.options?.storage) {
      this.options.storage.onChanged.removeListener(this.handleStorageChange)
    }
    if (this.options?.runtime) {
      this.options.runtime.onMessage.removeListener(this.handleRuntimeMessage)
    }

    this.mountManager.cleanup()
    this.controller.removeButtonAndMenu()
  }

  public async refreshContentLocale(): Promise<void> {
    await this.mountManager.refreshContentLocale()
  }

  public mountToolbarAtAnchor(
    menuEnabled: boolean,
    splitButtonEnabled: boolean,
    notesButtonEnabled: boolean,
    nspdButtonEnabled: boolean,
  ): void {
    this.mountManager.mountToolbarAtAnchor(
      menuEnabled,
      splitButtonEnabled,
      notesButtonEnabled,
      nspdButtonEnabled,
    )
  }

  public waitForAnchorAndMount(): void {
    this.mountManager.waitForAnchorAndMount()
  }

  public async applyEnabledState(
    menuEnabled: boolean,
    splitButtonEnabled: boolean,
    notesButtonEnabled: boolean,
    nspdButtonEnabled: boolean,
  ): Promise<void> {
    await this.mountManager.applyEnabledState(
      menuEnabled,
      splitButtonEnabled,
      notesButtonEnabled,
      nspdButtonEnabled,
    )
  }

  public refreshGoToEnabledState = async (): Promise<void> => {
    const [enabled, splitButtonEnabled, notesButtonEnabled, nspdButtonEnabled] =
      await loadGoToToolbarSettings()
    await this.applyEnabledState(enabled, splitButtonEnabled, notesButtonEnabled, nspdButtonEnabled)
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

  private handleStorageChange = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ): void => {
    if (area !== 'local') return

    if (GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY in changes) {
      const next = changes[GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]?.newValue
      if (typeof next === 'boolean') {
        if (next) {
          void loadGoToToolbarSettings().then(([menuEnabled, , notesEnabled, nspdEnabled]) => {
            this.mountToolbarAtAnchor(menuEnabled, true, notesEnabled, nspdEnabled)
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

    if (NSPD_BUTTON_ENABLED_STORAGE_KEY in changes) {
      const next = changes[NSPD_BUTTON_ENABLED_STORAGE_KEY]?.newValue
      if (typeof next === 'boolean') {
        if (next) {
          this.controller.mountNspdButton()
          repairToolbarIcons()
        } else {
          this.controller.removeNspdButton()
        }
      }
    }

    if (LOCALE_STORAGE_KEY in changes) {
      void this.refreshContentLocale().then(() => this.scheduleRefresh())
    }

    if (GO_TO_MENU_ENABLED_STORAGE_KEY in changes) {
      const next = changes[GO_TO_MENU_ENABLED_STORAGE_KEY]?.newValue
      if (typeof next === 'boolean') {
        void loadGoToToolbarSettings().then(([, splitEnabled, notesEnabled, nspdEnabled]) => {
          this.mountToolbarAtAnchor(next, splitEnabled, notesEnabled, nspdEnabled)
        })
      }
    }

    if (hasGoToRefreshStorageChange(changes)) {
      this.scheduleRefresh()
    }
  }

  private handleRuntimeMessage = (message: { action?: string }): void => {
    if (message?.action === GO_TO_REFRESH_ACTION) {
      void loadGoToToolbarSettings().then(([menuEnabled, splitEnabled, notesEnabled, nspdEnabled]) => {
        this.mountToolbarAtAnchor(menuEnabled, splitEnabled, notesEnabled, nspdEnabled)
      })
      this.scheduleRefresh()
    }
  }
}
