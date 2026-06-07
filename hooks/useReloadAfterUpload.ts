import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import {
  getStoredReloadAfterUpload,
  RELOAD_AFTER_UPLOAD_BY_USER_STORAGE_KEY,
  setStoredReloadAfterUpload,
} from '@/lib/reload_after_upload'

const readUserSetting = (settings: unknown, userId: string): boolean | undefined => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return undefined
  const value = (settings as Record<string, unknown>)[userId]
  return typeof value === 'boolean' ? value : undefined
}

export const useReloadAfterUpload = (userId: string | undefined) => {
  const [isEnabled, setIsEnabledState] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!userId) {
      setIsEnabledState(false)
      setIsLoaded(true)
      return
    }

    let isCancelled = false
    setIsLoaded(false)

    getStoredReloadAfterUpload(userId)
      .then((enabled) => {
        if (!isCancelled) setIsEnabledState(enabled)
      })
      .finally(() => {
        if (!isCancelled) setIsLoaded(true)
      })

    return () => {
      isCancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local' || !(RELOAD_AFTER_UPLOAD_BY_USER_STORAGE_KEY in changes)) return

      const nextValue = readUserSetting(
        changes[RELOAD_AFTER_UPLOAD_BY_USER_STORAGE_KEY]?.newValue,
        userId,
      )
      if (nextValue === undefined) return
      setIsEnabledState(nextValue)
    }

    browser.storage.onChanged.addListener(handleStorageChange)
    return () => browser.storage.onChanged.removeListener(handleStorageChange)
  }, [userId])

  const setIsEnabled = useCallback(
    (enabled: boolean) => {
      if (!userId) return

      setIsEnabledState(enabled)
      setStoredReloadAfterUpload(userId, enabled).catch((error: unknown) => {
        console.warn('[nmap_uploader] reload-after-upload setting save failed:', error)
      })
    },
    [userId],
  )

  return { isEnabled, isLoaded, setIsEnabled, canChange: Boolean(userId) }
}
