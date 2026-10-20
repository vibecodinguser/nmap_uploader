export type FeedStatusId = 'all' | 'published' | 'green' | 'yellow' | 'red'
export type FeedItemStatus = FeedStatusId | 'other'

export interface FeedStats {
  total: number
  published: number
  green: number
  yellow: number
  red: number
}

export interface FeedEventItem {
  id: string
  status: FeedItemStatus
}

export type FilterFeedEventsInput = {
  events: readonly FeedEventItem[]
  filter: FeedStatusId
}

/**
 * Вычисляет статистику по статусам правок (чистая функция).
 */
export const calculateFeedStats = (events: readonly FeedEventItem[]): FeedStats => {
  const stats: FeedStats = {
    total: events.length,
    published: 0,
    green: 0,
    yellow: 0,
    red: 0,
  }

  for (const event of events) {
    if (event.status === 'published') {
      stats.published += 1
    } else if (event.status === 'green') {
      stats.green += 1
    } else if (event.status === 'yellow') {
      stats.yellow += 1
    } else if (event.status === 'red') {
      stats.red += 1
    }
  }

  return stats
}

/**
 * Фильтрует события по выбранному статусу (чистая функция).
 */
export const filterFeedEvents = ({ events, filter }: FilterFeedEventsInput): FeedEventItem[] => {
  if (filter === 'all') {
    return [...events]
  }

  return events.filter((event) => event.status === filter)
}
