import { isCsrfMessage } from './csrf_bridge'

let currentToken = ''

type TokenListener = (token: string) => void

const listeners = new Set<TokenListener>()

/** Текущий перехваченный CSRF-токен (пустая строка, пока не поймали). */
export const getCsrfToken = (): string => currentToken

export const hasCsrfToken = (): boolean => currentToken.length > 0

/** Сбрасывает токен: следующий запрос должен поймать новый. */
export const resetCsrfToken = (): void => {
  currentToken = ''
}

/**
 * Подписка на появление токена.
 *
 * Нужна, потому что на старте страницы токена ещё нет: без неё первый опрос
 * уходил без заголовка, получал 403, и следующий был только через период опроса.
 */
export const onCsrfTokenAvailable = (listener: TokenListener): (() => void) => {
  listeners.add(listener)
  if (currentToken) {
    listener(currentToken)
  }
  return () => {
    listeners.delete(listener)
  }
}

const setToken = (token: string): void => {
  const isNew = token !== currentToken
  currentToken = token
  if (!isNew) {
    return
  }
  for (const listener of listeners) {
    try {
      listener(token)
    } catch (error: unknown) {
      console.warn('[nmap_uploader] csrf listener failed:', error)
    }
  }
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
    setToken(event.data.token)
  }

  window.addEventListener('message', handleMessage)

  return () => {
    window.removeEventListener('message', handleMessage)
  }
}
