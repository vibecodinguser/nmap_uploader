import { useEffect } from 'react'
import { NotesTab } from '@/components/NotesTab'
import { useAuth } from '@/hooks/useAuth'
import { OccupiedDatesProvider } from '@/hooks/useOccupiedDates'
import { usePointUpload } from '@/hooks/usePointUpload'

export const NotesPopupApp = () => {
  const { isLoggingIn, isLoggedIn, refreshUser, handleLogin } = useAuth()
  const { isUploading, performManualUpload } = usePointUpload({
    onAuthenticated: refreshUser,
  })

  useEffect(() => {
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      // `Window` в lib.dom не содержит console: он объявлен на globalThis.
      // Родитель — обычное окно, поэтому console у него есть в рантайме.
      const parentConsole = (window.parent as unknown as { console: Console }).console
      try {
        const origLog = console.log
        console.log = (...args: unknown[]) => {
          origLog(...args)
          try {
            parentConsole.log(...args)
          } catch {}
        }
        const origError = console.error
        console.error = (...args: unknown[]) => {
          origError(...args)
          try {
            parentConsole.error(...args)
          } catch {}
        }
      } catch {}
    }

    const handlePointerDown = (): void => {
      window.parent.postMessage({ action: 'RESET_POINT_COUNTER' }, '*')
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const handleRequireAuth = async (): Promise<void> => {
    if (!isLoggingIn) {
      await handleLogin()
    }
  }

  return (
    <main className="notes-popup-app" data-testid="notes-popup-view">
      <OccupiedDatesProvider isLoggedIn={isLoggedIn}>
        <NotesTab
          isUploading={isUploading}
          isLoggedIn={isLoggedIn}
          onRequireAuth={handleRequireAuth}
          onManualUpload={performManualUpload}
        />
      </OccupiedDatesProvider>
    </main>
  )
}
