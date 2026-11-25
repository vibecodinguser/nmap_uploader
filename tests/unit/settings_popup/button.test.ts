// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureSettingsButton,
  getSettingsButton,
  SETTINGS_APP_BAR_SELECTOR,
  SETTINGS_BUTTON_CLASS,
  SETTINGS_BUTTON_OWN_CLASS,
  syncSettingsButtonPressed,
} from '@/lib/settings_popup/button'
import { SETTINGS_BUTTON_ID } from '@/lib/settings_popup/protocol'

const renderAppBar = (): HTMLElement => {
  document.body.innerHTML = `
    <header class="nk-header-view">
      <div class="nk-app-bar-view">
        <button type="button" class="nk-button nk-help-view">?</button>
      </div>
    </header>
  `
  const bar = document.querySelector<HTMLElement>(SETTINGS_APP_BAR_SELECTOR)
  if (!bar) throw new Error('app bar not rendered')
  return bar
}

beforeEach(() => {
  document.body.replaceChildren()
})

afterEach(() => {
  document.body.replaceChildren()
})

describe('кнопка настроек в шапке редактора', () => {
  it('встаёт последней в nk-app-bar-view и берёт нативные классы кнопки', () => {
    const bar = renderAppBar()

    const button = ensureSettingsButton({ locale: 'ru', onClick: () => {} })

    expect(button).not.toBeNull()
    expect(bar.lastElementChild).toBe(button)
    expect(button?.classList.contains('nk-button')).toBe(true)
    expect(button?.classList.contains('nk-button_theme_air')).toBe(true)
    expect(button?.classList.contains('nk-button_size_xl')).toBe(true)
    expect(button?.classList.contains(SETTINGS_BUTTON_OWN_CLASS)).toBe(true)
    expect(SETTINGS_BUTTON_CLASS).toBe('nk-button nk-button_theme_air nk-button_size_xl')
    expect(button?.id).toBe(SETTINGS_BUTTON_ID)
    expect(button?.querySelector('.nk-icon svg')).not.toBeNull()
  })

  it('не создаёт дубликат при повторной синхронизации', () => {
    renderAppBar()

    ensureSettingsButton({ locale: 'ru', onClick: () => {} })
    ensureSettingsButton({ locale: 'ru', onClick: () => {} })

    expect(document.querySelectorAll(`#${SETTINGS_BUTTON_ID}`)).toHaveLength(1)
  })

  it('возвращает кнопку в шапку, если её оттуда выбросило', () => {
    renderAppBar()
    const button = ensureSettingsButton({ locale: 'ru', onClick: () => {} })
    const bar = document.querySelector<HTMLElement>(SETTINGS_APP_BAR_SELECTOR)
    button?.remove()

    const restored = ensureSettingsButton({ locale: 'ru', onClick: () => {} })

    expect(restored?.id).toBe(SETTINGS_BUTTON_ID)
    expect(bar?.contains(restored ?? null)).toBe(true)
  })

  it('не создаёт кнопку, когда шапки нет', () => {
    document.body.innerHTML = '<div class="nk-map-region-view"></div>'

    expect(ensureSettingsButton({ locale: 'ru', onClick: () => {} })).toBeNull()
    expect(getSettingsButton()).toBeNull()
  })

  it('клик вызывает обработчик один раз и переключает aria-expanded', () => {
    renderAppBar()
    const onClick = vi.fn()

    const button = ensureSettingsButton({ locale: 'ru', onClick })
    button?.click()

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(button?.getAttribute('aria-expanded')).toBe('false')

    syncSettingsButtonPressed(true)
    expect(button?.getAttribute('aria-expanded')).toBe('true')
  })

  it('подпись приходит из локали', () => {
    renderAppBar()

    const ru = ensureSettingsButton({ locale: 'ru', onClick: () => {} })
    expect(ru?.getAttribute('aria-label')).toBe('Настройки расширения')

    const en = ensureSettingsButton({ locale: 'en', onClick: () => {} })
    expect(en?.getAttribute('aria-label')).toBe('Extension settings')
  })
})
