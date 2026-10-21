import {
  applyFeedFilterToDom,
  attachFilterDropdownToDom,
  calculateDayAgeFromDateText,
  createFilterDropdownElement,
  ensureFeedFilterStyles,
  FEED_HIDDEN_CLASS,
  FEEDS_FILTER_BAR_ID,
  FEEDS_FILTER_ENABLED_STORAGE_KEY,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  FEEDS_FILTER_STYLES_ID,
  type FilterDropdownController,
  findFeedContainer,
  findFeedHeader,
  findTargetSelect,
  getEventCardDateText,
  getEventCardDayAge,
  findEventCards as getEventCards,
  getStoredFeedsFilterEnabled,
  isEditsModeSelected,
  isValidTargetSelect,
  parseEventCardDate,
  parseEventDateString,
  STATUS_FILTER_OPTIONS,
  type StatusFilterOption,
  setStoredFeedsFilterEnabled,
  syncFilterDropdownHeight,
} from '@/lib/feeds_filter'

export type FeedStatusId = 'all' | 'published' | 'green' | 'yellow' | 'red'

export interface FeedStats {
  total: number
  published: number
  green: number
  yellow: number
  red: number
}

export {
  attachFilterDropdownToDom,
  calculateDayAgeFromDateText,
  createFilterDropdownElement,
  ensureFeedFilterStyles,
  FEED_HIDDEN_CLASS,
  FEEDS_FILTER_BAR_ID,
  FEEDS_FILTER_ENABLED_STORAGE_KEY,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  FEEDS_FILTER_STYLES_ID,
  type FilterDropdownController,
  findFeedContainer,
  findFeedHeader,
  findTargetSelect,
  getEventCardDateText,
  getEventCardDayAge,
  getEventCards,
  getStoredFeedsFilterEnabled,
  isEditsModeSelected,
  isValidTargetSelect,
  parseEventCardDate,
  parseEventDateString,
  STATUS_FILTER_OPTIONS,
  type StatusFilterOption,
  setStoredFeedsFilterEnabled,
  syncFilterDropdownHeight,
}

/**
 * Извлекает статус правки из элемента состояния коммита (nk-commit-state-view / nk-event-view__commit-state / nk-icon_id_commit-*).
 */
export const getCommitStateStatus = (card: HTMLElement): FeedStatusId | null => {
  const stateElement =
    (card.matches(
      '.nk-event-view__commit-state, .nk-commit-state-view, [class*="commit-state-view"], [class*="icon_id_commit-"]',
    )
      ? card
      : null) ||
    card.querySelector<HTMLElement>('.nk-event-view__commit-state') ||
    card.querySelector<HTMLElement>('.nk-commit-state-view') ||
    card.querySelector<HTMLElement>('[class*="commit-state-view"]') ||
    card.querySelector<HTMLElement>('[class*="icon_id_commit-"]')

  if (!stateElement) {
    return null
  }

  const iconChild = stateElement.querySelector<HTMLElement>('[class*="icon_id_commit-"]')
  const combinedClasses =
    `${stateElement.className} ${iconChild ? iconChild.className : ''}`.toLowerCase()

  // 1. Проверка по модификаторам и ID иконки коммита
  if (
    combinedClasses.includes('commit-rejected') ||
    combinedClasses.includes('commit-declined') ||
    combinedClasses.includes('commit-canceled') ||
    combinedClasses.includes('commit-cancelled') ||
    combinedClasses.includes('state_rejected') ||
    combinedClasses.includes('state-rejected')
  ) {
    return 'red'
  }

  if (
    combinedClasses.includes('commit-published') ||
    combinedClasses.includes('state_published') ||
    combinedClasses.includes('state-published')
  ) {
    return 'published'
  }

  if (
    combinedClasses.includes('commit-accepted') ||
    combinedClasses.includes('commit-approved') ||
    combinedClasses.includes('commit-applied') ||
    combinedClasses.includes('commit-success') ||
    combinedClasses.includes('commit-committed') ||
    combinedClasses.includes('state_accepted') ||
    combinedClasses.includes('state_approved')
  ) {
    return 'green'
  }

  if (
    combinedClasses.includes('commit-pending') ||
    combinedClasses.includes('commit-moderation') ||
    combinedClasses.includes('commit-review') ||
    combinedClasses.includes('commit-waiting') ||
    combinedClasses.includes('commit-in-progress') ||
    combinedClasses.includes('state_pending') ||
    combinedClasses.includes('state_moderation')
  ) {
    return 'yellow'
  }

  // 2. Проверка по цветовым классам BEM
  if (combinedClasses.includes('color_green') || combinedClasses.includes('badge_color_green')) {
    return 'green'
  }
  if (
    combinedClasses.includes('color_yellow') ||
    combinedClasses.includes('color_orange') ||
    combinedClasses.includes('badge_color_yellow') ||
    combinedClasses.includes('badge_color_orange')
  ) {
    return 'yellow'
  }
  if (combinedClasses.includes('color_red') || combinedClasses.includes('badge_color_red')) {
    return 'red'
  }

  // 3. Проверка по атрибутам title, aria-label или текстовому содержимому
  const titleText = (
    stateElement.getAttribute('title') ||
    stateElement.getAttribute('aria-label') ||
    iconChild?.getAttribute('title') ||
    iconChild?.getAttribute('aria-label') ||
    stateElement.textContent ||
    ''
  )
    .trim()
    .toLowerCase()

  if (titleText) {
    if (/(опубликован|published)/i.test(titleText)) {
      return 'published'
    }
    if (/(принят|одобрен|согласован|approved|accepted|committed)/i.test(titleText)) {
      return 'green'
    }
    if (/(проверк|модерац|ожида|рассмотр|pending|review|waiting)/i.test(titleText)) {
      return 'yellow'
    }
    if (/(отклон|отказ|исправлен|rejected|declined|canceled)/i.test(titleText)) {
      return 'red'
    }
  }

  return null
}

/**
 * Определяет статус правки по состоянию коммита или бейджу nk-event-view__badge.
 */
export const getEventCardStatus = (card: HTMLElement): FeedStatusId | 'other' => {
  // 1. Приоритетный поиск по состоянию коммита
  const commitStatus = getCommitStateStatus(card)
  if (commitStatus) {
    return commitStatus
  }

  // 2. Резервный поиск по бейджу
  const badge =
    (card.matches('.nk-event-view__badge, .nk-badge') ? card : null) ||
    card.querySelector<HTMLElement>('.nk-event-view__badge') ||
    card.querySelector<HTMLElement>('.nk-badge')

  if (!badge) {
    return 'other'
  }

  const className = badge.className || ''
  const text = (badge.textContent || '').trim().toLowerCase()

  // Проверка по цвету бейджа БЭМ
  if (className.includes('nk-badge_color_green') || className.includes('color_green')) {
    return 'green'
  }
  if (
    className.includes('nk-badge_color_yellow') ||
    className.includes('nk-badge_color_orange') ||
    className.includes('color_yellow') ||
    className.includes('color_orange')
  ) {
    return 'yellow'
  }
  if (className.includes('nk-badge_color_red') || className.includes('color_red')) {
    return 'red'
  }

  // Резервная проверка по тексту статуса
  if (/(опубликован|published)/i.test(text)) {
    return 'published'
  }
  if (/(принят|одобрен|согласован|approved|accepted)/i.test(text)) {
    return 'green'
  }
  if (/(проверк|модерац|ожида|pending|review)/i.test(text)) {
    return 'yellow'
  }
  if (/(отклон|отказ|исправлен|rejected|declined)/i.test(text)) {
    return 'red'
  }

  return 'other'
}

/**
 * Применяет активный фильтр к карточкам событий и подсчитывает статистику.
 */
export const applyFeedFilter = (container: HTMLElement, filter: FeedStatusId): FeedStats => {
  return applyFeedFilterToDom({ container, filter })
}

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
  // 1. Нативный скролл последней карточки в видимую зону (гарантированно сдвигает реальный скроллбар)
  const cards = feedContainer.querySelectorAll<HTMLElement>('.nk-event-view, [class*="event-view"]')
  if (cards.length > 0) {
    const lastCard = cards[cards.length - 1]
    try {
      if (typeof lastCard.scrollIntoView === 'function') {
        lastCard.scrollIntoView({ behavior: 'auto', block: 'end' })
      }
    } catch {
      // Игнорируем в тестовых средах без нативного scrollIntoView
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
 * Гарантирует покрытие всех правок текущего календарного дня (с 00:00:00) и не менее 24 часов.
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
 * При открытии ленты подгружает события за текущие сутки (не менее 24 часов).
 * При скролле вниз автоматически догружает очередные сутки.
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
          // Для targetDays = 1 (сегодня): встретилось "вчера" (dayAge >= 1) — все события за сегодня уже загружены!
          // Для targetDays = 2 (2 суток): встретилось "2 дня назад" (dayAge >= 2) — все события за 2 суток загружены!
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
          // Повторный альтернативный триггер
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
