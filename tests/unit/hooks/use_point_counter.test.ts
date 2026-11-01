// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'
import { usePointCounter } from '@/hooks/usePointCounter'
import {
  POINT_COUNTER_ENABLED_STORAGE_KEY,
  setStoredPointCounterEnabled,
} from '@/lib/point_counter/storage'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'

describe('usePointCounter', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  it('по умолчанию загружается со значением true', async () => {
    const { result } = renderHook(() => usePointCounter())

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.isLoaded).toBe(true)
    expect(result.current.isEnabled).toBe(true)
  })

  it('загружает сохраненное значение false', async () => {
    await setStoredPointCounterEnabled(false)

    const { result } = renderHook(() => usePointCounter())

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.isLoaded).toBe(true)
    expect(result.current.isEnabled).toBe(false)
  })

  it('позволяет изменять состояние через setIsEnabled', async () => {
    const { result } = renderHook(() => usePointCounter())

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      result.current.setIsEnabled(false)
      await Promise.resolve()
    })

    expect(result.current.isEnabled).toBe(false)
    const stored = await browser.storage.local.get(POINT_COUNTER_ENABLED_STORAGE_KEY)
    expect(stored[POINT_COUNTER_ENABLED_STORAGE_KEY]).toBe(false)
  })
})
