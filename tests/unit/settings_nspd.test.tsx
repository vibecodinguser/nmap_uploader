// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsTab } from '@/components/SettingsTab'
import { LocaleProvider } from '@/hooks/useLocale'
import type { NspdPermissionDeniedReason } from '@/hooks/useNspdButton'

const noop = () => {}

const buildProps = (permissionDenied: NspdPermissionDeniedReason) => ({
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
  notesButton: { isEnabled: true, isLoaded: true, setIsEnabled: noop, permissionDenied: false },
  nspdButton: {
    isEnabled: false,
    isLoaded: true,
    setIsEnabled: noop,
    permissionDenied,
    requestAccess: noop,
  },
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

const renderTab = (permissionDenied: NspdPermissionDeniedReason) => {
  const result = render(<SettingsTab {...buildProps(permissionDenied)} />, {
    wrapper: LocaleProvider,
  })

  return result
}

describe('SettingsTab: доступ к НСПД', () => {
  afterEach(cleanup)

  it('не показывает ошибку, пока доступ не запрашивали', () => {
    renderTab(null)

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('показывает ошибку, если пользователь отклонил запрос доступа', () => {
    renderTab('nspd')

    expect(screen.getByRole('alert').textContent).toContain('nspd.gov.ru')
  })

  it('показывает кнопку «Разрешить доступ» при включённом тумблере без доступа', () => {
    const props = buildProps('nspd')
    props.nspdButton.isEnabled = true

    render(<SettingsTab {...props} />, { wrapper: LocaleProvider })

    expect(screen.getByRole('button', { name: 'Разрешить доступ' })).toBeTruthy()
  })

  it('клик по «Разрешить доступ» вызывает requestAccess', () => {
    const requestAccess = vi.fn()
    const props = buildProps('nspd')
    props.nspdButton.requestAccess = requestAccess

    render(<SettingsTab {...props} />, { wrapper: LocaleProvider })
    screen.getByRole('button', { name: 'Разрешить доступ' }).click()

    expect(requestAccess).toHaveBeenCalledOnce()
  })

  it('передаёт клик по тумблеру в обработчик настройки', () => {
    const setIsEnabled = vi.fn()
    const props = buildProps(null)
    props.nspdButton.setIsEnabled = setIsEnabled

    render(<SettingsTab {...props} />, { wrapper: LocaleProvider })
    screen.getByRole('switch', { name: 'НСПД' }).click()

    expect(setIsEnabled).toHaveBeenCalledWith(true)
  })
})
