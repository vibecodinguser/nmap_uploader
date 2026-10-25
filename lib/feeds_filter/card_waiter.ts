import { findEventCards as getEventCards } from './page_adapter'

/**
 * Ожидает появления новых карточек событий в контейнере ленты через MutationObserver
 * либо по истечении заданного таймаута.
 */
export const waitForNewCards = (
  container: HTMLElement,
  previousCount: number,
  timeoutMs = 3500,
  signal?: AbortSignal,
): Promise<number> => {
  return new Promise((resolve) => {
    let isResolved = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let observer: MutationObserver | null = null

    const finish = (count: number) => {
      if (isResolved) {
        return
      }
      isResolved = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (observer) {
        observer.disconnect()
        observer = null
      }
      signal?.removeEventListener('abort', handleAbort)
      resolve(count)
    }

    const handleAbort = () => {
      finish(getEventCards(container).length)
    }

    if (signal?.aborted) {
      finish(getEventCards(container).length)
      return
    }

    signal?.addEventListener('abort', handleAbort)

    timer = setTimeout(() => {
      const currentCards = getEventCards(container)
      finish(currentCards.length)
    }, timeoutMs)

    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => {
        const currentCards = getEventCards(container)
        if (currentCards.length > previousCount) {
          finish(currentCards.length)
        }
      })
      observer.observe(container, { childList: true, subtree: true })
    }
  })
}
