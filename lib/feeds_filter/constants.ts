import { COMMIT_STATE_ICONS } from '@/lib/nmaps_commit_state_icons'
import type { FeedActionId, FeedStatusId } from './core'

export interface StatusFilterOption {
  readonly id: FeedStatusId
  readonly label: string
  readonly iconClass?: string
  readonly svgMarkup?: string
  readonly colorClass?: string
}

export interface ActionFilterOption {
  readonly id: FeedActionId
  readonly label: string
  readonly color?: string
  readonly colorClass?: string
}

export const FEEDS_FILTER_SELECT_ID = 'nmap-uploader-feeds-filter-select'
export const FEEDS_FILTER_BAR_ID = FEEDS_FILTER_SELECT_ID
export const FEEDS_FILTER_POPUP_ID = 'nmap-uploader-feeds-filter-popup'
export const FEEDS_ACTION_FILTER_SELECT_ID = 'nmap-uploader-feeds-action-filter-select'
export const FEEDS_ACTION_FILTER_POPUP_ID = 'nmap-uploader-feeds-action-filter-popup'
export const FEEDS_FILTER_STYLES_ID = 'nmap-uploader-feeds-filter-styles'
export const FEED_HIDDEN_CLASS = 'nmap-uploader-feed-event-hidden'

export const HISTORY_PERIOD_OPTIONS = [1, 3, 7] as const
export type HistoryPeriodDays = (typeof HISTORY_PERIOD_OPTIONS)[number]
export const DEFAULT_HISTORY_PERIOD_DAYS: HistoryPeriodDays = 1

export const ACTION_FILTER_OPTIONS: readonly ActionFilterOption[] = [
  { id: 'all', label: 'Все действия' },
  { id: 'delete', label: 'Удаления', color: '#ff6464', colorClass: 'nk-badge_color_red' },
  { id: 'edit', label: 'Редактирование', color: '#999999' },
  { id: 'create', label: 'Создание', color: '#8fcb69', colorClass: 'nk-badge_color_green' },
]

export const STATUS_FILTER_OPTIONS: readonly StatusFilterOption[] = [
  { id: 'all', label: 'Все статусы' },
  {
    id: 'published',
    label: 'Опубликована',
    iconClass: COMMIT_STATE_ICONS.published.className,
    svgMarkup: COMMIT_STATE_ICONS.published.svgMarkup,
    colorClass: 'nk-badge_color_green',
  },
  {
    id: 'green',
    label: 'Одобрена',
    iconClass: COMMIT_STATE_ICONS.green.className,
    svgMarkup: COMMIT_STATE_ICONS.green.svgMarkup,
    colorClass: 'nk-badge_color_green',
  },
  {
    id: 'yellow',
    label: 'На рассмотрении',
    iconClass: COMMIT_STATE_ICONS.yellow.className,
    svgMarkup: COMMIT_STATE_ICONS.yellow.svgMarkup,
    colorClass: 'nk-badge_color_yellow',
  },
  {
    id: 'red',
    label: 'Не принята',
    iconClass: COMMIT_STATE_ICONS.red.className,
    svgMarkup: COMMIT_STATE_ICONS.red.svgMarkup,
    colorClass: 'nk-badge_color_red',
  },
]
