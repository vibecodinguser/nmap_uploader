// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import {
  applyTrackerTheme,
  createTrackerThemeController,
  resolveTrackerPalette,
  TRACKER_DARK_CLASS,
  TRACKER_PALETTE_DARK,
  TRACKER_PALETTE_LIGHT,
} from '@/lib/object_tracker/ui/theme'
import { THEME_STORAGE_KEY } from '@/lib/theme'
import { resetBrowserMocks } from '../../setup/browser_mock'

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('object_tracker: палитра темы', () => {
  it('возвращает светлую палитру для light', () => {
    expect(resolveTrackerPalette('light')).toBe(TRACKER_PALETTE_LIGHT)
  })

  it('возвращает тёмную палитру для dark', () => {
    expect(resolveTrackerPalette('dark')).toBe(TRACKER_PALETTE_DARK)
  })

  it('тёмная палитра использует поверхность редактора', () => {
    expect(TRACKER_PALETTE_DARK.background).toBe('#45464f')
    expect(TRACKER_PALETTE_LIGHT.background).toBe('#ffffff')
  })
})

describe('object_tracker: applyTrackerTheme', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('проставляет CSS-переменные светлой темы', () => {
    const panel = document.createElement('div')

    applyTrackerTheme(panel, 'light')

    expect(panel.style.getPropertyValue('--nmap-ot-bg')).toBe('#ffffff')
    expect(panel.style.getPropertyValue('--nmap-ot-fg')).toBe('#000000')
    expect(panel.classList.contains(TRACKER_DARK_CLASS)).toBe(false)
    expect(panel.style.getPropertyValue('color-scheme')).toBe('light')
  })

  it('проставляет CSS-переменные тёмной темы и класс', () => {
    const panel = document.createElement('div')

    applyTrackerTheme(panel, 'dark')

    expect(panel.style.getPropertyValue('--nmap-ot-bg')).toBe('#45464f')
    expect(panel.style.getPropertyValue('--nmap-ot-fg')).toBe('#ededed')
    expect(panel.classList.contains(TRACKER_DARK_CLASS)).toBe(true)
    expect(panel.style.getPropertyValue('color-scheme')).toBe('dark')
  })

  it('перекрашивает панель при смене темы', () => {
    const panel = document.createElement('div')

    applyTrackerTheme(panel, 'dark')
    applyTrackerTheme(panel, 'light')

    expect(panel.style.getPropertyValue('--nmap-ot-bg')).toBe('#ffffff')
    expect(panel.classList.contains(TRACKER_DARK_CLASS)).toBe(false)
  })
})

describe('object_tracker: контроллер темы', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
    await browser.storage.local.clear()
    vi.restoreAllMocks()
  })

  it('стартует с системной темы', () => {
    const controller = createTrackerThemeController({ initialMode: 'dark' })

    expect(controller.getTheme()).toBe('dark')
  })

  it('применяет тему к панели', () => {
    const panel = document.createElement('div')
    const controller = createTrackerThemeController({ initialMode: 'light' })

    controller.apply(panel)

    expect(panel.style.getPropertyValue('--nmap-ot-bg')).toBe('#ffffff')
  })

  it('реагирует на смену темы в настройках расширения', async () => {
    const controller = createTrackerThemeController({ initialMode: 'light' })
    const onChange = vi.fn()
    const dispose = controller.observe(onChange)
    await flush()

    await browser.storage.local.set({ [THEME_STORAGE_KEY]: 'dark' })
    await flush()

    expect(controller.getTheme()).toBe('dark')
    expect(onChange).toHaveBeenCalled()
    dispose()
  })

  it('не дёргает обработчик, если тема не изменилась', async () => {
    const controller = createTrackerThemeController({ initialMode: 'light' })
    const onChange = vi.fn()
    const dispose = controller.observe(onChange)
    await flush()
    onChange.mockClear()

    await browser.storage.local.set({ [THEME_STORAGE_KEY]: 'light' })
    await flush()

    expect(onChange).not.toHaveBeenCalled()
    dispose()
  })

  it('снимает подписку', async () => {
    const controller = createTrackerThemeController({ initialMode: 'light' })
    const onChange = vi.fn()
    const dispose = controller.observe(onChange)
    await flush()
    dispose()
    onChange.mockClear()

    await browser.storage.local.set({ [THEME_STORAGE_KEY]: 'dark' })
    await flush()

    expect(onChange).not.toHaveBeenCalled()
  })
})
