// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/entrypoints/panel/App'

vi.mock('@/components/Header', () => ({ Header: () => null }))
vi.mock('@/components/PoligonTab', () => ({
  PoligonTab: () => <div data-testid="upload-tab" />,
}))
vi.mock('@/components/NotesTab', () => ({
  NotesTab: () => <div data-testid="notes-tab" />,
}))
vi.mock('@/components/SettingsTab', () => ({ SettingsTab: () => null }))
vi.mock('@/components/TabBar', () => ({ TabBar: () => null }))
vi.mock('@/hooks/useOccupiedDates', () => ({
  OccupiedDatesProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    avatarDataUrl: null,
    isLoggingIn: false,
    isLoggedIn: true,
    refreshUser: vi.fn(),
    handleLogin: vi.fn(),
    handleLogout: vi.fn(),
  }),
}))
vi.mock('@/hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    isUploading: false,
    progress: 0,
    uploadStatus: null,
    performUpload: vi.fn(),
  }),
}))
vi.mock('@/hooks/usePointUpload', () => ({
  usePointUpload: () => ({ isUploading: false, performManualUpload: vi.fn() }),
}))
vi.mock('@/hooks/useGoToLinks', () => ({ useGoToLinks: () => ({}) }))
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => ({ t: (key: string) => key }) }))
vi.mock('@/hooks/useReloadAfterUpload', () => ({ useReloadAfterUpload: () => false }))
vi.mock('@/hooks/useSplitViewButton', () => ({ useSplitViewButton: () => false }))
vi.mock('@/hooks/useStrokeColor', () => ({ useStrokeColor: () => '#000000' }))
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ themeMode: 'system', setThemeMode: vi.fn() }),
}))

describe('panel App', () => {
  afterEach(cleanup)

  it('монтирует заметки в фоне сразу при открытии сайдбара', () => {
    render(<App />)

    expect(screen.getByTestId('upload-tab')).toBeDefined()
    expect(screen.getByTestId('notes-tab')).toBeDefined()
    expect(screen.getByTestId('notes-tab').parentElement?.hidden).toBe(true)
  })
})
