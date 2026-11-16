import { useEffect } from 'react'
import { browser } from 'wxt/browser'
import { STORAGE_TOKEN_KEY, STORAGE_USER_KEY } from '@/lib/yandex/constants'
import type { NotesPanelStore } from './useNotesPanelState'

/**
 * Перечитывание снимка, когда меняется вход или вкладка возвращается в фокус.
 *
 * Панель живёт в постоянно смонтированном iframe: без этих подписок она
 * навсегда осталась бы в состоянии, в котором открылась.
 */
export const useNotesAutoReload = (
  { dispatch }: NotesPanelStore,
  loadNotes: (options?: { silent?: boolean }) => void,
) => {
  /** Вход в Яндекс меняет токен в `storage.local`. */
  useEffect(() => {
    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ): void => {
      if (area !== 'local') return
      if (!(STORAGE_TOKEN_KEY in changes) && !(STORAGE_USER_KEY in changes)) return

      const token = changes[STORAGE_TOKEN_KEY]?.newValue
      if (typeof token === 'string' && token) {
        loadNotes({ silent: true })
        return
      }
      dispatch({ type: 'statusChanged', status: 'auth' })
      dispatch({ type: 'snapshotCleared' })
    }

    browser.storage.onChanged.addListener(handleStorageChange)
    return () => browser.storage.onChanged.removeListener(handleStorageChange)
  }, [dispatch, loadNotes])

  /**
   * Страховка на случай пропущенного события storage.
   *
   * Панель скрыта через `display: none` у контейнера, поэтому при показе
   * документ снова становится видимым — это хороший момент перечитать данные.
   */
  useEffect(() => {
    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') loadNotes({ silent: true })
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [loadNotes])
}
