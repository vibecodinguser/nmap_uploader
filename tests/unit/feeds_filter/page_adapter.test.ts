// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  applyCombinedFeedFilterToDom,
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

  it('applyCombinedFeedFilterToDom скрывает карточки по логическому И и пересчитывает взаимные счетчики', () => {
    const container = document.createElement('div')

    // card1: green, create
    const card1 = document.createElement('div')
    card1.className = 'nk-event-view nk-icon_id_commit-approved'
    card1.innerHTML = '<div class="nk-badge nk-badge_color_green nk-event-view__badge">создан</div>'

    // card2: green, delete
    const card2 = document.createElement('div')
    card2.className = 'nk-event-view nk-icon_id_commit-approved'
    card2.innerHTML = '<div class="nk-badge nk-badge_color_red nk-event-view__badge">удалён</div>'

    // card3: yellow, create
    const card3 = document.createElement('div')
    card3.className = 'nk-event-view nk-icon_id_commit-pending'
    card3.innerHTML = '<div class="nk-badge nk-badge_color_green nk-event-view__badge">создан</div>'

    container.appendChild(card1)
    container.appendChild(card2)
    container.appendChild(card3)

    // Фильтруем: статус green + действие create -> только card1
    const { statusStats, actionStats } = applyCombinedFeedFilterToDom({
      container,
      statusFilter: 'green',
      actionFilter: 'create',
    })

    expect(card1.classList.contains(FEED_HIDDEN_CLASS)).toBe(false)
    expect(card2.classList.contains(FEED_HIDDEN_CLASS)).toBe(true)
    expect(card3.classList.contains(FEED_HIDDEN_CLASS)).toBe(true)

    // actionStats пересчитан для статуса 'green': среди green (card1, card2) есть 1 create и 1 delete
    expect(actionStats.total).toBe(2)
    expect(actionStats.create).toBe(1)
    expect(actionStats.delete).toBe(1)
    expect(actionStats.edit).toBe(0)

    // statusStats пересчитан для действия 'create': среди create (card1, card3) есть 1 green и 1 yellow
    expect(statusStats.total).toBe(2)
    expect(statusStats.green).toBe(1)
    expect(statusStats.yellow).toBe(1)
  })
})
