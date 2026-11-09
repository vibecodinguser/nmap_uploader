import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import {
  getTrackerSettings,
  setTrackerEnabled,
  TRACKER_ENABLED_KEY,
} from '@/lib/object_tracker/storage'
import type { TrackerSettings } from '@/lib/object_tracker/types'

/** Тумблер «Наблюдение за объектами». */
export const useObjectTracker = () => {
  const [isEnabled, setIsEnabledState] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(function loadStateEffect() {
    const abortController = new AbortController()
    setIsLoaded(false)

    const load = async () => {
      try {
        const settings: TrackerSettings = await getTrackerSettings()
        if (!abortController.signal.aborted) {
          setIsEnabledState(settings.enabled)
          setIsLoaded(true)
        }
      } catch (error: unknown) {
        console.warn('[nmap_uploader] load object tracker state failed:', error)
      }
    }

    void load()

    return function cleanup() {
      abortController.abort()
    }
  }, [])

  useEffect(function handleStorageChangeEffect() {
    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'sync') {
        return
      }
      if (TRACKER_ENABLED_KEY in changes) {
        const nextValue = changes[TRACKER_ENABLED_KEY]?.newValue
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
    ;(async function save() {
      try {
        setIsEnabledState(enabled)
        await setTrackerEnabled(enabled)
      } catch (error: unknown) {
        console.warn('[nmap_uploader] save object tracker state failed:', error)
      }
    })()
  }, [])

  return { isEnabled, isLoaded, setIsEnabled }
}
