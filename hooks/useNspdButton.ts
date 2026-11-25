import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { notifyMapTabsAboutGoToMenu } from '@/lib/go_to_notify'
import { requestNspdHostAccess, syncNspdContentScripts } from '@/lib/nspd/content_scripts'
import {
  getStoredNspdButtonEnabled,
  NSPD_BUTTON_ENABLED_STORAGE_KEY,
  setStoredNspdButtonEnabled,
} from '@/lib/nspd/nspd_button'
import { requestYandexAccess } from '@/lib/yandex/disk_settings'

export type NspdPermissionDeniedReason = 'nspd' | 'yandex' | null

export function useNspdButton() {
  const [isEnabled, setIsEnabledState] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState<NspdPermissionDeniedReason>(null)

  useEffect(function getIsEnabledEffect() {
    const abortController = new AbortController()
    setIsLoaded(false)

    ;(async function getIsEnabled() {
      try {
        const enabled = await getStoredNspdButtonEnabled()
        if (!abortController.signal.aborted) {
          setIsEnabledState(enabled)
          setIsLoaded(true)
        }
      } catch (error: unknown) {
        console.warn('[yamapper] getNspdEnabled failed:', error)
      }
    })()

    return function cleanup() {
      abortController.abort()
    }
  }, [])

  useEffect(function handleStorageChangeEffect() {
    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && NSPD_BUTTON_ENABLED_STORAGE_KEY in changes) {
        const nextValue = changes[NSPD_BUTTON_ENABLED_STORAGE_KEY]?.newValue
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

  /**
   * Включает функцию после выдачи двух наборов разрешений.
   *
   * Первым — доступ к nspd.gov.ru (без него нет самой кнопки на сайте НСПД),
   * вторым — доступ к Яндексу: объекты из НСПД сохраняются в Блокнот на
   * Диске. Оба запроса идут из обработчика клика: вне жеста пользователя
   * браузер отклоняет `permissions.request`.
   */
  const setIsEnabled = useCallback(function setIsEnabledCallback(enabled: boolean) {
    ;(async function doAsync() {
      try {
        setPermissionDenied(null)

        if (enabled) {
          const hostGranted = await requestNspdHostAccess()
          if (!hostGranted) {
            setPermissionDenied('nspd')
            return
          }

          const yandexGranted = await requestYandexAccess()
          if (!yandexGranted) {
            setPermissionDenied('yandex')
            return
          }
        }

        setIsEnabledState(enabled)
        await setStoredNspdButtonEnabled(enabled)
        await syncNspdContentScripts(enabled)
        await notifyMapTabsAboutGoToMenu()
      } catch (error: unknown) {
        console.warn('[yamapper] nspd button setting save failed:', error)
      }
    })()
  }, [])

  return { isEnabled, isLoaded, setIsEnabled, permissionDenied }
}
