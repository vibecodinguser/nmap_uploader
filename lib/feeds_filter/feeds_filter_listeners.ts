import { CLICK_RETRY_DELAYS_MS, isFeedTriggerClick } from './lifecycle_config'

export interface FeedFilterListenersOptions {
  isFeatureEnabled: () => boolean
  checkAndAttachFilter: () => void
  syncHeight: () => void
}

/**
 * Прикрепляет слушатели кликов по триггерам ленты и ресайза окна для синхронизации высоты селекта.
 */
export const attachFeedFilterDomListeners = ({
  isFeatureEnabled,
  checkAndAttachFilter,
  syncHeight,
}: FeedFilterListenersOptions): (() => void) => {
  const handleDocumentClick = (event: MouseEvent): void => {
    if (!isFeatureEnabled()) {
      return
    }

    const target = event.target as HTMLElement | null
    if (!isFeedTriggerClick(target)) {
      return
    }

    CLICK_RETRY_DELAYS_MS.forEach((delay) => {
      setTimeout(checkAndAttachFilter, delay)
    })
  }

  const handleWindowResize = (): void => {
    if (!isFeatureEnabled()) {
      return
    }
    syncHeight()
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', handleDocumentClick, true)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleWindowResize)
  }

  return () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', handleDocumentClick, true)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleWindowResize)
    }
  }
}
