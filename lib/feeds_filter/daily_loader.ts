import { getEventCardDayAge, parseEventCardDate } from './date_parser'
import { findEventCards as getEventCards } from './page_adapter'

/**
 * Находит последнюю карточку с известной давностью в днях, сканируя список карточек с конца.
 */
export const getLastCardWithDayAge = (
  cards: HTMLElement[],
  referenceTimestamp = Date.now(),
): { card: HTMLElement; dayAge: number } | null => {
  for (let i = cards.length - 1; i >= 0; i--) {
    const card = cards[i]
    if (
      card.classList.contains('nk-event-view_skeleton') ||
      card.classList.contains('nk-spinner') ||
      card.getAttribute('aria-hidden') === 'true'
    ) {
      continue
    }
    const dayAge = getEventCardDayAge(card, referenceTimestamp)
    if (dayAge !== null) {
      return { card, dayAge }
    }
  }
  return null
}

/**
 * Находит все потенциально скроллируемые контейнеры для ленты событий.
 */
export const getAllScrollableContainers = (feedContainer: HTMLElement): HTMLElement[] => {
  const containers = new Set<HTMLElement>()

  // 1. Сам feedContainer и все его предки
  let current: HTMLElement | null = feedContainer
  while (current && current !== document.documentElement) {
    containers.add(current)
    current = current.parentElement
  }

  // 2. Внутренние элементы со скроллом
  feedContainer
    .querySelectorAll<HTMLElement>(
      '.nk-scrollable, .nk-scrollable__content, [class*="scrollable"], .nk-list, .nk-sidebar-view__body',
    )
    .forEach((el) => {
      containers.add(el)
    })

  // 3. Родители карточек
  const cards = feedContainer.querySelectorAll<HTMLElement>('.nk-event-view, [class*="event-view"]')
  if (cards.length > 0) {
    const lastCard = cards[cards.length - 1]
    if (lastCard.parentElement) {
      containers.add(lastCard.parentElement)
      if (lastCard.parentElement.parentElement) {
        containers.add(lastCard.parentElement.parentElement)
      }
    }
  }

  // Фильтруем элементы, которые могут скроллиться
  const scrollable: HTMLElement[] = []
  for (const el of containers) {
    const style = typeof window !== 'undefined' ? window.getComputedStyle(el) : null
    const overflowY = style?.overflowY
    if (
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      el.scrollHeight > el.clientHeight ||
      el.classList.contains('nk-scrollable') ||
      el.classList.contains('nk-scrollable__content')
    ) {
      scrollable.push(el)
    }
  }

  if (scrollable.length === 0) {
    scrollable.push(feedContainer)
  }

  return scrollable
}

/**
 * Находит основной скроллируемый контейнер для ленты событий.
 */
export const findFeedScrollableContainer = (feedContainer: HTMLElement): HTMLElement => {
  // 1. Ищем элемент с явным scrollHeight > clientHeight и overflow auto/scroll
  const all = getAllScrollableContainers(feedContainer)
  const activeScroll = all.find(
    (el) =>
      el.scrollHeight > el.clientHeight &&
      typeof window !== 'undefined' &&
      (window.getComputedStyle(el).overflowY === 'auto' ||
        window.getComputedStyle(el).overflowY === 'scroll'),
  )
  if (activeScroll) {
    return activeScroll
  }

  // 2. Ищем внутренний .nk-scrollable или .nk-scrollable__content
  const scrollChild = feedContainer.querySelector<HTMLElement>(
    '.nk-scrollable, .nk-scrollable__content, [class*="scrollable"]',
  )
  if (scrollChild) {
    return scrollChild
  }

  return feedContainer
}

/**
 * Программно триггерит дозагрузку следующей порции событий ленты через прокрутку.
 */
export const triggerFeedScrollLoad = (feedContainer: HTMLElement): void => {
  // 1. Нативный скролл последней карточки в видимую зону
  const cards = feedContainer.querySelectorAll<HTMLElement>('.nk-event-view, [class*="event-view"]')
  if (cards.length > 0) {
    const lastCard = cards[cards.length - 1]
    try {
      if (typeof lastCard.scrollIntoView === 'function') {
        lastCard.scrollIntoView({ behavior: 'auto', block: 'end' })
      }
    } catch {
      // Игнорируем в средах без нативного scrollIntoView
    }
  }

  // 2. Прокрутка всех найденных скролл-контейнеров
  const targets = getAllScrollableContainers(feedContainer)
  for (const target of targets) {
    const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight)
    if (maxScroll > 0) {
      target.scrollTop = Math.max(0, maxScroll - 30)
      target.dispatchEvent(new Event('scroll', { bubbles: true }))
      target.scrollTop = maxScroll
      target.dispatchEvent(new Event('scroll', { bubbles: true }))
    } else {
      target.scrollTop = target.scrollHeight
      target.dispatchEvent(new Event('scroll', { bubbles: true }))
    }

    try {
      if (typeof WheelEvent !== 'undefined') {
        const wheelEvt = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: 600,
        })
        target.dispatchEvent(wheelEvt)
      }
    } catch {
      // Игнорируем в средах без WheelEvent
    }
  }

  // 3. Клик по кнопке "Показать еще" / "Загрузить еще" (если есть)
  const moreButton = feedContainer.querySelector<HTMLElement>(
    'button.nk-button, .nk-user-feeds-view__more, [class*="more-button"], [class*="load-more"]',
  )
  if (moreButton && /ещ[её]|дальше|больше|load\s*more/i.test(moreButton.textContent || '')) {
    moreButton.click()
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('scroll'))
  }
}

/**
 * Рассчитывает целевой временной порог (в мс) для N суток.
 */
export const getTargetThresholdMs = (
  targetDays: number,
  referenceTimestamp = Date.now(),
): number => {
  const startOfToday = new Date(referenceTimestamp)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfTodayMs = startOfToday.getTime()

  const daysAgoMs = referenceTimestamp - targetDays * 24 * 60 * 60 * 1000
  const calendarDaysAgoMs = startOfTodayMs - (targetDays - 1) * 24 * 60 * 60 * 1000

  return Math.min(calendarDaysAgoMs, daysAgoMs)
}

/**
 * Находит последнюю карточку с валидной датой, сканируя список карточек с конца.
 */
export const getLastCardWithDate = (
  cards: HTMLElement[],
  referenceTimestamp = Date.now(),
): { card: HTMLElement; date: Date } | null => {
  for (let i = cards.length - 1; i >= 0; i--) {
    const card = cards[i]
    if (
      card.classList.contains('nk-event-view_skeleton') ||
      card.classList.contains('nk-spinner') ||
      card.getAttribute('aria-hidden') === 'true'
    ) {
      continue
    }
    const date = parseEventCardDate(card, referenceTimestamp)
    if (date) {
      return { card, date }
    }
  }
  return null
}

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

  const waitForNewCards = (
    container: HTMLElement,
    previousCount: number,
    timeoutMs = 3500,
  ): Promise<number> => {
    return new Promise((resolve) => {
      let isResolved = false
      let timer: ReturnType<typeof setTimeout> | null = null
      let observer: MutationObserver | null = null

      const finish = (count: number) => {
        if (isResolved) {
          return
        }
        isResolved = true
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        if (observer) {
          observer.disconnect()
          observer = null
        }
        resolve(count)
      }

      timer = setTimeout(() => {
        const currentCards = getEventCards(container)
        finish(currentCards.length)
      }, timeoutMs)

      if (typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver(() => {
          const currentCards = getEventCards(container)
          if (currentCards.length > previousCount) {
            finish(currentCards.length)
          }
        })
        observer.observe(container, { childList: true, subtree: true })
      }
    })
  }

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
