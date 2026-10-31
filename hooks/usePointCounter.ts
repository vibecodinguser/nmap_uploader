import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import {
  getStoredPointCounterEnabled,
  POINT_COUNTER_ENABLED_STORAGE_KEY,
  setStoredPointCounterEnabled,
} from '@/lib/point_counter'

export const usePointCounter = () => {
  const [isEnabled, setIsEnabledState] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(function loadStoredEnabledEffect() {
    const abortController = new AbortController()
    setIsLoaded(false)

    ;(async function loadStoredEnabled() {
      try {
        const enabled = await getStoredPointCounterEnabled()
        if (!abortController.signal.aborted) {
          setIsEnabledState(enabled)
          setIsLoaded(true)
        }
      } catch (error: unknown) {
        console.warn('[nmap_uploader] load point counter state failed:', error)
      }
    })()

    return function cleanup() {
      abortController.abort()
    }
  }, [])

  useEffect(function observeStorageChangeEffect() {
    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && POINT_COUNTER_ENABLED_STORAGE_KEY in changes) {
        const nextValue = changes[POINT_COUNTER_ENABLED_STORAGE_KEY]?.newValue
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
    ;(async function persistEnabled() {
      try {
        setIsEnabledState(enabled)
        await setStoredPointCounterEnabled(enabled)
      } catch (error: unknown) {
        console.warn('[nmap_uploader] save point counter state failed:', error)
      }
    })()
  }, [])

  return { isEnabled, isLoaded, setIsEnabled }
}

