import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { notifyMapTabsAboutGoToMenu } from '@/lib/go_to_notify'
import {
  GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY,
  getStoredSplitButtonEnabled,
  setStoredSplitButtonEnabled,
} from '@/lib/go_to_split_button'

export function useSplitViewButton() {
  const [isEnabled, setIsEnabledState] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(function getIsEnabledEffect() {
    const abortController = new AbortController()
    setIsLoaded(false)

    ;(async function getIsEnabled() {
      try {
        const enabled = await getStoredSplitButtonEnabled()
        if (!abortController.signal.aborted) {
          setIsEnabledState(enabled)
          setIsLoaded(true)
        }
      } catch (error: unknown) {
        console.warn('[nmap_uploader] getIsEnabled failed:', error)
      }
    })()

    return function cleanup() {
      abortController.abort()
    }
  }, [])

  useEffect(function handleStorageChangeEffect() {
    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY in changes) {
        const nextValue = changes[GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]?.newValue
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
    ;(async function doAsync() {
      try {
        setIsEnabledState(enabled)
        await setStoredSplitButtonEnabled(enabled)
        await notifyMapTabsAboutGoToMenu()
      } catch (error: unknown) {
        console.warn('[nmap_uploader] split view button setting save failed:', error)
      }
    })()
  }, [])

  return { isEnabled, isLoaded, setIsEnabled }
}
