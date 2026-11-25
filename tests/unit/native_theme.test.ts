// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { observeNativeTheme, readNativeTheme } from '@/lib/native_theme'

type MediaListener = () => void

let prefersDark = false
let mediaListeners: MediaListener[] = []

const stubSystemTheme = (isDark: boolean): void => {
  prefersDark = isDark
  vi.stubGlobal('matchMedia', () => ({
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_event: string, listener: MediaListener) => {
      mediaListeners.push(listener)
    },
    removeEventListener: (_event: string, listener: MediaListener) => {
      mediaListeners = mediaListeners.filter((item) => item !== listener)
    },
  }))
}

const changeSystemTheme = (isDark: boolean): void => {
  prefersDark = isDark
  for (const listener of mediaListeners) listener()
}

describe('readNativeTheme', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    document.documentElement.className = ''
    mediaListeners = []
    stubSystemTheme(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('без класса темы берёт системную', () => {
    stubSystemTheme(true)
    expect(readNativeTheme()).toBe('dark')
  })

  it('читает явный класс тёмной темы', () => {
    const page = document.createElement('div')
    page.className = 'nk-page nk-page_color-scheme_dark'
    document.body.append(page)

    expect(readNativeTheme()).toBe('dark')
  })

  it('читает явный класс светлой темы даже при тёмной системе', () => {
    stubSystemTheme(true)
    const page = document.createElement('div')
    page.className = 'nk-page nk-page_color-scheme_light'
    document.body.append(page)

    expect(readNativeTheme()).toBe('light')
  })

  it('находит класс темы на корне документа', () => {
    document.documentElement.classList.add('nk-page_color-scheme_dark')

    expect(readNativeTheme()).toBe('dark')
  })
})

describe('observeNativeTheme', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    document.documentElement.className = ''
    mediaListeners = []
    stubSystemTheme(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('сообщает текущую тему сразу и реагирует на смену класса', async () => {
    const page = document.createElement('div')
    page.className = 'nk-page nk-page_color-scheme_light'
    document.body.append(page)

    const changes: string[] = []
    const stop = observeNativeTheme((theme) => changes.push(theme))

    expect(changes).toContain('light')

    page.classList.replace('nk-page_color-scheme_light', 'nk-page_color-scheme_dark')

    await vi.waitFor(() => expect(changes.at(-1)).toBe('dark'))
    stop()
  })

  it('реагирует на системную тему, пока класс редактора не задан', async () => {
    const page = document.createElement('div')
    page.className = 'nk-page'
    document.body.append(page)

    const changes: string[] = []
    const stop = observeNativeTheme((theme) => changes.push(theme))

    changeSystemTheme(true)

    await vi.waitFor(() => expect(changes.at(-1)).toBe('dark'))
    stop()
  })

  it('после отписки больше не сообщает', async () => {
    const page = document.createElement('div')
    page.className = 'nk-page nk-page_color-scheme_light'
    document.body.append(page)

    const changes: string[] = []
    const stop = observeNativeTheme((theme) => changes.push(theme))
    const initialLength = changes.length
    stop()

    page.classList.replace('nk-page_color-scheme_light', 'nk-page_color-scheme_dark')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(changes).toHaveLength(initialLength)
  })
})
