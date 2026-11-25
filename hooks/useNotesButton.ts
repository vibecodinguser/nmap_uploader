import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { notifyMapTabsAboutGoToMenu } from '@/lib/go_to_notify'
import {
  getStoredNotesButtonEnabled,
  NOTES_BUTTON_ENABLED_STORAGE_KEY,
  setStoredNotesButtonEnabled,
} from '@/lib/notes_button'
import { requestYandexAccess } from '@/lib/yandex/disk_settings'

/**
 * Кнопка «Заметки».
 *
 * Включение требует разрешений браузера на Яндекс.Диск: без них ни загрузка
 * заметок, ни их сохранение невозможны. Запрос делается прямо в обработчике
 * клика — вне жеста пользователя браузер отклоняет `permissions.request`.
 */
export function useNotesButton() {
  // Стартовое значение совпадает с умолчанием в хранилище: иначе кнопка на
  // мгновение появлялась бы выключенной, пока идёт чтение настройки.
  const [isEnabled, setIsEnabledState] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(function getIsEnabledEffect() {
    const abortController = new AbortController()
    setIsLoaded(false)

    ;(async function getIsEnabled() {
      try {
        const enabled = await getStoredNotesButtonEnabled()
        if (!abortController.signal.aborted) {
          setIsEnabledState(enabled)
          setIsLoaded(true)
        }
      } catch (error: unknown) {
        console.warn('[yamapper] getIsEnabled failed:', error)
      }
    })()

    return function cleanup() {
      abortController.abort()
    }
  }, [])

  useEffect(function handleStorageChangeEffect() {
    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && NOTES_BUTTON_ENABLED_STORAGE_KEY in changes) {
        const nextValue = changes[NOTES_BUTTON_ENABLED_STORAGE_KEY]?.newValue
        if (typeof nextValue === 'boolean') {
          setIsEnabledState(nextValue)
        }
      }
    }

    browser.storage.onChanged.addListener(handleStorageChange)
    return function cleanup() {
      browser.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const setIsEnabled = useCallback(function setIsEnabledCallback(enabled: boolean) {
    void (async function doAsync() {
      try {
        setPermissionDenied(false)

        if (enabled) {
          const granted = await requestYandexAccess()
          if (!granted) {
            setPermissionDenied(true)
            return
          }
        }

        setIsEnabledState(enabled)
        await setStoredNotesButtonEnabled(enabled)
        await notifyMapTabsAboutGoToMenu()
      } catch (error: unknown) {
        console.warn('[yamapper] notes button setting save failed:', error)
      }
    })()
  }, [])

  return { isEnabled, isLoaded, setIsEnabled, permissionDenied }
}
