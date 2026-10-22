import { repairToolbarIcons } from '@/lib/go_to'

export interface PageVisibilityHandlersOptions {
  onPageResume: () => void
}

/**
 * Подключает слушатели видимости страницы и события pageshow (BFCache),
 * вызывая onPageResume при возвращении пользователя на страницу.
 */
export const attachPageVisibilityListeners = ({
  onPageResume,
}: PageVisibilityHandlersOptions): (() => void) => {
  const handlePageResume = (): void => {
    repairToolbarIcons()
    onPageResume()
  }

  const handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      handlePageResume()
    }
  }

  const handlePageShow = (event: PageTransitionEvent): void => {
    if (event.persisted) {
      handlePageResume()
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pageshow', handlePageShow)
  }

  return () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pageshow', handlePageShow)
    }
  }
}
