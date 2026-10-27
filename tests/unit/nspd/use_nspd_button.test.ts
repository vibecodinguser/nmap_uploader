// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useNspdButton } from '@/hooks/useNspdButton'
import {
  getStoredNspdButtonEnabled,
  NSPD_BUTTON_ENABLED_STORAGE_KEY,
  setStoredNspdButtonEnabled,
} from '@/lib/nspd/nspd_button'
import { resetBrowserMocks } from '../../setup/browser_mock'

describe('useNspdButton', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  it('по умолчанию возвращает false', async () => {
    const enabled = await getStoredNspdButtonEnabled()
    expect(enabled).toBe(false)
  })

  it('хук useNspdButton инициализируется со значением false и сохраняет новое состояние', async () => {
    const { result } = renderHook(() => useNspdButton())

    await act(async () => {
      // ждём загрузки
    })

    expect(result.current.isEnabled).toBe(false)
    expect(result.current.isLoaded).toBe(true)

    await act(async () => {
      result.current.setIsEnabled(true)
    })

    expect(result.current.isEnabled).toBe(true)
    expect(await getStoredNspdButtonEnabled()).toBe(true)
  })
})
