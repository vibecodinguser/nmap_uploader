import {
  calculateFeedStats,
  type FeedEventItem,
  type FeedItemStatus,
  type FeedStats,
  type FeedStatusId,
} from './core'

export const FEED_HIDDEN_CLASS = 'nmap-uploader-feed-event-hidden'

/**
 * Извлекает статус коммита или бейджа из карточки события Народной карты.
 */
export const extractCardStatus = (card: HTMLElement): FeedItemStatus => {
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

  if (stateElement) {
    const iconChild = stateElement.querySelector<HTMLElement>(
      '[class*="icon_id_commit-"]',
    )
    const combinedClasses =
      `${stateElement.className} ${iconChild ? iconChild.className : ''}`.toLowerCase()

    if (
      combinedClasses.includes('commit-rejected') ||
      combinedClasses.includes('commit-declined') ||
      combinedClasses.includes('commit-canceled') ||
      combinedClasses.includes('commit-cancelled') ||
      combinedClasses.includes('state_rejected') ||
      combinedClasses.includes('state-rejected') ||
      combinedClasses.includes('color_red') ||
      combinedClasses.includes('badge_color_red')
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
      combinedClasses.includes('state_approved') ||
      combinedClasses.includes('color_green') ||
      combinedClasses.includes('badge_color_green')
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
      combinedClasses.includes('state_moderation') ||
      combinedClasses.includes('color_yellow') ||
      combinedClasses.includes('color_orange') ||
      combinedClasses.includes('badge_color_yellow') ||
      combinedClasses.includes('badge_color_orange')
    ) {
      return 'yellow'
    }
  }

  // Резервный поиск по бейджу
  const badge =
    (card.matches('.nk-event-view__badge, .nk-badge, [class*="badge"]')
      ? card
      : null) ||
    card.querySelector<HTMLElement>(
      '.nk-event-view__badge, .nk-badge, [class*="badge"]',
    )

  if (badge) {
    const className = badge.className || ''
    if (className.includes('green')) return 'green'
    if (className.includes('yellow') || className.includes('orange'))
      return 'yellow'
    if (className.includes('red')) return 'red'
  }

  return 'other'
}

/**
 * Находит карточки событий в контейнере.
 */
export const findEventCards = (container: HTMLElement): HTMLElement[] => {
  const directCards = Array.from(
    container.querySelectorAll<HTMLElement>('.nk-event-view'),
  )
  if (directCards.length > 0) {
    return directCards
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>('[class*="event-view"]'),
  ).filter((el) => !/[a-z0-9_-]+__/.test(el.className))
}

export type ApplyFeedFilterInput = {
  container: HTMLElement
  filter: FeedStatusId
}

/**
 * Применяет активный фильтр к карточкам в DOM и возвращает статистику.
 */
export const applyFeedFilterToDom = ({
  container,
  filter,
}: ApplyFeedFilterInput): FeedStats => {
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
