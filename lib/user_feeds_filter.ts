import {
  applyFeedFilterToDom,
  attachFilterDropdownToDom,
  calculateDayAgeFromDateText,
  createFeedDailyLoader,
  createFilterDropdownElement,
  DEFAULT_HISTORY_PERIOD_DAYS,
  ensureFeedFilterStyles,
  type FeedDailyLoaderProgress,
  FEED_HIDDEN_CLASS,
  FEEDS_FILTER_BAR_ID,
  FEEDS_FILTER_ENABLED_STORAGE_KEY,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  FEEDS_FILTER_STYLES_ID,
  type FeedDailyLoaderController,
  type FeedDailyLoaderOptions,
  type FilterDropdownController,
  findFeedContainer,
  findFeedHeader,
  findFeedScrollableContainer,
  findTargetSelect,
  getAllScrollableContainers,
  getCommitStateStatus,
  getEventCardDateText,
  getEventCardDayAge,
  getEventCardStatus,
  findEventCards as getEventCards,
  getLastCardWithDate,
  getLastCardWithDayAge,
  getStoredFeedsFilterEnabled,
  getTargetThresholdMs,
  HISTORY_PERIOD_OPTIONS,
  type HistoryPeriodDays,
  isEditsModeSelected,
  isValidTargetSelect,
  parseEventCardDate,
  parseEventDateString,
  STATUS_FILTER_OPTIONS,
  type StatusFilterOption,
  setStoredFeedsFilterEnabled,
  syncFilterDropdownHeight,
  triggerFeedScrollLoad,
} from '@/lib/feeds_filter'

export type FeedStatusId = 'all' | 'published' | 'green' | 'yellow' | 'red'

export interface FeedStats {
  total: number
  published: number
  green: number
  yellow: number
  red: number
}

export {
  attachFilterDropdownToDom,
  calculateDayAgeFromDateText,
  createFeedDailyLoader,
  createFilterDropdownElement,
  DEFAULT_HISTORY_PERIOD_DAYS,
  ensureFeedFilterStyles,
  type FeedDailyLoaderProgress,
  FEED_HIDDEN_CLASS,
  FEEDS_FILTER_BAR_ID,
  FEEDS_FILTER_ENABLED_STORAGE_KEY,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  FEEDS_FILTER_STYLES_ID,
  type FeedDailyLoaderController,
  type FeedDailyLoaderOptions,
  type FilterDropdownController,
  findFeedContainer,
  findFeedHeader,
  findFeedScrollableContainer,
  findTargetSelect,
  getAllScrollableContainers,
  getCommitStateStatus,
  getEventCardDateText,
  getEventCardDayAge,
  getEventCardStatus,
  getEventCards,
  getLastCardWithDate,
  getLastCardWithDayAge,
  getStoredFeedsFilterEnabled,
  getTargetThresholdMs,
  HISTORY_PERIOD_OPTIONS,
  type HistoryPeriodDays,
  isEditsModeSelected,
  isValidTargetSelect,
  parseEventCardDate,
  parseEventDateString,
  STATUS_FILTER_OPTIONS,
  type StatusFilterOption,
  setStoredFeedsFilterEnabled,
  syncFilterDropdownHeight,
  triggerFeedScrollLoad,
}

/**
 * Применяет активный фильтр к карточкам событий и подсчитывает статистику.
 */
export const applyFeedFilter = (container: HTMLElement, filter: FeedStatusId): FeedStats => {
  return applyFeedFilterToDom({ container, filter })
}
