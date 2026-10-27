import { getStoredGoToMenuEnabled } from '@/lib/go_to_settings'
import { getStoredSplitButtonEnabled } from '@/lib/go_to_split_button'
import { getStoredNotesButtonEnabled } from '@/lib/notes_button'
import { getStoredNspdButtonEnabled } from '@/lib/nspd/nspd_button'

export type GoToToolbarSettings = readonly [boolean, boolean, boolean, boolean]

/**
 * Загружает настройки тулбара Перейти (меню геосервисов, кнопка сплита, кнопка заметок, кнопка НСПД).
 */
export const loadGoToToolbarSettings = (): Promise<GoToToolbarSettings> => {
  const menuEnabledPromise = getStoredGoToMenuEnabled()
  const splitButtonEnabledPromise = getStoredSplitButtonEnabled()
  const notesButtonEnabledPromise = getStoredNotesButtonEnabled()
  const nspdButtonEnabledPromise = getStoredNspdButtonEnabled()
  return Promise.all([
    menuEnabledPromise,
    splitButtonEnabledPromise,
    notesButtonEnabledPromise,
    nspdButtonEnabledPromise,
  ])
}
