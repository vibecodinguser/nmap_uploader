import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import {
  getStoredExtensionThemeMode,
  normalizeThemeMode,
  setStoredExtensionThemeMode,
  syncThemeLocalToExtensionStorage,
  THEME_STORAGE_KEY,
} from '@/lib/theme'

describe('normalizeThemeMode', () => {
  it('принимает light, dark и system', () => {
    expect(normalizeThemeMode('light')).toBe('light')
    expect(normalizeThemeMode('dark')).toBe('dark')
    expect(normalizeThemeMode('system')).toBe('system')
  })

  it('возвращает system для неизвестного значения', () => {
    expect(normalizeThemeMode('sepia')).toBe('system')
    expect(normalizeThemeMode(undefined)).toBe('system')
  })
})

describe('extension theme storage', () => {
  beforeEach(async () => {
    await browser.storage.local.clear()
  })

  afterEach(async () => {
    await browser.storage.local.clear()
  })

  it('сохраняет и читает theme из browser.storage', async () => {
    await setStoredExtensionThemeMode('dark')
    await expect(getStoredExtensionThemeMode()).resolves.toBe('dark')
  })

  it('копирует theme из localStorage панели в browser.storage', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => 'light',
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: () => null,
    })

    await syncThemeLocalToExtensionStorage()
    const stored = await browser.storage.local.get(THEME_STORAGE_KEY)
    expect(stored[THEME_STORAGE_KEY]).toBe('light')

    vi.unstubAllGlobals()
  })
})
