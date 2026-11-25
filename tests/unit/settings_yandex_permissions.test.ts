// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useNotesButton } from '@/hooks/useNotesButton'
import { useNspdButton } from '@/hooks/useNspdButton'
import { NSPD_HOST_PATTERNS } from '@/lib/manifest/nspd_optional_hosts'
import { YANDEX_PERMISSION_REQUEST } from '@/lib/manifest/yandex_optional_hosts'
import { getStoredNspdButtonEnabled } from '@/lib/nspd/nspd_button'
import { permissionsMock } from '@/tests/setup/browser_mock'

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('включение функций просит разрешения Яндекса', () => {
  it('«Заметки» спрашивает домены Яндекса и identity', async () => {
    permissionsMock.revoke(...YANDEX_PERMISSION_REQUEST.origins)
    const { result } = renderHook(() => useNotesButton())
    await flushEffects()

    await act(async () => {
      await result.current.setIsEnabled(true)
    })

    expect(permissionsMock.request).toHaveBeenCalledWith(YANDEX_PERMISSION_REQUEST)
    expect(result.current.permissionDenied).toBe(false)
  })

  it('«НСПД» сначала просит nspd.gov.ru, затем Яндекс', async () => {
    permissionsMock.revoke(...NSPD_HOST_PATTERNS, ...YANDEX_PERMISSION_REQUEST.origins)
    const { result } = renderHook(() => useNspdButton())
    await flushEffects()

    await act(async () => {
      await result.current.setIsEnabled(true)
    })

    const calls = permissionsMock.request.mock.calls.map(([request]) => request)
    expect(calls[0]?.origins).toEqual([...NSPD_HOST_PATTERNS])
    expect(calls[1]).toEqual(YANDEX_PERMISSION_REQUEST)
    await expect(getStoredNspdButtonEnabled()).resolves.toBe(true)
  })

  it('без доступа к Яндексу функция остаётся выключенной и сообщает об отказе', async () => {
    permissionsMock.revoke(...YANDEX_PERMISSION_REQUEST.origins)
    permissionsMock.denyNextRequest()
    const { result } = renderHook(() => useNotesButton())
    await flushEffects()

    await act(async () => {
      await result.current.setIsEnabled(true)
    })

    expect(result.current.permissionDenied).toBe(true)
  })
})
