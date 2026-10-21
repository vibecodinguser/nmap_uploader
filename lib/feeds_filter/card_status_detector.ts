import type { FeedItemStatus, FeedStatusId } from './core'

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

  // 2. Резервный поиск по бейджу или цветовым классам потомков
  const badge =
    (card.matches('.nk-event-view__badge, .nk-badge, [class*="badge"], [class*="color_"]')
      ? card
      : null) ||
    card.querySelector<HTMLElement>(
      '.nk-event-view__badge, .nk-badge, [class*="badge"], [class*="color_"]',
    )

  if (!badge) {
    const cardClass = card.className || ''
    if (cardClass.includes('yellow') || cardClass.includes('orange')) return 'yellow'
    if (cardClass.includes('green')) return 'green'
    if (cardClass.includes('red')) return 'red'
    return 'other'
  }

  const className = `${card.className} ${badge.className || ''}`.toLowerCase()
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
 * Извлекает статус коммита или бейджа из карточки события Народной карты.
 */
export const extractCardStatus = (card: HTMLElement): FeedItemStatus => {
  return getEventCardStatus(card)
}
