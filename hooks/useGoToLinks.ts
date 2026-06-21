import { useCallback, useEffect, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { notifyMapTabsAboutGoToMenu } from '@/lib/go_to_notify'
import {
  GO_TO_ITEMS_STORAGE_KEY,
  GO_TO_MENU_ENABLED_STORAGE_KEY,
  type GoToItem,
  getStoredGoToItems,
  getStoredGoToMenuEnabled,
  setStoredGoToItems,
  setStoredGoToMenuEnabled,
} from '@/lib/go_to_settings'

type StoredGoToState = {
  enabled: boolean
  items: GoToItem[]
}

type BooleanSetter = (value: boolean) => void

type GoToItemsSetter = (items: GoToItem[]) => void

type LoadedSetter = (value: boolean) => void

type LoadGenerationRef = {
  current: number
}

type LoadSuccessContext = {
  generation: number
  loadGenerationRef: LoadGenerationRef
  setEnabled: BooleanSetter
  setItems: GoToItemsSetter
}

type LoadFinallyContext = {
  generation: number
  loadGenerationRef: LoadGenerationRef
  setLoaded: LoadedSetter
}

type LoadEffectContext = LoadSuccessContext & LoadFinallyContext

type StorageChangeContext = {
  setEnabled: BooleanSetter
  setItems: GoToItemsSetter
}

type StorageChanges = Record<string, { newValue?: unknown }>

type StorageChangeListener = (changes: StorageChanges, area: string) => void

function isValidMoveIndex(items: GoToItem[], fromIndex: number, toIndex: number): boolean {
  const fromInRange = fromIndex >= 0 && fromIndex < items.length
  const toInRange = toIndex >= 0 && toIndex < items.length
  return fromInRange && toInRange
}

function moveItem(items: GoToItem[], fromIndex: number, toIndex: number): GoToItem[] {
  let result = items
  if (isValidMoveIndex(items, fromIndex, toIndex)) {
    const next = [...items]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    result = next
  }
  return result
}

async function loadStoredGoToState(): Promise<StoredGoToState> {
  const enabled = await getStoredGoToMenuEnabled()
  const storedItems = await getStoredGoToItems()
  return { enabled, items: storedItems }
}

function applyLoadedGoToState(
  state: StoredGoToState,
  setEnabled: BooleanSetter,
  setItems: GoToItemsSetter,
): void {
  setEnabled(state.enabled)
  setItems(state.items)
}

async function saveGoToMenuEnabled(enabled: boolean): Promise<void> {
  await setStoredGoToMenuEnabled(enabled)
  await notifyMapTabsAboutGoToMenu()
}

function onSaveMenuEnabledError(error: unknown): void {
  console.warn('[nmap_uploader] go-to menu setting save failed:', error)
}

async function saveGoToMenuEnabledSafely(enabled: boolean): Promise<void> {
  try {
    await saveGoToMenuEnabled(enabled)
  } catch (error: unknown) {
    onSaveMenuEnabledError(error)
  }
}

async function saveGoToItemsWithNotify(nextItems: GoToItem[]): Promise<void> {
  await setStoredGoToItems(nextItems)
  await notifyMapTabsAboutGoToMenu()
}

function onSaveGoToItemsError(error: unknown): void {
  console.warn('[nmap_uploader] go-to items save failed:', error)
}

async function saveGoToItemsSafely(nextItems: GoToItem[]): Promise<void> {
  try {
    await saveGoToItemsWithNotify(nextItems)
  } catch (error: unknown) {
    onSaveGoToItemsError(error)
  }
}

function onDetachedTaskComplete(): void {
  // Promise completion handler; result is intentionally ignored.
}

function handleDetachedTask(task: Promise<void>): void {
  task.then(onDetachedTaskComplete)
}

function applyMenuEnabledChange(changes: StorageChanges, setEnabled: BooleanSetter): void {
  const hasChange = GO_TO_MENU_ENABLED_STORAGE_KEY in changes
  if (hasChange) {
    const nextValue = changes[GO_TO_MENU_ENABLED_STORAGE_KEY]?.newValue
    if (typeof nextValue === 'boolean') {
      setEnabled(nextValue)
    }
  }
}

async function reloadStoredItems(setItems: GoToItemsSetter): Promise<void> {
  const nextItems = await getStoredGoToItems()
  setItems(nextItems)
}

function onReloadItemsError(error: unknown): void {
  console.warn('[nmap_uploader] go-to items reload failed:', error)
}

function handleReloadItemsTask(task: Promise<void>): void {
  task.catch(onReloadItemsError)
}

function applyItemsStorageChange(changes: StorageChanges, setItems: GoToItemsSetter): void {
  const hasChange = GO_TO_ITEMS_STORAGE_KEY in changes
  if (hasChange) {
    const reloadTask = reloadStoredItems(setItems)
    handleReloadItemsTask(reloadTask)
  }
}

function updateItemActive(items: GoToItem[], name: string, active: boolean): GoToItem[] {
  const result: GoToItem[] = []
  for (const item of items) {
    let updated = item
    if (item.name === name) {
      updated = { ...item, active }
    }
    result.push(updated)
  }
  return result
}

function getItemIndex(items: GoToItem[], name: string): number {
  let index = -1
  for (let i = 0; i < items.length && index < 0; i += 1) {
    if (items[i].name === name) {
      index = i
    }
  }
  return index
}

function getItemsMovedUp(items: GoToItem[], name: string): GoToItem[] | null {
  const index = getItemIndex(items, name)
  let result: GoToItem[] | null = null
  if (index > 0) {
    result = moveItem(items, index, index - 1)
  }
  return result
}

function getItemsMovedDown(items: GoToItem[], name: string): GoToItem[] | null {
  const index = getItemIndex(items, name)
  const lastIndex = items.length - 1
  let result: GoToItem[] | null = null
  if (index >= 0 && index < lastIndex) {
    result = moveItem(items, index, index + 1)
  }
  return result
}

function onLoadSuccess(context: LoadSuccessContext, state: StoredGoToState): void {
  if (context.loadGenerationRef.current === context.generation) {
    applyLoadedGoToState(state, context.setEnabled, context.setItems)
  }
}

function onLoadFinally(context: LoadFinallyContext): void {
  if (context.loadGenerationRef.current === context.generation) {
    context.setLoaded(true)
  }
}

async function executeGoToLinksLoad(context: LoadEffectContext): Promise<void> {
  try {
    const state = await loadStoredGoToState()
    onLoadSuccess(context, state)
  } finally {
    onLoadFinally(context)
  }
}

function cancelLoadEffect(loadGenerationRef: LoadGenerationRef): void {
  loadGenerationRef.current += 1
}

function unsubscribeGoToLinksLoad(loadGenerationRef: LoadGenerationRef): void {
  cancelLoadEffect(loadGenerationRef)
}

function runGoToLinksLoadEffect(
  loadGenerationRef: LoadGenerationRef,
  setEnabled: BooleanSetter,
  setItems: GoToItemsSetter,
  setLoaded: LoadedSetter,
): () => void {
  const generation = loadGenerationRef.current
  setLoaded(false)

  const context: LoadEffectContext = {
    generation,
    loadGenerationRef,
    setEnabled,
    setItems,
    setLoaded,
  }

  const loadTask = executeGoToLinksLoad(context)
  handleDetachedTask(loadTask)

  return unsubscribeGoToLinksLoad.bind(undefined, loadGenerationRef)
}

function handleStorageChange(
  context: StorageChangeContext,
  changes: StorageChanges,
  area: string,
): void {
  if (area === 'local') {
    applyMenuEnabledChange(changes, context.setEnabled)
    applyItemsStorageChange(changes, context.setItems)
  }
}

function unsubscribeGoToStorageChanges(listener: StorageChangeListener): void {
  browser.storage.onChanged.removeListener(listener)
}

function subscribeGoToStorageChanges(
  setEnabled: BooleanSetter,
  setItems: GoToItemsSetter,
): () => void {
  const context: StorageChangeContext = { setEnabled, setItems }
  const listener = handleStorageChange.bind(undefined, context) as StorageChangeListener
  browser.storage.onChanged.addListener(listener)
  return unsubscribeGoToStorageChanges.bind(undefined, listener)
}

export function useGoToLinks() {
  const loadGenerationRef = useRef(0)
  const [isMenuEnabled, setIsMenuEnabledState] = useState(true)
  const [items, setItemsState] = useState<GoToItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(function subscribeGoToLinksLoad(): () => void {
    return runGoToLinksLoadEffect(
      loadGenerationRef,
      setIsMenuEnabledState,
      setItemsState,
      setIsLoaded,
    )
  }, [])

  useEffect(function subscribeGoToStorageChangesEffect(): () => void {
    return subscribeGoToStorageChanges(setIsMenuEnabledState, setItemsState)
  }, [])

  const setIsMenuEnabled = useCallback(function setIsMenuEnabled(enabled: boolean): void {
    setIsMenuEnabledState(enabled)
    const saveTask = saveGoToMenuEnabledSafely(enabled)
    handleDetachedTask(saveTask)
  }, [])

  const persistItems = useCallback(function persistItems(nextItems: GoToItem[]): void {
    setItemsState(nextItems)
    const saveTask = saveGoToItemsSafely(nextItems)
    handleDetachedTask(saveTask)
  }, [])

  const setItemActive = useCallback(
    function setItemActive(name: string, active: boolean): void {
      const nextItems = updateItemActive(items, name, active)
      persistItems(nextItems)
    },
    [items, persistItems],
  )

  const moveItemUp = useCallback(
    function moveItemUp(name: string): void {
      const nextItems = getItemsMovedUp(items, name)
      if (nextItems !== null) {
        persistItems(nextItems)
      }
    },
    [items, persistItems],
  )

  const moveItemDown = useCallback(
    function moveItemDown(name: string): void {
      const nextItems = getItemsMovedDown(items, name)
      if (nextItems !== null) {
        persistItems(nextItems)
      }
    },
    [items, persistItems],
  )

  return {
    isMenuEnabled,
    items,
    isLoaded,
    setIsMenuEnabled,
    setItemActive,
    moveItemUp,
    moveItemDown,
  }
}
