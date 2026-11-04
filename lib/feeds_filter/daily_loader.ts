import { hasCardOlderThanPeriod } from './card_scanner'
import { waitForNewCards } from './card_waiter'
import { findEventCards as getEventCards } from './page_adapter'
import { hasFeedScrollTarget, triggerFeedScrollLoad } from './scroll_scanner'

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
  /**
   * Временно раскрывает карточки, скрытые фильтром, когда прокручивать нечего.
   * Возвращает функцию восстановления прежнего вида ленты.
   */
  revealHiddenCards?: () => (() => void) | undefined
}

export interface FeedDailyLoaderController {
  loadUpToDays: (days: number) => Promise<boolean>
  stopLoading: () => void
  getLoadedDaysCount: () => number
  getTargetDays: () => number
  isLoading: () => boolean
  teardown: () => void
}

/** Один цикл подгрузки. Идентичность цикла отделяет актуальные колбэки от устаревших. */
type ActiveLoad = {
  abort: AbortController
}

/**
 * Создает контроллер автоматической загрузки событий ленты за заданный период в днях.
 *
 * Новый вызов `loadUpToDays` вытесняет текущую загрузку: старый цикл отменяется,
 * а его колбэки не доходят до UI. Флаг «вся история загружена» не запоминается —
 * каждый клик по периоду делает новую попытку.
 */
export const createFeedDailyLoader = (
  feedContainer: HTMLElement,
  options?: FeedDailyLoaderOptions,
): FeedDailyLoaderController => {
  const openedTimestamp = Date.now()
  let loadedDaysCount = 1
  let currentTargetDays = options?.initialDays ?? 1
  let isTeardown = false
  let activeLoad: ActiveLoad | null = null

  /** Устарел ли цикл: загрузчик снят или его вытеснил более новый вызов. */
  const isStale = (load: ActiveLoad): boolean => isTeardown || activeLoad !== load

  const emitProgress = (isFinished: boolean): void => {
    options?.onProgress?.({
      loadedCardsCount: getEventCards(feedContainer).length,
      targetDays: currentTargetDays,
      isFinished,
    })
  }

  const stopLoading = (): void => {
    const load = activeLoad
    if (!load) {
      return
    }

    // Сбрасываем активный цикл до abort: его `finally` увидит расхождение и не тронет UI.
    activeLoad = null
    load.abort.abort()
    emitProgress(true)
    options?.onStateChange?.(false)
  }

  const loadUpToDays = async (targetDays: number): Promise<boolean> => {
    if (isTeardown) {
      return false
    }

    currentTargetDays = targetDays

    const previousLoad = activeLoad
    const load: ActiveLoad = { abort: new AbortController() }
    activeLoad = load
    previousLoad?.abort.abort()

    const signal = load.abort.signal
    const maxSteps = options?.maxStepsPerDay ?? 60
    const stepDelayMs = options?.stepDelayMs ?? 200

    options?.onStateChange?.(true)
    // Сразу показываем прогресс и «Остановить», не дожидаясь первого шага прокрутки.
    emitProgress(false)

    try {
      let currentStep = 0
      let consecutiveStalls = 0
      const maxStalls = 3

      /**
       * Прокручивает ленту для дозагрузки.
       *
       * Если прокручивать нечего (фильтр скрыл карточки и контейнер схлопнулся),
       * временно раскрывает их; возвращённая функция восстанавливает вид.
       */
      const scrollFeed = (): (() => void) | undefined => {
        const restore = hasFeedScrollTarget(feedContainer)
          ? undefined
          : options?.revealHiddenCards?.()
        triggerFeedScrollLoad(feedContainer)
        return restore
      }

      while (currentStep < maxSteps && !isStale(load)) {
        const cards = getEventCards(feedContainer)

        if (cards.length === 0) {
          const restore = scrollFeed()
          const newCount = await waitForNewCards(feedContainer, 0, 2500, signal)
          restore?.()
          if (isStale(load)) {
            break
          }

          if (newCount === 0) {
            consecutiveStalls += 1
            if (consecutiveStalls >= maxStalls) {
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
        emitProgress(false)

        const prevCardCount = cards.length
        const restore = scrollFeed()

        const nextCardCount = await waitForNewCards(feedContainer, prevCardCount, 3500, signal)
        restore?.()
        if (isStale(load)) {
          break
        }

        if (nextCardCount <= prevCardCount) {
          consecutiveStalls += 1
          scrollFeed()?.()

          if (consecutiveStalls >= maxStalls) {
            break
          }
        } else {
          consecutiveStalls = 0
        }

        if (stepDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, stepDelayMs))
        }
      }

      // Вытесненный или остановленный цикл не отчитывается о завершении за новый.
      if (isStale(load)) {
        return false
      }

      loadedDaysCount = Math.max(loadedDaysCount, currentTargetDays)
      emitProgress(true)
      return true
    } finally {
      if (activeLoad === load) {
        activeLoad = null
        options?.onStateChange?.(false)
      }
    }
  }

  // Запуск загрузки первого периода только при явном флаге autoStart (по умолчанию выключен)
  if (options?.autoStart) {
    void loadUpToDays(currentTargetDays)
  }

  const teardown = (): void => {
    isTeardown = true
    const load = activeLoad
    activeLoad = null
    load?.abort.abort()
  }

  return {
    loadUpToDays,
    stopLoading,
    getLoadedDaysCount: () => loadedDaysCount,
    getTargetDays: () => currentTargetDays,
    isLoading: () => activeLoad !== null,
    teardown,
  }
}
