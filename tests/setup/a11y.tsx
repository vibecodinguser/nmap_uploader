import { type RenderOptions, cleanup, render, type RenderResult } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import type { RunOptions } from 'axe-core'
import { expect } from 'vitest'
import { axe } from 'vitest-axe'
import '@/assets/styles/uploader.css'
import { LocaleProvider } from '@/hooks/useLocale'
import { OccupiedDatesProvider } from '@/hooks/useOccupiedDates'

type A11yProvidersProps = {
  children: ReactNode
  isLoggedIn?: boolean
}

const A11yProviders = ({ children, isLoggedIn = false }: A11yProvidersProps) => (
  <LocaleProvider>
    <OccupiedDatesProvider isLoggedIn={isLoggedIn}>{children}</OccupiedDatesProvider>
  </LocaleProvider>
)

type RenderA11yOptions = Omit<RenderOptions, 'wrapper'> & {
  isLoggedIn?: boolean
}

export const renderA11y = (
  ui: ReactElement,
  { isLoggedIn = false, ...options }: RenderA11yOptions = {},
): RenderResult =>
  render(ui, {
    wrapper: ({ children }) => <A11yProviders isLoggedIn={isLoggedIn}>{children}</A11yProviders>,
    ...options,
  })

/** Color contrast needs full layout/paint; happy-dom unit tests focus on structure and ARIA. */
export const axeOptions: RunOptions = {
  rules: {
    'color-contrast': { enabled: false },
  },
}

export const expectNoA11yViolations = async (container: HTMLElement) => {
  expect(await axe(container, axeOptions)).toHaveNoViolations()
}

export const cleanupA11y = () => {
  cleanup()
}
