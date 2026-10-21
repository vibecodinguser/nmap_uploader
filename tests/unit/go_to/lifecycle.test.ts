// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoToToolbarLifecycleManager, hasGoToRefreshStorageChange } from '@/lib/go_to'
import { GO_TO_ITEMS_STORAGE_KEY, GO_TO_MENU_ENABLED_STORAGE_KEY } from '@/lib/go_to_settings'

describe('GoToToolbarLifecycleManager', () => {
  let manager: GoToToolbarLifecycleManager
  let storageCallbacks: Array<
    (changes: Record<string, { newValue?: unknown }>, area: string) => void
  > = []
  let runtimeCallbacks: Array<(message: { action?: string }) => void> = []

  const mockStorage = {
    onChanged: {
      addListener: (
        cb: (changes: Record<string, { newValue?: unknown }>, area: string) => void,
      ) => {
        storageCallbacks.push(cb)
      },
      removeListener: (
        cb: (changes: Record<string, { newValue?: unknown }>, area: string) => void,
      ) => {
        storageCallbacks = storageCallbacks.filter((c) => c !== cb)
      },
    },
  }

  const mockRuntime = {
    onMessage: {
      addListener: (cb: (message: { action?: string }) => void) => {
        runtimeCallbacks.push(cb)
      },
      removeListener: (cb: (message: { action?: string }) => void) => {
        runtimeCallbacks = runtimeCallbacks.filter((c) => c !== cb)
      },
    },
  }

  beforeEach(() => {
    document.body.innerHTML = ''
    storageCallbacks = []
    runtimeCallbacks = []
    manager = new GoToToolbarLifecycleManager({
      storage: mockStorage,
      runtime: mockRuntime,
    })
  })

  afterEach(() => {
    manager.stop()
    document.body.innerHTML = ''
  })

  describe('hasGoToRefreshStorageChange', () => {
    it('возвращает true при изменении настроек меню или элементов', () => {
      expect(
        hasGoToRefreshStorageChange({ [GO_TO_MENU_ENABLED_STORAGE_KEY]: { newValue: true } }),
      ).toBe(true)
      expect(hasGoToRefreshStorageChange({ [GO_TO_ITEMS_STORAGE_KEY]: { newValue: [] } })).toBe(
        true,
      )
    })

    it('возвращает false для нерелевантных ключей', () => {
      expect(hasGoToRefreshStorageChange({ other_key: { newValue: 123 } })).toBe(false)
    })
  })

  describe('lifecycle management', () => {
    it('запускается и регистрирует слушатели хранилища и рантайма', async () => {
      await manager.start()
      expect(storageCallbacks.length).toBe(1)
      expect(runtimeCallbacks.length).toBe(1)

      manager.stop()
      expect(storageCallbacks.length).toBe(0)
      expect(runtimeCallbacks.length).toBe(0)
    })
  })
})
