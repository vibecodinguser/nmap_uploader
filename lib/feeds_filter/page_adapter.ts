import { extractCardAction, extractCardStatus } from './card_status_detector'
import { FEED_HIDDEN_CLASS } from './constants'
import {
  calculateFeedActionsStats,
  calculateFeedStats,
  type FeedActionId,
  type FeedActionsStats,
  type FeedEventItem,
  type FeedStats,
  type FeedStatusId,
  isCardVisibleByCombinedFilter,
} from './core'

export * from './card_status_detector'
export { FEED_HIDDEN_CLASS }

/**
 * Находит карточки событий в контейнере.
 */
export const findEventCards = (container: HTMLElement): HTMLElement[] => {
  const directCards = Array.from(container.querySelectorAll<HTMLElement>('.nk-event-view'))
  if (directCards.length > 0) {
    return directCards
  }

  return Array.from(container.querySelectorAll<HTMLElement>('[class*="event-view"]')).filter(
    (el) => !/[a-z0-9_-]+__/.test(el.className),
  )
}

export type ApplyFeedFilterInput = {
  container: HTMLElement
  filter: FeedStatusId
}

export type CombinedFeedStats = {
  statusStats: FeedStats
  actionStats: FeedActionsStats
}

export type ApplyCombinedFeedFilterInput = {
  container: HTMLElement
  statusFilter?: FeedStatusId
  actionFilter?: FeedActionId
}

/**
 * Применяет комбинацию фильтра статуса и фильтра действия к карточкам в DOM и взаимно рассчитывает счетчики.
 */
export const applyCombinedFeedFilterToDom = ({
  container,
  statusFilter = 'all',
  actionFilter = 'all',
}: ApplyCombinedFeedFilterInput): CombinedFeedStats => {
  const cards = findEventCards(container)

  const eventItems: FeedEventItem[] = cards.map((card, index) => ({
    id: card.id || `card-${index}`,
    status: extractCardStatus(card),
    action: extractCardAction(card),
  }))

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    const item = eventItems[i]
    if (!card || !item) continue

    const isVisible = isCardVisibleByCombinedFilter(item, statusFilter, actionFilter)

    if (isVisible) {
      card.classList.remove(FEED_HIDDEN_CLASS)
    } else {
      card.classList.add(FEED_HIDDEN_CLASS)
    }
  }

  // Счетчики статусов среди карточек, соответствующих выбранному действию
  const itemsForStatusStats =
    actionFilter === 'all' ? eventItems : eventItems.filter((item) => item.action === actionFilter)
  const statusStats = calculateFeedStats(itemsForStatusStats)

  // Счетчики действий среди карточек, соответствующих выбранному статусу
  const itemsForActionStats =
    statusFilter === 'all' ? eventItems : eventItems.filter((item) => item.status === statusFilter)
  const actionStats = calculateFeedActionsStats(itemsForActionStats)

  return { statusStats, actionStats }
}

/**
 * Применяет активный фильтр по статусу к карточкам в DOM и возвращает статистику статусов.
 */
export const applyFeedFilterToDom = ({ container, filter }: ApplyFeedFilterInput): FeedStats => {
  return applyCombinedFeedFilterToDom({ container, statusFilter: filter, actionFilter: 'all' })
    .statusStats
}
