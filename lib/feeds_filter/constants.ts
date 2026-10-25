import type { FeedStatusId } from './core'

export interface StatusFilterOption {
  readonly id: FeedStatusId
  readonly label: string
  readonly iconClass?: string
  readonly svgMarkup?: string
  readonly colorClass?: string
}

export const FEEDS_FILTER_SELECT_ID = 'nmap-uploader-feeds-filter-select'
export const FEEDS_FILTER_BAR_ID = FEEDS_FILTER_SELECT_ID
export const FEEDS_FILTER_POPUP_ID = 'nmap-uploader-feeds-filter-popup'
export const FEEDS_FILTER_STYLES_ID = 'nmap-uploader-feeds-filter-styles'
export const FEED_HIDDEN_CLASS = 'nmap-uploader-feed-event-hidden'

export const HISTORY_PERIOD_OPTIONS = [1, 3, 7] as const
export type HistoryPeriodDays = (typeof HISTORY_PERIOD_OPTIONS)[number]
export const DEFAULT_HISTORY_PERIOD_DAYS: HistoryPeriodDays = 1

export const STATUS_FILTER_OPTIONS: readonly StatusFilterOption[] = [
  { id: 'all', label: 'Все статусы' },
  {
    id: 'published',
    label: 'Опубликована',
    iconClass:
      'nk-icon nk-icon_id_commit-published nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g fill="none" fill-rule="evenodd"><circle cx="11" cy="11" r="10" fill="#8fcb69"/><path fill="#fff" d="m16.255 6.922-5.659 7.308 1.406 1.089 5.659-7.308zM5.578 10.413l-1.239 1.274L8.054 15.3l5.609-7.291-1.409-1.084-4.392 5.709z"/></g></svg>',
    colorClass: 'nk-badge_color_green',
  },
  {
    id: 'green',
    label: 'Одобрена',
    iconClass:
      'nk-icon nk-icon_id_commit-approved nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g fill="none" fill-rule="evenodd"><circle cx="11" cy="11" r="10" fill="#8fcb69"/><path fill="#fff" d="m7.92 10.446-1.24 1.275 3.716 3.612 5.609-7.291-1.41-1.084-4.391 5.709z"/></g></svg>',
    colorClass: 'nk-badge_color_green',
  },
  {
    id: 'yellow',
    label: 'На рассмотрении',
    iconClass:
      'nk-icon nk-icon_id_commit-pending nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g fill="none" fill-rule="evenodd"><circle cx="11" cy="11" r="10" fill="#fc5"/><path fill="#fff" d="M12 5h-2v6.535l4.277 2.852 1.11-1.664L12 10.465z"/></g></svg>',
    colorClass: 'nk-badge_color_yellow',
  },
  {
    id: 'red',
    label: 'Не принята',
    iconClass:
      'nk-icon nk-icon_id_commit-rejected nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g fill="none" fill-rule="evenodd"><circle cx="11" cy="11" r="10" fill="#ff6464"/><path fill="#fff" d="m8.172 6.757 7.07 7.071-1.414 1.415-7.07-7.071z"/><path fill="#fff" d="m15.243 8.172-7.071 7.07-1.415-1.414 7.071-7.07z"/></g></svg>',
    colorClass: 'nk-badge_color_red',
  },
]
