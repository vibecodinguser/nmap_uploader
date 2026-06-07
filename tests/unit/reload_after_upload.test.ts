import { beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'
import {
  getStoredReloadAfterUpload,
  LEGACY_RELOAD_AFTER_UPLOAD_STORAGE_KEY,
  RELOAD_AFTER_UPLOAD_BY_USER_STORAGE_KEY,
  setStoredReloadAfterUpload,
} from '@/lib/reload_after_upload'
import { resetBrowserMocks } from '../setup/browser_mock'

describe('reload_after_upload settings', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  it('хранит настройку отдельно для каждого пользователя', async () => {
    await setStoredReloadAfterUpload('user-a', true)
    await setStoredReloadAfterUpload('user-b', false)

    expect(await getStoredReloadAfterUpload('user-a')).toBe(true)
    expect(await getStoredReloadAfterUpload('user-b')).toBe(false)
  })

  it('восстанавливает настройку после повторного чтения', async () => {
    await setStoredReloadAfterUpload('user-a', true)

    expect(await getStoredReloadAfterUpload('user-a')).toBe(true)
  })

  it('мигрирует legacy-флаг в настройку текущего пользователя', async () => {
    await browser.storage.local.set({ [LEGACY_RELOAD_AFTER_UPLOAD_STORAGE_KEY]: true })

    expect(await getStoredReloadAfterUpload('user-a')).toBe(true)

    const stored = await browser.storage.local.get([
      LEGACY_RELOAD_AFTER_UPLOAD_STORAGE_KEY,
      RELOAD_AFTER_UPLOAD_BY_USER_STORAGE_KEY,
    ])

    expect(stored[LEGACY_RELOAD_AFTER_UPLOAD_STORAGE_KEY]).toBeUndefined()
    expect(stored[RELOAD_AFTER_UPLOAD_BY_USER_STORAGE_KEY]).toEqual({ 'user-a': true })
  })
})
