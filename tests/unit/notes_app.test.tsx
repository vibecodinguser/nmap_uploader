// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotesPopupApp } from '@/entrypoints/notes/App'

const mocks = vi.hoisted(() => ({
  handleLogin: vi.fn(async () => {}),
  refreshUser: vi.fn(),
  notesTabProps: null as Record<string, unknown> | null,
}))

vi.mock('@/components/NotesTab', () => ({
  NotesTab: (props: Record<string, unknown>) => {
    mocks.notesTabProps = props
    return <div data-testid="notes-tab" />
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

vi.mock('@/hooks/useOccupiedDates', () => ({
  OccupiedDatesProvider: ({ children }: { children: ReactNode }) => children,
}))

const originalParent = window.parent
const originalConsoleLog = console.log
const originalConsoleError = console.error

const setParent = (parent: unknown): void => {
  Object.defineProperty(window, 'parent', { configurable: true, value: parent })
}

afterEach(() => {
  cleanup()
  setParent(originalParent)
  console.log = originalConsoleLog
  console.error = originalConsoleError
  mocks.handleLogin.mockClear()
  mocks.refreshUser.mockClear()
  mocks.notesTabProps = null
})

describe('NotesPopupApp', () => {
  it('рендерит попап управления заметками', () => {
    render(<NotesPopupApp />)

    expect(screen.getByTestId('notes-popup-view')).toBeDefined()
    expect(screen.getByTestId('notes-tab')).toBeDefined()
    expect(mocks.notesTabProps).toEqual({})
  })

  it('дублирует console.log в консоль родительского окна', () => {
    const parentLog = vi.fn()
    setParent({ console: { log: parentLog, error: vi.fn() } })

    render(<NotesPopupApp />)
    console.log('hello parent')

    expect(parentLog).toHaveBeenCalledWith('hello parent')
  })

  it('не падает, если родительское окно кросс-доменное', () => {
    // Кросс-доменный WindowProxy бросает SecurityError при чтении любого
    // именованного свойства — в том числе `console`.
    const crossOriginParent = new Proxy(
      {},
      {
        get: () => {
          throw new DOMException('Blocked a frame', 'SecurityError')
        },
      },
    )
    setParent(crossOriginParent)

    expect(() => render(<NotesPopupApp />)).not.toThrow()
    expect(screen.getByTestId('notes-popup-view')).toBeDefined()
    // Консоль не патчится, если форвардить некуда.
    expect(console.log).toBe(originalConsoleLog)
    expect(console.error).toBe(originalConsoleError)
  })

  it('восстанавливает console после размонтирования', () => {
    setParent({ console: { log: vi.fn(), error: vi.fn() } })

    const { unmount } = render(<NotesPopupApp />)
    expect(console.log).not.toBe(originalConsoleLog)

    unmount()

    expect(console.log).toBe(originalConsoleLog)
    expect(console.error).toBe(originalConsoleError)
  })
})
