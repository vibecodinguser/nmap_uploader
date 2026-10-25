import { getCommitStateStatus } from './commit_state_parser'
import type { FeedItemStatus, FeedStatusId } from './core'

export * from './commit_state_parser'

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

/**
 * Определяет действие карточки (удаления, редактирование, создание) по бейджу nk-event-view__badge.
 */
export const getEventCardAction = (card: HTMLElement): 'delete' | 'edit' | 'create' => {
  const badge = card.querySelector<HTMLElement>(
    '.nk-event-view__badge, .nk-badge, [class*="badge"]',
  )
  if (!badge) {
    return 'edit'
  }

  const badgeClass = (badge.className || '').toLowerCase()
  const text = (badge.textContent || '').trim().toLowerCase()

  if (badgeClass.includes('nk-badge_color_red') && text === 'удалён') {
    return 'delete'
  }

  if (badgeClass.includes('nk-badge_color_green') && text === 'создан') {
    return 'create'
  }

  return 'edit'
}

/**
 * Извлекает действие над объектом из карточки события.
 */
export const extractCardAction = (card: HTMLElement): 'delete' | 'edit' | 'create' => {
  return getEventCardAction(card)
}
