import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import {
  getStoredReloadAfterUpload,
  RELOAD_AFTER_UPLOAD_BY_USER_STORAGE_KEY,
  setStoredReloadAfterUpload,
} from '@/lib/reload_after_upload'

type StorageChanges = Record<string, { newValue?: unknown }>
type StorageChangeListener = (changes: StorageChanges, area: string) => void
type EnabledSetter = (enabled: boolean) => void
type LoadedSetter = (loaded: boolean) => void

type LoadEffectContext = {
  isCancelledRef: { current: boolean }
  setEnabled: EnabledSetter
  setLoaded: LoadedSetter
  userId: string
}

function readUserSetting(settings: unknown, userId: string): boolean | undefined {
  let result: boolean | undefined
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    const entry = (settings as Record<string, unknown>)[userId]
    if (typeof entry === 'boolean') {
      result = entry
    }
  }
  return result
}

function resetGuestState(setEnabled: EnabledSetter, setLoaded: LoadedSetter): void {
  setEnabled(false)
  setLoaded(true)
}

function onLoadSuccess(context: LoadEffectContext, enabled: boolean): void {
  if (!context.isCancelledRef.current) {
    context.setEnabled(enabled)
  }
}

function onLoadFinally(context: LoadEffectContext): void {
  if (!context.isCancelledRef.current) {
    context.setLoaded(true)
  }
}

function onLoadError(error: unknown): void {
  console.warn('[nmap_uploader] reload-after-upload setting load failed:', error)
}

async function loadStoredSetting(context: LoadEffectContext): Promise<void> {
  try {
    const enabled = await getStoredReloadAfterUpload(context.userId)
    onLoadSuccess(context, enabled)
  } catch (error: unknown) {
    onLoadError(error)
  } finally {
    onLoadFinally(context)
  }
}

function onLoadSettled(): void {
  // Promise completion handler; result is intentionally ignored.
}

function handleLoadTask(task: Promise<void>): void {
  task.then(onLoadSettled)
}

function cancelLoadEffect(isCancelledRef: { current: boolean }): void {
  isCancelledRef.current = true
}

function runLoadEffect(
  userId: string | undefined,
  setEnabled: EnabledSetter,
  setLoaded: LoadedSetter,
): () => void {
  let cleanup: () => void = noopCleanup
  if (userId) {
    const isCancelledRef = { current: false }
    const context: LoadEffectContext = {
      isCancelledRef,
      setEnabled,
      setLoaded,
      userId,
    }

    setLoaded(false)
    const loadTask = loadStoredSetting(context)
    handleLoadTask(loadTask)
    cleanup = cancelLoadEffect.bind(undefined, isCancelledRef)
  } else {
    resetGuestState(setEnabled, setLoaded)
  }
  return cleanup
}

function noopCleanup(): void {
  // Cleanup placeholder when userId is unavailable.
}

function applyStorageChange(
  changes: StorageChanges,
  userId: string,
  setEnabled: EnabledSetter,
): void {
  const hasChange = RELOAD_AFTER_UPLOAD_BY_USER_STORAGE_KEY in changes
  if (hasChange) {
    const nextValue = readUserSetting(
      changes[RELOAD_AFTER_UPLOAD_BY_USER_STORAGE_KEY]?.newValue,
      userId,
    )
    if (nextValue !== undefined) {
      setEnabled(nextValue)
    }
  }
}

function handleStorageChange(
  userId: string,
  setEnabled: EnabledSetter,
  changes: StorageChanges,
  area: string,
): void {
  if (area === 'local') {
    applyStorageChange(changes, userId, setEnabled)
  }
}

function unsubscribeStorage(listener: StorageChangeListener): void {
  browser.storage.onChanged.removeListener(listener)
}

function subscribeStorage(userId: string, setEnabled: EnabledSetter): () => void {
  const listener = handleStorageChange.bind(undefined, userId, setEnabled) as StorageChangeListener
  browser.storage.onChanged.addListener(listener)
  return unsubscribeStorage.bind(undefined, listener)
}

function runStorageEffect(userId: string | undefined, setEnabled: EnabledSetter): () => void {
  let cleanup: () => void = noopCleanup
  if (userId) {
    cleanup = subscribeStorage(userId, setEnabled)
  }
  return cleanup
}

function onSaveError(error: unknown): void {
  console.warn('[nmap_uploader] reload-after-upload setting save failed:', error)
}

function handleSaveTask(task: Promise<void>): void {
  task.catch(onSaveError)
}

export const useReloadAfterUpload = (userId: string | undefined) => {
  const [isEnabled, setIsEnabledState] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(
    function subscribeLoad(): () => void {
      return runLoadEffect(userId, setIsEnabledState, setIsLoaded)
    },
    [userId],
  )

  useEffect(
    function subscribeStorageChanges(): () => void {
      return runStorageEffect(userId, setIsEnabledState)
    },
    [userId],
  )

  const setIsEnabled = useCallback(
    function setEnabledPreference(enabled: boolean): void {
      if (userId) {
        setIsEnabledState(enabled)
        const saveTask = setStoredReloadAfterUpload(userId, enabled)
        handleSaveTask(saveTask)
      }
    },
    [userId],
  )

  return { isEnabled, isLoaded, setIsEnabled, canChange: Boolean(userId) }
}
