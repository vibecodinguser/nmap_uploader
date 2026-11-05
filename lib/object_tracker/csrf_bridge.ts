/**
 * Мост CSRF-токена между MAIN world и изолированным content script.
 *
 * Токен живёт в замыкании модуля приложения и нигде не публикуется, поэтому
 * его приходится перехватывать из заголовков запросов редактора.
 */

export const CSRF_MESSAGE_SOURCE = 'NMAP_CSRF_TOKEN'

export interface CsrfMessage {
  source: typeof CSRF_MESSAGE_SOURCE
  token: string
}

/** Имя заголовка, который приложение прикладывает к своим запросам. */
export const CSRF_HEADER = 'x-csrf-token'

/** Проверяет, что сообщение пришло от нашего перехватчика. */
export const isCsrfMessage = (data: unknown): data is CsrfMessage => {
  if (!data || typeof data !== 'object') {
    return false
  }
  const record = data as Record<string, unknown>
  return record.source === CSRF_MESSAGE_SOURCE && typeof record.token === 'string'
}
