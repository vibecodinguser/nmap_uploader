import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { notifyMapTabsAboutGoToMenu } from '@/lib/go_to_notify'
import {
  GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY,
  getStoredSplitButtonEnabled,
  setStoredSplitButtonEnabled,
} from '@/lib/go_to_split_button'

export const useSplitViewButton = () => {
  const [isEnabled, setIsEnabledState] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let isCancelled = false
    setIsLoaded(false)

    getStoredSplitButtonEnabled()
      .then((enabled) => {
        if (!isCancelled) setIsEnabledState(enabled)
      })
      .finally(() => {
        if (!isCancelled) setIsLoaded(true)
      })

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local') return
      if (!(GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY in changes)) return

      const nextValue = changes[GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]?.newValue
      if (typeof nextValue === 'boolean') setIsEnabledState(nextValue)
    }

    browser.storage.onChanged.addListener(handleStorageChange)
    return () => browser.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  const setIsEnabled = useCallback((enabled: boolean) => {
    setIsEnabledState(enabled)
    setStoredSplitButtonEnabled(enabled)
      .then(() => notifyMapTabsAboutGoToMenu())
      .catch((error: unknown) => {
        console.warn('[nmap_uploader] split view button setting save failed:', error)
      })
  }, [])

  return { isEnabled, isLoaded, setIsEnabled }
}
