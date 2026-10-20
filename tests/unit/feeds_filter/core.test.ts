import { describe, expect, it } from 'vitest'
import { calculateFeedStats, type FeedEventItem, filterFeedEvents } from '@/lib/feeds_filter/core'

describe('FeedsFilter Core Domain (TDD slice: pure logic without DOM)', () => {
  const sampleEvents: FeedEventItem[] = [
    { id: '1', status: 'published' },
    { id: '2', status: 'green' },
    { id: '3', status: 'green' },
    { id: '4', status: 'yellow' },
    { id: '5', status: 'red' },
    { id: '6', status: 'other' },
  ]

  it('вычисляет статистику по статусам событий ленты', () => {
    const stats = calculateFeedStats(sampleEvents)

    expect(stats.total).toBe(6)
    expect(stats.published).toBe(1)
    expect(stats.green).toBe(2)
    expect(stats.yellow).toBe(1)
    expect(stats.red).toBe(1)
  })

  it('корректно фильтрует события по выбранному статусу', () => {
    const onlyGreen = filterFeedEvents({ events: sampleEvents, filter: 'green' })
    expect(onlyGreen).toHaveLength(2)
    expect(onlyGreen.every((e) => e.status === 'green')).toBe(true)

    const allEvents = filterFeedEvents({ events: sampleEvents, filter: 'all' })
    expect(allEvents).toHaveLength(6)
  })
})
