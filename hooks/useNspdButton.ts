import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { notifyMapTabsAboutGoToMenu } from '@/lib/go_to_notify'
import { requestNspdHostAccess, syncNspdContentScripts } from '@/lib/nspd/content_scripts'
import {
  getStoredNspdButtonEnabled,
  NSPD_BUTTON_ENABLED_STORAGE_KEY,
  setStoredNspdButtonEnabled,
} from '@/lib/nspd/nspd_button'
import { hasYandexPermissions } from '@/lib/yandex/permissions'

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
   * Включает кнопку НСПД на сайте.
   *
   * Доступ к nspd.gov.ru обязателен: без него нет ни самой кнопки на сайте, ни
   * перехвата данных. Отказ оставляет тумблер выключенным и показывает подсказку.
   *
   * Доступ к Яндексу необязателен и не блокирует включение: кнопка на сайте
   * НСПД, выбор объекта и загрузка работают и без Диска — выгрузка в Блокнот
   * просто ответит `PERMISSION_REQUIRED`. Спрашивать Диск вторым диалогом здесь
   * же нельзя: жест пользователя живёт один стек вызовов, и второй
   * `permissions.request` после ожидания первого уже не считается жестом —
   * браузер отклоняет его без диалога. Поэтому Диск запрашивается отдельно, при
   * включении «Блокнота», а здесь только сообщаем, если он ещё не выдан.
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
        }

        setIsEnabledState(enabled)
        await setStoredNspdButtonEnabled(enabled)
        await syncNspdContentScripts(enabled)
        await notifyMapTabsAboutGoToMenu()

        // Функция уже работает; отсутствие Диска — подсказка, а не отказ.
        if (enabled && !(await hasYandexPermissions())) {
          setPermissionDenied('yandex')
        }
      } catch (error: unknown) {
        console.warn('[yamapper] nspd button setting save failed:', error)
      }
    })()
  }, [])

  return { isEnabled, isLoaded, setIsEnabled, permissionDenied }
}
