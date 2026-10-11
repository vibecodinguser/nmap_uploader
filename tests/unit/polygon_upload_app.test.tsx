// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PolygonUploadApp } from '@/entrypoints/polygon-upload/App'

const mocks = vi.hoisted(() => ({
  handleLogin: vi.fn(async () => {}),
  performUpload: vi.fn(),
  refreshUser: vi.fn(),
  poligonTabProps: null as Record<string, unknown> | null,
}))

vi.mock('@/components/PoligonTab', () => ({
  PoligonTab: (props: Record<string, unknown>) => {
    mocks.poligonTabProps = props
    return <div data-testid="poligon-tab" />
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isLoggingIn: false,
    isLoggedIn: true,
    refreshUser: mocks.refreshUser,
    handleLogin: mocks.handleLogin,
  }),
}))

vi.mock('@/hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    isUploading: false,
    progress: 0,
    uploadStatus: null,
    performUpload: mocks.performUpload,
  }),
}))

vi.mock('@/hooks/useOccupiedDates', () => ({
  OccupiedDatesProvider: ({ children }: { children: ReactNode }) => children,
}))

afterEach(() => {
  cleanup()
  mocks.handleLogin.mockClear()
  mocks.poligonTabProps = null
})

describe('PolygonUploadApp', () => {
  it('передаёт существующий upload workflow в PoligonTab', () => {
    render(<PolygonUploadApp />)

    expect(screen.getByTestId('polygon-upload-view')).toBeDefined()
    expect(screen.getByTestId('poligon-tab')).toBeDefined()
    expect(mocks.poligonTabProps).toEqual(
      expect.objectContaining({
        isLoggedIn: true,
        isUploading: false,
        progress: 0,
        uploadStatus: null,
        onUpload: mocks.performUpload,
      }),
    )
  })

  it('запускает авторизацию по запросу формы', async () => {
    render(<PolygonUploadApp />)

    const onRequireAuth = mocks.poligonTabProps?.onRequireAuth
    expect(onRequireAuth).toBeTypeOf('function')
    await (onRequireAuth as () => Promise<void>)()

    expect(mocks.handleLogin).toHaveBeenCalledOnce()
  })
})
