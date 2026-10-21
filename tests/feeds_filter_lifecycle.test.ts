// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FEEDS_FILTER_ENABLED_STORAGE_KEY,
  FEEDS_FILTER_SELECT_ID,
  FeedFilterLifecycleManager,
} from '@/lib/feeds_filter'

describe('FeedFilterLifecycleManager', () => {
  let manager: FeedFilterLifecycleManager
  let storageCallbacks: Array<
    (changes: Record<string, { newValue?: unknown }>, area: string) => void
  > = []

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

  beforeEach(() => {
    vi.useFakeTimers()
    storageCallbacks = []
    document.body.innerHTML = ''
    manager = new FeedFilterLifecycleManager({ storage: mockStorage })
  })

  afterEach(() => {
    manager.stop()
    vi.clearAllTimers()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('корректно инициализируется и выключается по умолчанию', () => {
    expect(manager.isEnabled()).toBe(false)
  })

  it('при включении монтирует селект, если в DOM есть контейнер ленты с выбранным режимом "Правки"', () => {
    document.body.innerHTML = `
      <div class="nk-user-feeds-view">
        <div class="nk-select">
          <span class="nk-select__text">Правки</span>
        </div>
      </div>
    `

    manager.setFeatureEnabled(true)
    expect(manager.isEnabled()).toBe(true)
    expect(document.getElementById(FEEDS_FILTER_SELECT_ID)).not.toBeNull()
  })

  it('при выключении удаляет селект из DOM', () => {
    document.body.innerHTML = `
      <div class="nk-user-feeds-view">
        <div class="nk-select">
          <span class="nk-select__text">Правки</span>
        </div>
      </div>
    `

    manager.setFeatureEnabled(true)
    expect(document.getElementById(FEEDS_FILTER_SELECT_ID)).not.toBeNull()

    manager.setFeatureEnabled(false)
    expect(document.getElementById(FEEDS_FILTER_SELECT_ID)).toBeNull()
  })

  it('реагирует на события хранилища browser.storage.onChanged', () => {
    document.body.innerHTML = `
      <div class="nk-user-feeds-view">
        <div class="nk-select">
          <span class="nk-select__text">Правки</span>
        </div>
      </div>
    `

    manager.start()

    // Симулируем изменение в storage
    for (const cb of storageCallbacks) {
      cb({ [FEEDS_FILTER_ENABLED_STORAGE_KEY]: { newValue: true } }, 'local')
    }

    expect(manager.isEnabled()).toBe(true)
    expect(document.getElementById(FEEDS_FILTER_SELECT_ID)).not.toBeNull()

    // Симулируем выключение
    for (const cb of storageCallbacks) {
      cb({ [FEEDS_FILTER_ENABLED_STORAGE_KEY]: { newValue: false } }, 'local')
    }

    expect(manager.isEnabled()).toBe(false)
    expect(document.getElementById(FEEDS_FILTER_SELECT_ID)).toBeNull()
  })
})
