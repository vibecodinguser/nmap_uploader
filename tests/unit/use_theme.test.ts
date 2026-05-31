import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getStoredThemeMode, getSystemTheme, resolveTheme } from '@/hooks/useTheme'

const STORAGE_KEY = 'theme'

const createLocalStorageMock = () => {
  const store = new Map<string, string>()

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
}

const mockSystemPrefersDark = (prefersDark: boolean) => {
  const matchMedia = vi.fn((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

  vi.stubGlobal('window', { matchMedia })
  vi.stubGlobal('matchMedia', matchMedia)
}

describe('getStoredThemeMode', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('возвращает light, dark и system из localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'light')
    expect(getStoredThemeMode()).toBe('light')

    localStorage.setItem(STORAGE_KEY, 'dark')
    expect(getStoredThemeMode()).toBe('dark')

    localStorage.setItem(STORAGE_KEY, 'system')
    expect(getStoredThemeMode()).toBe('system')
  })

  it('возвращает system при отсутствии значения', () => {
    expect(getStoredThemeMode()).toBe('system')
  })

  it('возвращает system для неизвестного значения', () => {
    localStorage.setItem(STORAGE_KEY, 'sepia')
    expect(getStoredThemeMode()).toBe('system')
  })
})

describe('getSystemTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('возвращает dark при системной тёмной теме', () => {
    mockSystemPrefersDark(true)
    expect(getSystemTheme()).toBe('dark')
  })

  it('возвращает light при системной светлой теме', () => {
    mockSystemPrefersDark(false)
    expect(getSystemTheme()).toBe('light')
  })
})

describe('resolveTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('возвращает light и dark без обращения к системе', () => {
    mockSystemPrefersDark(true)
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('в system-режиме использует системную тему', () => {
    mockSystemPrefersDark(true)
    expect(resolveTheme('system')).toBe('dark')

    mockSystemPrefersDark(false)
    expect(resolveTheme('system')).toBe('light')
  })
})
