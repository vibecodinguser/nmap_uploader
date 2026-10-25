import { describe, expect, it } from 'vitest'
import {
  calculateFeedActionsStats,
  calculateFeedStats,
  type FeedEventItem,
  filterFeedEvents,
  isCardVisibleByCombinedFilter,
} from '@/lib/feeds_filter/core'

describe('FeedsFilter Core Domain (TDD slice: pure logic without DOM)', () => {
  const sampleEvents: FeedEventItem[] = [
    { id: '1', status: 'published', action: 'create' },
    { id: '2', status: 'green', action: 'edit' },
    { id: '3', status: 'green', action: 'delete' },
    { id: '4', status: 'yellow', action: 'edit' },
    { id: '5', status: 'red', action: 'delete' },
    { id: '6', status: 'other', action: 'create' },
  ]

  it('вычисляет статистику по статусам событий ленты', () => {
    const stats = calculateFeedStats(sampleEvents)

    expect(stats.total).toBe(6)
    expect(stats.published).toBe(1)
    expect(stats.green).toBe(2)
    expect(stats.yellow).toBe(1)
    expect(stats.red).toBe(1)
  })

  it('вычисляет статистику по действиям событий ленты', () => {
    const stats = calculateFeedActionsStats(sampleEvents)

    expect(stats.total).toBe(6)
    expect(stats.create).toBe(2)
    expect(stats.edit).toBe(2)
    expect(stats.delete).toBe(2)
  })

  it('корректно фильтрует события по выбранному статусу', () => {
    const onlyGreen = filterFeedEvents({ events: sampleEvents, filter: 'green' })
    expect(onlyGreen).toHaveLength(2)
    expect(onlyGreen.every((e) => e.status === 'green')).toBe(true)

    const allEvents = filterFeedEvents({ events: sampleEvents, filter: 'all' })
    expect(allEvents).toHaveLength(6)
  })

  it('isCardVisibleByCombinedFilter проверяет условие логического И между статусом и действием', () => {
    const item = { status: 'green' as const, action: 'create' as const }

    expect(isCardVisibleByCombinedFilter(item, 'all', 'all')).toBe(true)
    expect(isCardVisibleByCombinedFilter(item, 'green', 'create')).toBe(true)
    expect(isCardVisibleByCombinedFilter(item, 'green', 'delete')).toBe(false)
    expect(isCardVisibleByCombinedFilter(item, 'red', 'create')).toBe(false)
    expect(isCardVisibleByCombinedFilter(item, 'all', 'create')).toBe(true)
    expect(isCardVisibleByCombinedFilter(item, 'green', 'all')).toBe(true)
  })
})
