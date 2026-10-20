import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import {
  FEEDS_FILTER_ENABLED_STORAGE_KEY,
  getStoredFeedsFilterEnabled,
  setStoredFeedsFilterEnabled,
} from '@/lib/feeds_filter'

export const useFeedsFilter = () => {
  const [isEnabled, setIsEnabledState] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const abortController = new AbortController()
    setIsLoaded(false)

    const loadState = async () => {
      try {
        const enabled = await getStoredFeedsFilterEnabled()
        if (!abortController.signal.aborted) {
          setIsEnabledState(enabled)
          setIsLoaded(true)
        }
      } catch (error: unknown) {
        console.warn('[nmap_uploader] load FeedsFilter state failed:', error)
      }
    }

    loadState()

    return () => {
      abortController.abort()
    }
  }, [])

  useEffect(() => {
    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && FEEDS_FILTER_ENABLED_STORAGE_KEY in changes) {
        const nextValue = changes[FEEDS_FILTER_ENABLED_STORAGE_KEY]?.newValue
        if (typeof nextValue === 'boolean') {
          setIsEnabledState(nextValue)
        }
      }
    }

    browser.storage.onChanged.addListener(handleStorageChange)
    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const setIsEnabled = useCallback((enabled: boolean) => {
    const saveState = async () => {
      try {
        setIsEnabledState(enabled)
        await setStoredFeedsFilterEnabled(enabled)
      } catch (error: unknown) {
        console.warn('[nmap_uploader] save FeedsFilter state failed:', error)
      }
    }

    saveState()
  }, [])

  return { isEnabled, isLoaded, setIsEnabled }
}
