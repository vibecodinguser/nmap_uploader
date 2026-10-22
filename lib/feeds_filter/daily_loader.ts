import { getLastCardWithDate, getLastCardWithDayAge, getTargetThresholdMs } from './card_scanner'
import { waitForNewCards } from './card_waiter'
import { findEventCards as getEventCards } from './page_adapter'
import { findFeedScrollableContainer, triggerFeedScrollLoad } from './scroll_scanner'

export * from './card_scanner'
export * from './card_waiter'
export * from './scroll_scanner'

export interface FeedDailyLoaderOptions {
  maxStepsPerDay?: number
  stepDelayMs?: number
  onProgress?: (loadedCount: number, targetDays: number) => void
}

export interface FeedDailyLoaderController {
  loadUpToDays: (days: number) => Promise<boolean>
  getLoadedDaysCount: () => number
  isLoading: () => boolean
  teardown: () => void
}

/**
 * Создает контроллер автоматической загрузки событий ленты за сутки.
 */
export const createFeedDailyLoader = (
  feedContainer: HTMLElement,
  options?: FeedDailyLoaderOptions,
): FeedDailyLoaderController => {
  const openedTimestamp = Date.now()
  let loadedDaysCount = 1
  let isCurrentlyLoading = false
  let isAllHistoryLoaded = false
  let isTeardown = false

  const scrollContainer = findFeedScrollableContainer(feedContainer)

  const loadUpToDays = async (targetDays: number): Promise<boolean> => {
    if (isCurrentlyLoading || isAllHistoryLoaded || isTeardown) {
      return false
    }

    isCurrentlyLoading = true
    const maxSteps = options?.maxStepsPerDay ?? 60
    const stepDelayMs = options?.stepDelayMs ?? 200
    const targetThresholdMs = getTargetThresholdMs(targetDays, openedTimestamp)

    try {
      let currentStep = 0
      let consecutiveStalls = 0
      const maxStalls = 3

      while (currentStep < maxSteps && !isTeardown) {
        const cards = getEventCards(feedContainer)
        if (cards.length === 0) {
          triggerFeedScrollLoad(feedContainer)
          const newCount = await waitForNewCards(feedContainer, 0, 2500)
          if (newCount === 0) {
            consecutiveStalls += 1
            if (consecutiveStalls >= maxStalls) {
              isAllHistoryLoaded = true
              break
            }
          } else {
            consecutiveStalls = 0
          }
          continue
        }

        // 1. Приоритетная проверка по дням Народной карты (nk-date-time nk-date-time_mode_relative)
        const lastDayInfo = getLastCardWithDayAge(cards, openedTimestamp)
        if (lastDayInfo && lastDayInfo.dayAge >= targetDays) {
          break
        }

        // 2. Резервная проверка по миллисекундам даты
        const lastDateInfo = getLastCardWithDate(cards, openedTimestamp)
        if (lastDateInfo && lastDateInfo.date.getTime() < targetThresholdMs) {
          break
        }

        currentStep += 1
        options?.onProgress?.(cards.length, targetDays)

        const prevCardCount = cards.length
        triggerFeedScrollLoad(feedContainer)

        const nextCardCount = await waitForNewCards(feedContainer, prevCardCount, 3500)
        if (nextCardCount <= prevCardCount) {
          consecutiveStalls += 1
          triggerFeedScrollLoad(feedContainer)

          if (consecutiveStalls >= maxStalls) {
            if (lastDayInfo && lastDayInfo.dayAge >= targetDays) {
              break
            }
            if (lastDateInfo && lastDateInfo.date.getTime() < targetThresholdMs) {
              break
            }
            break
          }
        } else {
          consecutiveStalls = 0
        }

        if (stepDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, stepDelayMs))
        }
      }

      loadedDaysCount = Math.max(loadedDaysCount, targetDays)
      return true
    } finally {
      isCurrentlyLoading = false
    }
  }

  const handleScroll = (): void => {
    if (isCurrentlyLoading || isAllHistoryLoaded || isTeardown) {
      return
    }

    const isNearBottom =
      scrollContainer.scrollTop + scrollContainer.clientHeight >=
        scrollContainer.scrollHeight - 250 ||
      feedContainer.scrollTop + feedContainer.clientHeight >= feedContainer.scrollHeight - 250

    if (isNearBottom) {
      const nextDays = loadedDaysCount + 1
      void loadUpToDays(nextDays)
    }
  }

  feedContainer.addEventListener('scroll', handleScroll, { capture: true, passive: true })
  scrollContainer.addEventListener('scroll', handleScroll, { passive: true })

  // Инициализация: загрузка правок за первые сутки при открытии ленты
  void loadUpToDays(1)

  const teardown = (): void => {
    isTeardown = true
    feedContainer.removeEventListener('scroll', handleScroll, { capture: true })
    scrollContainer.removeEventListener('scroll', handleScroll)
  }

  return {
    loadUpToDays,
    getLoadedDaysCount: () => loadedDaysCount,
    isLoading: () => isCurrentlyLoading,
    teardown,
  }
}
