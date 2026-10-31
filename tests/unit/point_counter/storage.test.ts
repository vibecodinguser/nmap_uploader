import { beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'
import {
  getStoredPointCounterEnabled,
  isPointCounterRequestMessage,
  isPointCounterStateMessage,
  POINT_COUNTER_ENABLED_STORAGE_KEY,
  POINT_COUNTER_REQUEST_MSG,
  POINT_COUNTER_STATE_MSG,
  setStoredPointCounterEnabled,
} from '@/lib/point_counter/storage'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'

describe('point_counter storage', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  it('по умолчанию возвращает true, если значение не установлено', async () => {
    const enabled = await getStoredPointCounterEnabled()
    expect(enabled).toBe(true)
  })

  it('сохраняет и считывает значение false', async () => {
    await setStoredPointCounterEnabled(false)
    const stored = await browser.storage.local.get(POINT_COUNTER_ENABLED_STORAGE_KEY)
    expect(stored[POINT_COUNTER_ENABLED_STORAGE_KEY]).toBe(false)

    const enabled = await getStoredPointCounterEnabled()
    expect(enabled).toBe(false)
  })

  it('сохраняет и считывает значение true', async () => {
    await setStoredPointCounterEnabled(false)
    await setStoredPointCounterEnabled(true)
    const enabled = await getStoredPointCounterEnabled()
    expect(enabled).toBe(true)
  })

  it('валидирует сообщения состояния', () => {
    expect(isPointCounterStateMessage({ type: POINT_COUNTER_STATE_MSG, enabled: false })).toBe(true)
    expect(isPointCounterStateMessage({ type: POINT_COUNTER_STATE_MSG, enabled: true })).toBe(true)
    expect(isPointCounterStateMessage({ type: 'other', enabled: true })).toBe(false)
    expect(isPointCounterStateMessage({ type: POINT_COUNTER_STATE_MSG })).toBe(false)
    expect(isPointCounterStateMessage(null)).toBe(false)
  })

  it('валидирует сообщения запроса состояния', () => {
    expect(isPointCounterRequestMessage({ type: POINT_COUNTER_REQUEST_MSG })).toBe(true)
    expect(isPointCounterRequestMessage({ type: 'other' })).toBe(false)
    expect(isPointCounterRequestMessage(undefined)).toBe(false)
  })
})

