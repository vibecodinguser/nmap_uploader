import { describe, expect, it, vi } from 'vitest'
import { createMessageRouter, type MessageHandler } from '@/lib/background/message_router'
import type { RuntimeMessageSender } from '@/lib/message_auth'

describe('Background Message Router (TDD slice: pure routing and dispatching)', () => {
  const dummySender: RuntimeMessageSender = { id: 'ext-id' }

  it('находит и вызывает зарегистрированный обработчик по полю action', () => {
    const mockHandler: MessageHandler = vi.fn().mockReturnValue(true)
    const router = createMessageRouter({
      handlers: {
        customAction: mockHandler,
      },
    })

    const sendResponse = vi.fn()
    const result = router.dispatch(
      { action: 'customAction', payload: 123 },
      dummySender,
      sendResponse,
    )

    expect(result).toBe(true)
    expect(mockHandler).toHaveBeenCalledTimes(1)
    expect(mockHandler).toHaveBeenCalledWith(
      { action: 'customAction', payload: 123 },
      dummySender,
      sendResponse,
    )
  })

  it('возвращает undefined и не падает, если экшен неизвестен или отсутствует', () => {
    const router = createMessageRouter({ handlers: {} })
    const sendResponse = vi.fn()

    expect(router.dispatch(null, dummySender, sendResponse)).toBeUndefined()
    expect(router.dispatch({}, dummySender, sendResponse)).toBeUndefined()
    expect(
      router.dispatch({ action: 'nonExistentAction' }, dummySender, sendResponse),
    ).toBeUndefined()
  })

  it('позволяет динамически регистрировать новые обработчики', () => {
    const router = createMessageRouter()
    const dynamicHandler = vi.fn().mockReturnValue(false)

    router.register('dynamicAction', dynamicHandler)

    const result = router.dispatch({ action: 'dynamicAction' }, dummySender, vi.fn())
    expect(result).toBe(false)
    expect(dynamicHandler).toHaveBeenCalledTimes(1)
  })
})
