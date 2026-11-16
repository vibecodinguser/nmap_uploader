// @vitest-environment happy-dom

/**
 * Панель заметок должна следовать за темой, выбранной в боковой панели.
 *
 * Регрессия: тема применялась один раз при загрузке iframe, а панель живёт
 * постоянно — после переключения на светлую она оставалась тёмной.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { THEME_STORAGE_KEY } from '@/lib/theme'
import { applyThemeTo, observeStoredTheme } from '@/lib/theme_bootstrap'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'

const stubSystemTheme = (isDark: boolean): void => {
  vi.stubGlobal('matchMedia', () => ({
    matches: isDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('applyThemeTo', () => {
  it('ставит и снимает класс тёмной темы', () => {
    const root = document.documentElement

    applyThemeTo(root, true)
    expect(root.classList.contains('dark')).toBe(true)

    applyThemeTo(root, false)
    expect(root.classList.contains('dark')).toBe(false)
  })
})

describe('observeStoredTheme', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
    document.documentElement.className = ''
    vi.unstubAllGlobals()
  })

  it('сообщает о смене темы в storage', async () => {
    stubSystemTheme(false)
    const changes: boolean[] = []
    const stop = observeStoredTheme((isDark) => changes.push(isDark))

    await browser.storage.local.set({ [THEME_STORAGE_KEY]: 'dark' })
    await browser.storage.local.set({ [THEME_STORAGE_KEY]: 'light' })

    expect(changes).toContain(true)
    expect(changes.at(-1)).toBe(false)
    stop()
  })

  it('в режиме «как в системе» слушает системную тему', async () => {
    stubSystemTheme(true)
    const changes: boolean[] = []

    await browser.storage.local.set({ [THEME_STORAGE_KEY]: 'system' })
    const stop = observeStoredTheme((isDark) => changes.push(isDark))

    // Явный выбор светлой темы перекрывает тёмную системную.
    await browser.storage.local.set({ [THEME_STORAGE_KEY]: 'light' })

    expect(changes.at(-1)).toBe(false)
    stop()
  })

  it('после отписки больше не сообщает', async () => {
    stubSystemTheme(false)
    const onChange = vi.fn()
    const stop = observeStoredTheme(onChange)
    stop()

    await browser.storage.local.set({ [THEME_STORAGE_KEY]: 'dark' })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('поднимает сохранённую тему сразу при подписке', async () => {
    stubSystemTheme(false)
    await browser.storage.local.set({ [THEME_STORAGE_KEY]: 'dark' })

    const onChange = vi.fn()
    const stop = observeStoredTheme(onChange)

    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(true))
    stop()
  })
})

describe('панель заметок и светлая тема', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
    document.documentElement.className = ''
    vi.unstubAllGlobals()
    stubSystemTheme(true)
  })

  it('переключается с тёмной на светлую по выбору в боковой панели', async () => {
    await browser.storage.local.set({ [THEME_STORAGE_KEY]: 'dark' })
    const stop = observeStoredTheme((isDark) => applyThemeTo(document.documentElement, isDark))

    await vi.waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true))

    await browser.storage.local.set({ [THEME_STORAGE_KEY]: 'light' })

    await vi.waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(false))
    stop()
  })

  it('светлая тема не откатывается на системную', async () => {
    // Система тёмная, пользователь выбрал светлую: побеждает выбор пользователя.
    await browser.storage.local.set({ [THEME_STORAGE_KEY]: 'system' })
    const stop = observeStoredTheme((isDark) => applyThemeTo(document.documentElement, isDark))
    await vi.waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true))

    await browser.storage.local.set({ [THEME_STORAGE_KEY]: 'light' })

    await vi.waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(false))
    stop()
  })
})
