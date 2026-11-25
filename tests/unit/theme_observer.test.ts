// @vitest-environment happy-dom

/**
 * Панель заметок должна следовать за темой редактора.
 *
 * Регрессия: тема применялась один раз при загрузке iframe, а панель живёт
 * постоянно — после переключения на светлую она оставалась тёмной.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setNativeTheme } from '@/lib/theme'
import { applyThemeTo, observeTheme } from '@/lib/theme_bootstrap'

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

describe('observeTheme', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    vi.unstubAllGlobals()
  })

  it('сообщает текущую тему сразу при подписке', () => {
    stubSystemTheme(true)
    setNativeTheme('dark')

    const onChange = vi.fn()
    const stop = observeTheme(onChange)

    expect(onChange).toHaveBeenLastCalledWith(true)
    stop()
  })

  it('реагирует на смену темы редактора', () => {
    stubSystemTheme(false)
    setNativeTheme('light')

    const changes: boolean[] = []
    const stop = observeTheme((isDark) => changes.push(isDark))

    setNativeTheme('dark')
    expect(changes.at(-1)).toBe(true)

    setNativeTheme('light')
    expect(changes.at(-1)).toBe(false)
    stop()
  })

  it('после отписки больше не сообщает', () => {
    stubSystemTheme(false)
    setNativeTheme('light')

    const onChange = vi.fn()
    const stop = observeTheme(onChange)
    stop()

    setNativeTheme('dark')

    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('панель заметок и светлая тема', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    vi.unstubAllGlobals()
  })

  it('переключается с тёмной на светлую вместе с редактором', () => {
    stubSystemTheme(false)
    setNativeTheme('dark')

    const stop = observeTheme((isDark) => applyThemeTo(document.documentElement, isDark))

    expect(document.documentElement.classList.contains('dark')).toBe(true)

    setNativeTheme('light')

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    stop()
  })
})
