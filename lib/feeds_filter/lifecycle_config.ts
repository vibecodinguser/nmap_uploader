export interface StorageChangeEmitter {
  onChanged: {
    addListener: (
      callback: (changes: Record<string, { newValue?: unknown }>, area: string) => void,
    ) => void
    removeListener: (
      callback: (changes: Record<string, { newValue?: unknown }>, area: string) => void,
    ) => void
  }
}

export interface FeedFilterLifecycleOptions {
  storage?: StorageChangeEmitter
}

export const STARTUP_RETRY_DELAYS_MS = [100, 250, 500, 800, 1200, 1800, 2500, 3500, 5000]
export const CLICK_RETRY_DELAYS_MS = [30, 100, 250, 500, 800, 1200]

export const isFeedTriggerClick = (target: HTMLElement | null): boolean => {
  if (!target) return false

  const isFeedTrigger = target.closest(
    '.nk-user-feeds-control-view, [class*="user-feeds-control"], [class*="feeds-control"], [class*="user-bar-view"] [class*="feed"], [class*="user-bar-view"] [class*="notification"], [data-name="feeds"], [aria-label*="лент" i], [aria-label*="истори" i], [title*="лент" i], [title*="истори" i]',
  )
  const isSelectOrMenu = target.closest(
    '.nk-select, .nk-menu, .nk-menu__item, .nk-popup, [role="menuitem"], [role="option"], [role="listbox"], button',
  )

  return Boolean(isFeedTrigger || isSelectOrMenu)
}
