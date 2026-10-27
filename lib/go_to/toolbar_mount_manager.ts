import {
  BUTTON_ANCHOR_SELECTORS,
  type GoToToolbarController,
  getNotesButton,
  getPolygonUploadButton,
  getSplitButton,
  loadGoToToolbarSettings,
  resolveAnchor,
} from '@/lib/go_to'
import { runWhenAnyElementExists } from '@/lib/go_to_dom'
import { createTranslator, getStoredLocale, type TranslateFn } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/locale.types'

export class GoToToolbarMountManager {
  private contentLocale: Locale = 'ru'
  private contentTranslator: TranslateFn = createTranslator(this.contentLocale)
  private waitForAnchorCleanup?: () => void

  constructor(private readonly controller: GoToToolbarController) {}

  public getTranslator(): TranslateFn {
    return this.contentTranslator
  }

  public getLocale(): Locale {
    return this.contentLocale
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
    nspdButtonEnabled: boolean,
  ): void {
    const anchor = resolveAnchor()
    if (anchor) {
      this.controller.mountToolbar(
        anchor,
        menuEnabled,
        splitButtonEnabled,
        notesButtonEnabled,
        nspdButtonEnabled,
      )
    }
  }

  public waitForAnchorAndMount(): void {
    this.waitForAnchorCleanup?.()
    this.waitForAnchorCleanup = runWhenAnyElementExists(BUTTON_ANCHOR_SELECTORS, (anchor) => {
      void loadGoToToolbarSettings().then(([menuEnabled, splitEnabled, notesEnabled, nspdEnabled]) => {
        this.controller.mountToolbar(anchor, menuEnabled, splitEnabled, notesEnabled, nspdEnabled)
      })
    })
  }

  public async applyEnabledState(
    menuEnabled: boolean,
    splitButtonEnabled: boolean,
    notesButtonEnabled: boolean,
    nspdButtonEnabled: boolean,
  ): Promise<void> {
    const anchor = resolveAnchor()
    if (anchor) {
      this.controller.mountToolbar(
        anchor,
        menuEnabled,
        splitButtonEnabled,
        notesButtonEnabled,
        nspdButtonEnabled,
      )
    } else {
      this.waitForAnchorAndMount()
    }
  }

  public cleanup(): void {
    this.waitForAnchorCleanup?.()
    this.waitForAnchorCleanup = undefined
  }
}
