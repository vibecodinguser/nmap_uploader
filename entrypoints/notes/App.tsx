import { useEffect } from 'react'
import { NotesTab } from '@/components/NotesTab'
import { useAuth } from '@/hooks/useAuth'
import { OccupiedDatesProvider } from '@/hooks/useOccupiedDates'

/**
 * Дублирует console.log/console.error в консоль родительского окна, чтобы логи
 * попа были видны в девтулзах страницы. Возвращает функцию восстановления.
 *
 * Родитель может быть кросс-доменным (например, страница на https, а попап —
 * chrome-extension://). В этом случае любое чтение его свойств бросает
 * SecurityError, поэтому доступ к console обязан быть внутри try/catch.
 */
const forwardLogsToParentConsole = (): (() => void) => {
  if (typeof window === 'undefined' || window.parent === window) {
    return () => {}
  }

  let parentConsole: Console
  try {
    // `Window` в lib.dom не содержит console: он объявлен на globalThis.
    parentConsole = (window.parent as unknown as { console: Console }).console
  } catch {
    // Кросс-доменный родитель — просто не форвардим логи.
    return () => {}
  }

  if (!parentConsole || typeof parentConsole.log !== 'function') {
    return () => {}
  }

  const origLog = console.log
  const origError = console.error

  console.log = (...args: unknown[]) => {
    origLog(...args)
    try {
      parentConsole.log(...args)
    } catch {}
  }
  console.error = (...args: unknown[]) => {
    origError(...args)
    try {
      parentConsole.error(...args)
    } catch {}
  }

  return () => {
    console.log = origLog
    console.error = origError
  }
}

export const NotesPopupApp = () => {
  const { isLoggedIn } = useAuth()

  useEffect(() => {
    const restoreConsole = forwardLogsToParentConsole()

    const handlePointerDown = (): void => {
      window.parent.postMessage({ action: 'RESET_POINT_COUNTER' }, '*')
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      restoreConsole()
    }
  }, [])

  return (
    <main className="notes-popup-app" data-testid="notes-popup-view">
      <OccupiedDatesProvider isLoggedIn={isLoggedIn}>
        <NotesTab />
      </OccupiedDatesProvider>
    </main>
  )
}
