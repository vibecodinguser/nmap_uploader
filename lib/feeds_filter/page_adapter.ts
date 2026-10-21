import { extractCardStatus } from './card_status_detector'
import { FEED_HIDDEN_CLASS } from './constants'
import { calculateFeedStats, type FeedEventItem, type FeedStats, type FeedStatusId } from './core'

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

/**
 * Применяет активный фильтр к карточкам в DOM и возвращает статистику.
 */
export const applyFeedFilterToDom = ({ container, filter }: ApplyFeedFilterInput): FeedStats => {
  const cards = findEventCards(container)

  const eventItems: FeedEventItem[] = cards.map((card, index) => ({
    id: card.id || `card-${index}`,
    status: extractCardStatus(card),
  }))

  const stats = calculateFeedStats(eventItems)

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    const item = eventItems[i]
    if (!card || !item) continue

    const isVisible = filter === 'all' || item.status === filter

    if (isVisible) {
      card.classList.remove(FEED_HIDDEN_CLASS)
    } else {
      card.classList.add(FEED_HIDDEN_CLASS)
    }
  }

  return stats
}
