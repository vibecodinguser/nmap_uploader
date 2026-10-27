// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/entrypoints/panel/App'

vi.mock('@/components/Header', () => ({ Header: () => null }))
vi.mock('@/components/SettingsTab', () => ({
  SettingsTab: () => <div data-testid="settings-tab" />,
}))
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    avatarDataUrl: null,
    isLoggingIn: false,
    handleLogin: vi.fn(),
    handleLogout: vi.fn(),
  }),
}))
vi.mock('@/hooks/useGoToLinks', () => ({ useGoToLinks: () => ({}) }))
vi.mock('@/hooks/useReloadAfterUpload', () => ({ useReloadAfterUpload: () => false }))
vi.mock('@/hooks/useSplitViewButton', () => ({ useSplitViewButton: () => false }))
vi.mock('@/hooks/useNotesButton', () => ({ useNotesButton: () => false }))
vi.mock('@/hooks/useNspdButton', () => ({ useNspdButton: () => false }))
vi.mock('@/hooks/useFeedsFilter', () => ({
  useFeedsFilter: () => ({ isEnabled: true, isLoaded: true, setIsEnabled: vi.fn() }),
}))
vi.mock('@/hooks/useStrokeColor', () => ({ useStrokeColor: () => '#000000' }))
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ themeMode: 'system', setThemeMode: vi.fn() }),
}))

describe('panel App', () => {
  afterEach(cleanup)

  it('открывает настройки без заметок и кнопки перехода', () => {
    render(<App />)

    expect(screen.getByTestId('settings-tab')).toBeDefined()
    expect(screen.queryByTestId('notes-tab')).toBeNull()
    expect(screen.queryByRole('button', { name: 'tabs.openSettingsAria' })).toBeNull()
  })
})
