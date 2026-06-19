import { cleanup, type RenderOptions, type RenderResult, render } from '@testing-library/react';
import type { RunOptions } from 'axe-core';
import type { ReactElement } from 'react';
import { expect } from 'vitest';
import { axe } from 'vitest-axe';
import '@/assets/styles/uploader.css';
import { LocaleProvider } from '@/hooks/useLocale';
import { OccupiedDatesProvider } from '@/hooks/useOccupiedDates';

type RenderAccessibilityOptions = Omit<RenderOptions, 'wrapper'> & {
  isLoggedIn?: boolean;
};

export const renderA11y = (
  ui: ReactElement,
  { isLoggedIn = false, ...options }: RenderAccessibilityOptions = {},
): RenderResult => {
  return render(ui, {
    wrapper: ({ children }) => (
      <LocaleProvider>
        <OccupiedDatesProvider isLoggedIn={isLoggedIn}>{children}</OccupiedDatesProvider>
      </LocaleProvider>
    ),
    ...options,
  });
};

/** Color contrast needs full layout/paint; happy-dom unit tests focus on structure and ARIA. */
export const axeOptions: RunOptions = {
  rules: {
    'color-contrast': { enabled: false },
  },
};

export const expectNoA11yViolations = async (container: HTMLElement): Promise<void> => {
  const results = await axe(container, axeOptions);
  const assertion = expect(results);
  assertion.toHaveNoViolations();
};

export const cleanupA11y = (): void => {
  cleanup();
};
