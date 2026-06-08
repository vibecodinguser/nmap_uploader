import { useCallback, useEffect, useState } from 'react'
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

const moveItem = (items: GoToItem[], fromIndex: number, toIndex: number): GoToItem[] => {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items
  }

  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export const useGoToLinks = () => {
  const [isMenuEnabled, setIsMenuEnabledState] = useState(true)
  const [items, setItemsState] = useState<GoToItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let isCancelled = false
    setIsLoaded(false)

    Promise.all([getStoredGoToMenuEnabled(), getStoredGoToItems()])
      .then(([enabled, storedItems]) => {
        if (isCancelled) return
        setIsMenuEnabledState(enabled)
        setItemsState(storedItems)
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

      if (GO_TO_MENU_ENABLED_STORAGE_KEY in changes) {
        const nextValue = changes[GO_TO_MENU_ENABLED_STORAGE_KEY]?.newValue
        if (typeof nextValue === 'boolean') setIsMenuEnabledState(nextValue)
      }

      if (GO_TO_ITEMS_STORAGE_KEY in changes) {
        void getStoredGoToItems().then((nextItems) => {
          setItemsState(nextItems)
        })
      }
    }

    browser.storage.onChanged.addListener(handleStorageChange)
    return () => browser.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  const setIsMenuEnabled = useCallback((enabled: boolean) => {
    setIsMenuEnabledState(enabled)
    setStoredGoToMenuEnabled(enabled)
      .then(() => notifyMapTabsAboutGoToMenu())
      .catch((error: unknown) => {
        console.warn('[nmap_uploader] go-to menu setting save failed:', error)
      })
  }, [])

  const persistItems = useCallback((nextItems: GoToItem[]) => {
    setItemsState(nextItems)
    setStoredGoToItems(nextItems)
      .then(() => notifyMapTabsAboutGoToMenu())
      .catch((error: unknown) => {
        console.warn('[nmap_uploader] go-to items save failed:', error)
      })
  }, [])

  const setItemActive = useCallback(
    (name: string, active: boolean) => {
      persistItems(items.map((item) => (item.name === name ? { ...item, active } : item)))
    },
    [items, persistItems],
  )

  const moveItemUp = useCallback(
    (name: string) => {
      const index = items.findIndex((item) => item.name === name)
      if (index <= 0) return
      persistItems(moveItem(items, index, index - 1))
    },
    [items, persistItems],
  )

  const moveItemDown = useCallback(
    (name: string) => {
      const index = items.findIndex((item) => item.name === name)
      if (index < 0 || index >= items.length - 1) return
      persistItems(moveItem(items, index, index + 1))
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
