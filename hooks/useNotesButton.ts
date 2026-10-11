import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { notifyMapTabsAboutGoToMenu } from '@/lib/go_to_notify'
import {
  getStoredNotesButtonEnabled,
  NOTES_BUTTON_ENABLED_STORAGE_KEY,
  setStoredNotesButtonEnabled,
} from '@/lib/notes_button'

export function useNotesButton() {
  const [isEnabled, setIsEnabledState] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)

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
        console.warn('[nmap_uploader] getIsEnabled failed:', error)
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
    ;(async function doAsync() {
      try {
        setIsEnabledState(enabled)
        await setStoredNotesButtonEnabled(enabled)
        await notifyMapTabsAboutGoToMenu()
      } catch (error: unknown) {
        console.warn('[nmap_uploader] notes button setting save failed:', error)
      }
    })()
  }, [])

  return { isEnabled, isLoaded, setIsEnabled }
}
