// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'
import { useNspdButton } from '@/hooks/useNspdButton'
import { NSPD_HOST_PATTERNS } from '@/lib/manifest/nspd_optional_hosts'
import {
  getStoredNspdButtonEnabled,
  NSPD_BUTTON_ENABLED_STORAGE_KEY,
  setStoredNspdButtonEnabled,
} from '@/lib/nspd/nspd_button'
import { permissionsMock, resetBrowserMocks, scriptingMock } from '../../setup/browser_mock'

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('useNspdButton', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  it('по умолчанию включена', async () => {
    await expect(getStoredNspdButtonEnabled()).resolves.toBe(true)
  })

  it('показывает включённую кнопку без сохранённой настройки', async () => {
    const { result } = renderHook(() => useNspdButton())
    await flushEffects()

    expect(result.current.isEnabled).toBe(true)
    expect(result.current.isLoaded).toBe(true)
  })

  it('при первом нажатии просит доступ, если его ещё нет, и сохраняет состояние', async () => {
    const { result } = renderHook(() => useNspdButton())
    await flushEffects()

    await act(async () => {
      result.current.setIsEnabled(true)
    })

    expect(permissionsMock.request).toHaveBeenCalledWith({ origins: [...NSPD_HOST_PATTERNS] })
    expect(result.current.isEnabled).toBe(true)
    expect(result.current.permissionDenied).toBe(false)
    await expect(getStoredNspdButtonEnabled()).resolves.toBe(true)
    expect([...scriptingMock.registered.keys()]).toHaveLength(2)
  })

  it('остаётся включённой, но сообщает об отказе, когда доступ не выдан', async () => {
    permissionsMock.denyNextRequest()
    const { result } = renderHook(() => useNspdButton())
    await flushEffects()

    await act(async () => {
      result.current.setIsEnabled(true)
    })

    // Кнопка по умолчанию включена: отказ в доступе не выключает саму настройку,
    // а предупреждение объясняет, почему переход в НСПД не сработает.
    expect(result.current.isEnabled).toBe(true)
    expect(result.current.permissionDenied).toBe(true)
    expect(scriptingMock.registered.size).toBe(0)
  })

  it('выключение не запрашивает доступ заново', async () => {
    permissionsMock.grant(...NSPD_HOST_PATTERNS)
    await setStoredNspdButtonEnabled(true)

    const { result } = renderHook(() => useNspdButton())
    await flushEffects()
    expect(result.current.isEnabled).toBe(true)

    await act(async () => {
      result.current.setIsEnabled(false)
    })

    expect(permissionsMock.request).not.toHaveBeenCalled()
    expect(result.current.isEnabled).toBe(false)
    await expect(getStoredNspdButtonEnabled()).resolves.toBe(false)
  })

  it('подхватывает изменение настройки из storage', async () => {
    const { result } = renderHook(() => useNspdButton())
    await flushEffects()

    await act(async () => {
      await browser.storage.local.set({ [NSPD_BUTTON_ENABLED_STORAGE_KEY]: true })
    })

    expect(result.current.isEnabled).toBe(true)
  })
})
