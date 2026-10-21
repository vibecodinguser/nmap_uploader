import type { RuntimeMessageSender } from '@/lib/message_auth'

export type MessageHandler = (
  message: Record<string, unknown>,
  sender: RuntimeMessageSender,
  sendResponse: (response: any) => void,
) => boolean

export interface MessageRouter {
  register: (action: string, handler: MessageHandler) => void
  dispatch: (
    message: unknown,
    sender: RuntimeMessageSender,
    sendResponse: (response: unknown) => void,
  ) => boolean | undefined
  getHandlers: () => Readonly<Record<string, MessageHandler>>
}

export type CreateMessageRouterOptions = {
  handlers?: Record<string, MessageHandler>
}

/**
 * Создает изолированный роутер сообщений фонового процесса.
 */
export const createMessageRouter = (options: CreateMessageRouterOptions = {}): MessageRouter => {
  const handlerMap: Record<string, MessageHandler> = {
    ...options.handlers,
  }

  const register = (action: string, handler: MessageHandler): void => {
    handlerMap[action] = handler
  }

  const dispatch = (
    message: unknown,
    sender: RuntimeMessageSender,
    sendResponse: (response: unknown) => void,
  ): boolean | undefined => {
    if (typeof message !== 'object' || message === null) {
      return undefined
    }

    const action = (message as { action?: string }).action
    if (!action) {
      return undefined
    }

    const handler = handlerMap[action]
    if (!handler) {
      return undefined
    }

    return handler(message as Record<string, unknown>, sender, sendResponse)
  }

  const getHandlers = (): Readonly<Record<string, MessageHandler>> => {
    return { ...handlerMap }
  }

  return {
    register,
    dispatch,
    getHandlers,
  }
}
