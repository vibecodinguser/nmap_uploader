import { describe, expect, it } from 'vitest'
import { ERR_NETWORK, getErrorMessage, isProcessingError, ProcessingError } from '@/lib/errors'

describe('errors', () => {
  it('getErrorMessage: возвращает message из ProcessingError', () => {
    const error = new ProcessingError(ERR_NETWORK, 'Токен недействителен')
    expect(getErrorMessage(error, 'fallback')).toBe('Токен недействителен')
  })

  it('getErrorMessage: возвращает message из обычного Error', () => {
    expect(getErrorMessage(new Error('Сеть недоступна'), 'fallback')).toBe('Сеть недоступна')
  })

  it('getErrorMessage: возвращает fallback для неизвестной ошибки', () => {
    expect(getErrorMessage('unexpected', 'Ошибка доступа к Диску')).toBe('Ошибка доступа к Диску')
  })

  it('isProcessingError: распознаёт ProcessingError по name и code', () => {
    const error = { name: 'ProcessingError', code: ERR_NETWORK, message: 'test' }
    expect(isProcessingError(error)).toBe(true)
  })
})
