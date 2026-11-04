// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsTab } from '@/components/SettingsTab'
import { LocaleProvider } from '@/hooks/useLocale'

const noop = () => {}

const buildProps = (permissionDenied: boolean) => ({
  themeMode: 'system' as const,
  onThemeModeChange: noop,
  strokeColor: {
    inputValue: 'ff0000',
    effectiveColor: '#ff0000',
    validationError: null,
    applyStatus: 'idle' as const,
    isLoaded: true,
    isApplying: false,
    canApply: true,
    handleInputChange: noop,
    handleApply: async () => {},
  },
  reloadAfterUpload: { isEnabled: false, isLoaded: true, setIsEnabled: noop, canChange: true },
  splitViewButton: { isEnabled: true, isLoaded: true, setIsEnabled: noop },
  notesButton: { isEnabled: true, isLoaded: true, setIsEnabled: noop },
  nspdButton: { isEnabled: false, isLoaded: true, setIsEnabled: noop, permissionDenied },
  pointCounter: { isEnabled: true, isLoaded: true, setIsEnabled: noop },
  goToLinks: {
    isMenuEnabled: true,
    isLoaded: true,
    items: [],
    setIsMenuEnabled: noop,
    setItemActive: noop,
    moveItemUp: noop,
    moveItemDown: noop,
  },
})

const renderTab = (permissionDenied: boolean) =>
  render(<SettingsTab {...buildProps(permissionDenied)} />, { wrapper: LocaleProvider })

describe('SettingsTab: доступ к НСПД', () => {
  afterEach(cleanup)

  it('не показывает ошибку, пока доступ не запрашивали', () => {
    renderTab(false)

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('показывает ошибку, если пользователь отклонил запрос доступа', () => {
    renderTab(true)

    expect(screen.getByRole('alert').textContent).toContain('nspd.gov.ru')
  })

  it('передаёт клик по тумблеру в обработчик настройки', () => {
    const setIsEnabled = vi.fn()
    const props = buildProps(false)
    props.nspdButton.setIsEnabled = setIsEnabled

    render(<SettingsTab {...props} />, { wrapper: LocaleProvider })
    screen.getByRole('switch', { name: 'НСПД' }).click()

    expect(setIsEnabled).toHaveBeenCalledWith(true)
  })
})
