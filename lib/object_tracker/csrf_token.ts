import { isCsrfMessage } from './csrf_bridge'

let currentToken = ''

/** Текущий перехваченный CSRF-токен (пустая строка, пока не поймали). */
export const getCsrfToken = (): string => currentToken

export const hasCsrfToken = (): boolean => currentToken.length > 0

/** Сбрасывает токен: следующий запрос должен поймать новый. */
export const resetCsrfToken = (): void => {
  currentToken = ''
}

/**
 * Подписывается на сообщения перехватчика из MAIN world.
 * Возвращает функцию отписки.
 */
export const installCsrfTokenListener = (): (() => void) => {
  const handleMessage = (event: MessageEvent): void => {
    if (event.source !== window) {
      return
    }
    if (!isCsrfMessage(event.data)) {
      return
    }
    currentToken = event.data.token
  }

  window.addEventListener('message', handleMessage)

  return () => {
    window.removeEventListener('message', handleMessage)
  }
}
