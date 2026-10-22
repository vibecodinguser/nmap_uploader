import { getStoredGoToMenuEnabled } from '@/lib/go_to_settings'
import { getStoredSplitButtonEnabled } from '@/lib/go_to_split_button'
import { getStoredNotesButtonEnabled } from '@/lib/notes_button'

export type GoToToolbarSettings = readonly [boolean, boolean, boolean]

/**
 * Загружает настройки тулбара Перейти (меню геосервисов, кнопка сплита, кнопка заметок).
 */
export const loadGoToToolbarSettings = (): Promise<GoToToolbarSettings> => {
  const menuEnabledPromise = getStoredGoToMenuEnabled()
  const splitButtonEnabledPromise = getStoredSplitButtonEnabled()
  const notesButtonEnabledPromise = getStoredNotesButtonEnabled()
  return Promise.all([menuEnabledPromise, splitButtonEnabledPromise, notesButtonEnabledPromise])
}
