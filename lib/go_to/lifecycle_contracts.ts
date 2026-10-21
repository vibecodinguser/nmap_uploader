/**
 * Контракты и детекторы изменений настроек тулбара Go To.
 */
import { GO_TO_ITEMS_STORAGE_KEY, GO_TO_MENU_ENABLED_STORAGE_KEY } from '@/lib/go_to_settings'
import { GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY } from '@/lib/go_to_split_button'
import { NOTES_BUTTON_ENABLED_STORAGE_KEY } from '@/lib/notes_button'

export interface StorageAreaEmitter {
  onChanged: {
    addListener: (
      callback: (changes: Record<string, { newValue?: unknown }>, area: string) => void,
    ) => void
    removeListener: (
      callback: (changes: Record<string, { newValue?: unknown }>, area: string) => void,
    ) => void
  }
}

export interface RuntimeMessageEmitter {
  onMessage: {
    addListener: (callback: (message: { action?: string }) => void) => void
    removeListener: (callback: (message: { action?: string }) => void) => void
  }
}

export interface GoToLifecycleOptions {
  storage?: StorageAreaEmitter
  runtime?: RuntimeMessageEmitter
}

export const hasGoToRefreshStorageChange = (
  changes: Record<string, { newValue?: unknown }>,
): boolean =>
  GO_TO_MENU_ENABLED_STORAGE_KEY in changes ||
  GO_TO_ITEMS_STORAGE_KEY in changes ||
  GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY in changes ||
  NOTES_BUTTON_ENABLED_STORAGE_KEY in changes
