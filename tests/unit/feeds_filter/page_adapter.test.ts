// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  applyFeedFilterToDom,
  extractCardStatus,
  FEED_HIDDEN_CLASS,
  findEventCards,
} from '@/lib/feeds_filter/page_adapter'

describe('FeedsFilter Page Adapter (TDD slice: DOM operations)', () => {
  it('извлекает статус из элемента карточки с классами коммита', () => {
    const cardPublished = document.createElement('div')
    cardPublished.className = 'nk-event-view nk-commit-state-view nk-icon_id_commit-published'
    expect(extractCardStatus(cardPublished)).toBe('published')

    const cardPending = document.createElement('div')
    cardPending.className = 'nk-event-view'
    const child = document.createElement('span')
    child.className = 'nk-badge_color_yellow'
    cardPending.appendChild(child)
    expect(extractCardStatus(cardPending)).toBe('yellow')
  })

  it('находит карточки событий в контейнере и скрывает неподходящие под фильтр', () => {
    const container = document.createElement('div')

    const card1 = document.createElement('div')
    card1.className = 'nk-event-view nk-icon_id_commit-published'
    card1.textContent = 'Event 1'

    const card2 = document.createElement('div')
    card2.className = 'nk-event-view nk-badge_color_yellow'
    card2.textContent = 'Event 2'

    container.appendChild(card1)
    container.appendChild(card2)

    const cards = findEventCards(container)
    expect(cards).toHaveLength(2)

    const stats = applyFeedFilterToDom({
      container,
      filter: 'published',
    })

    expect(stats.total).toBe(2)
    expect(stats.published).toBe(1)
    expect(card1.classList.contains(FEED_HIDDEN_CLASS)).toBe(false)
    expect(card2.classList.contains(FEED_HIDDEN_CLASS)).toBe(true)
  })
})
