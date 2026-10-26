import { hasCardOlderThanPeriod } from './card_scanner'
import { waitForNewCards } from './card_waiter'
import { findEventCards as getEventCards } from './page_adapter'
import { triggerFeedScrollLoad } from './scroll_scanner'

export * from './card_scanner'
export * from './card_waiter'
export * from './scroll_scanner'

export interface FeedDailyLoaderProgress {
  loadedCardsCount: number
  targetDays: number
  isFinished: boolean
}

export interface FeedDailyLoaderOptions {
  maxStepsPerDay?: number
  stepDelayMs?: number
  initialDays?: number
  autoStart?: boolean
  onProgress?: (progress: FeedDailyLoaderProgress) => void
  onStateChange?: (isLoading: boolean) => void
}

export interface FeedDailyLoaderController {
  loadUpToDays: (days: number) => Promise<boolean>
  stopLoading: () => void
  getLoadedDaysCount: () => number
  getTargetDays: () => number
  isLoading: () => boolean
  teardown: () => void
}

/**
 * Создает контроллер автоматической загрузки событий ленты за заданный период в днях.
 */
export const createFeedDailyLoader = (
  feedContainer: HTMLElement,
  options?: FeedDailyLoaderOptions,
): FeedDailyLoaderController => {
  const openedTimestamp = Date.now()
  let loadedDaysCount = 1
  let currentTargetDays = options?.initialDays ?? 1
  let isCurrentlyLoading = false
  let isAllHistoryLoaded = false
  let isTeardown = false
  let isAbortRequested = false
  let abortController = new AbortController()

  const stopLoading = (): void => {
    isAbortRequested = true
    abortController.abort()
    abortController = new AbortController()
  }

  const loadUpToDays = async (targetDays: number): Promise<boolean> => {
    if (isTeardown || isAllHistoryLoaded) {
      return false
    }

    currentTargetDays = targetDays
    if (isCurrentlyLoading) {
      return true
    }

    isCurrentlyLoading = true
    isAbortRequested = false
    options?.onStateChange?.(true)

    const maxSteps = options?.maxStepsPerDay ?? 60
    const stepDelayMs = options?.stepDelayMs ?? 200

    try {
      let currentStep = 0
      let consecutiveStalls = 0
      const maxStalls = 3

      while (currentStep < maxSteps && !isTeardown && !isAbortRequested) {
        const cards = getEventCards(feedContainer)

        if (cards.length === 0) {
          triggerFeedScrollLoad(feedContainer)
          const newCount = await waitForNewCards(feedContainer, 0, 2500, abortController.signal)
          if (isTeardown || isAbortRequested) {
            break
          }

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

        // Приоритетная проверка границы календарного периода (1, 3 или 7 дней)
        if (hasCardOlderThanPeriod(cards, currentTargetDays, openedTimestamp)) {
          break
        }

        currentStep += 1
        options?.onProgress?.({
          loadedCardsCount: cards.length,
          targetDays: currentTargetDays,
          isFinished: false,
        })

        const prevCardCount = cards.length
        triggerFeedScrollLoad(feedContainer)

        const nextCardCount = await waitForNewCards(
          feedContainer,
          prevCardCount,
          3500,
          abortController.signal,
        )
        if (isTeardown || isAbortRequested) {
          break
        }

        if (nextCardCount <= prevCardCount) {
          consecutiveStalls += 1
          triggerFeedScrollLoad(feedContainer)

          if (consecutiveStalls >= maxStalls) {
            const currentCards = getEventCards(feedContainer)
            if (hasCardOlderThanPeriod(currentCards, currentTargetDays, openedTimestamp)) {
              break
            }
            isAllHistoryLoaded = true
            break
          }
        } else {
          consecutiveStalls = 0
        }

        if (stepDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, stepDelayMs))
        }
      }

      const finalCards = getEventCards(feedContainer)
      loadedDaysCount = Math.max(loadedDaysCount, currentTargetDays)
      options?.onProgress?.({
        loadedCardsCount: finalCards.length,
        targetDays: currentTargetDays,
        isFinished: true,
      })
      return true
    } finally {
      isCurrentlyLoading = false
      options?.onStateChange?.(false)
    }
  }

  // Запуск загрузки первого периода только при явном флаге autoStart (по умолчанию выключен)
  if (options?.autoStart) {
    void loadUpToDays(currentTargetDays)
  }

  const teardown = (): void => {
    isTeardown = true
    isAbortRequested = true
    abortController.abort()
  }

  return {
    loadUpToDays,
    stopLoading,
    getLoadedDaysCount: () => loadedDaysCount,
    getTargetDays: () => currentTargetDays,
    isLoading: () => isCurrentlyLoading,
    teardown,
  }
}
