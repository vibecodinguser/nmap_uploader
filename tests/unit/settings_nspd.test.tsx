// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsTab } from '@/components/SettingsTab'
import { LocaleProvider } from '@/hooks/useLocale'
import type { NspdPermissionDeniedReason } from '@/hooks/useNspdButton'
import { FOCUS_NSPD_ACCESS_MESSAGE } from '@/lib/settings_popup/protocol'

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
  focusNspdAccess: false,
  goToLinks: {
    isMenuEnabled: true,
    isLoaded: true,
    items: [],
    setIsMenuEnabled: noop,
    setItemActive: noop,
    moveItemBy: noop,
    reorderItems: noop,
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
    screen.getByRole('switch', { name: 'Загрузка из НСПД' }).click()

    expect(setIsEnabled).toHaveBeenCalledWith(true)
  })
})

afterEach(cleanup)

it('подсвечивает кнопку «Разрешить доступ» при focusNspdAccess', () => {
  const props = buildProps('nspd')
  props.nspdButton.isEnabled = true
  props.focusNspdAccess = true

  const { container } = render(<SettingsTab {...props} />, { wrapper: LocaleProvider })

  const button = container.querySelector('.settings-grant-access-btn') as HTMLButtonElement
  expect(button).toBeTruthy()
  // scrollIntoView в happy-dom — заглушка; проверяем, что кнопка в фокусе.
  expect(document.activeElement).toBe(button)
})

it('переключает на «Редактор» по сообщению хоста и фокусирует доступ', () => {
  const props = buildProps('nspd')
  props.nspdButton.isEnabled = true

  const { container } = render(<SettingsTab {...props} />, { wrapper: LocaleProvider })
  fireEvent.click(screen.getByRole('tab', { name: 'Стиль' }))
  expect(screen.getByRole('tabpanel').id).toBe('settings-panel-style')

  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', { data: { action: FOCUS_NSPD_ACCESS_MESSAGE } }),
    )
  })

  expect(screen.getByRole('tab', { name: 'Редактор' }).getAttribute('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(container.querySelector('.settings-grant-access-btn'))
})

it('не закрывает запрос подсветки, пока состояние доступа не загружено', () => {
  const props = buildProps(null)
  props.nspdButton.isEnabled = true
  props.focusNspdAccess = true

  const { container, rerender } = render(<SettingsTab {...props} />, { wrapper: LocaleProvider })

  expect(document.activeElement).not.toBe(container.querySelector('.settings-grant-access-btn'))

  rerender(
    <SettingsTab {...props} nspdButton={{ ...props.nspdButton, permissionDenied: 'nspd' }} />,
  )

  expect(document.activeElement).toBe(container.querySelector('.settings-grant-access-btn'))
})
