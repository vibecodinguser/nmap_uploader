export type FeedStatusId = 'all' | 'published' | 'green' | 'yellow' | 'red'
export type FeedItemStatus = FeedStatusId | 'other'

export type FeedActionId = 'all' | 'delete' | 'edit' | 'create'
export type FeedItemAction = 'delete' | 'edit' | 'create'

export interface FeedStats {
  total: number
  published: number
  green: number
  yellow: number
  red: number
}

export interface FeedActionsStats {
  total: number
  delete: number
  edit: number
  create: number
}

export interface FeedEventItem {
  id: string
  status: FeedItemStatus
  action?: FeedItemAction
}

export type FilterFeedEventsInput = {
  events: readonly FeedEventItem[]
  filter: FeedStatusId
}

export type FilterCombinedFeedEventsInput = {
  events: readonly FeedEventItem[]
  statusFilter: FeedStatusId
  actionFilter: FeedActionId
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
 * Вычисляет статистику по действиям правок (чистая функция).
 */
export const calculateFeedActionsStats = (events: readonly FeedEventItem[]): FeedActionsStats => {
  const stats: FeedActionsStats = {
    total: events.length,
    delete: 0,
    edit: 0,
    create: 0,
  }

  for (const event of events) {
    if (event.action === 'delete') {
      stats.delete += 1
    } else if (event.action === 'create') {
      stats.create += 1
    } else if (event.action === 'edit') {
      stats.edit += 1
    }
  }

  return stats
}

/**
 * Проверяет видимость карточки по пересечению фильтров статуса и действия (Логическое И).
 */
export const isCardVisibleByCombinedFilter = (
  item: { status: FeedItemStatus; action?: FeedItemAction },
  statusFilter: FeedStatusId,
  actionFilter: FeedActionId,
): boolean => {
  const statusMatches = statusFilter === 'all' || item.status === statusFilter
  const actionMatches = actionFilter === 'all' || item.action === actionFilter
  return statusMatches && actionMatches
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
