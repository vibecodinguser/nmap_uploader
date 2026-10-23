// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'
import { useFeedsFilter } from '@/hooks/useFeedsFilter'
import {
  FEEDS_FILTER_ENABLED_STORAGE_KEY,
  getStoredFeedsFilterEnabled,
  setStoredFeedsFilterEnabled,
} from '@/lib/user_feeds_filter'
import { resetBrowserMocks } from '../../setup/browser_mock'

describe('feeds_filter storage and hook', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
    document.body.innerHTML = ''
  })

  it('по умолчанию возвращает false при отсутствии значения в хранилище', async () => {
    const enabled = await getStoredFeedsFilterEnabled()
    expect(enabled).toBe(false)
  })

  it('сохраняет и читает значение настройки', async () => {
    await setStoredFeedsFilterEnabled(false)
    expect(await getStoredFeedsFilterEnabled()).toBe(false)

    await setStoredFeedsFilterEnabled(true)
    expect(await getStoredFeedsFilterEnabled()).toBe(true)
  })

  it('корректно читает значение, установленное напрямую в storage', async () => {
    await browser.storage.local.set({ [FEEDS_FILTER_ENABLED_STORAGE_KEY]: true })
    expect(await getStoredFeedsFilterEnabled()).toBe(true)
  })

  it('хук useFeedsFilter инициализируется и сохраняет новое состояние', async () => {
    const { result } = renderHook(() => useFeedsFilter())

    await act(async () => {
      // ждём чтения из хранилища
    })

    expect(result.current.isEnabled).toBe(false)
    expect(result.current.isLoaded).toBe(true)

    await act(async () => {
      result.current.setIsEnabled(true)
    })

    expect(result.current.isEnabled).toBe(true)
    expect(await getStoredFeedsFilterEnabled()).toBe(true)
  })
})
