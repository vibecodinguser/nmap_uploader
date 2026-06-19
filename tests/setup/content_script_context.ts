import { vi } from 'vitest'
import type { ContentScriptContext } from 'wxt/utils/content-script-context'

/** Минимальный mock ContentScriptContext для вызова main() content scripts. */
export const createContentScriptContext = (): ContentScriptContext & {
  runInvalidated: () => void
} => {
  const cleanupFns: Array<() => void> = []

  return {
    id: 'test-content-script',
    contentScriptName: 'test',
    isInvalid: false,
    isValid: true,
    onInvalidated: (fn: () => void) => {
      cleanupFns.push(fn)
    },
    runInvalidated: () => {
      for (const fn of cleanupFns) fn()
      cleanupFns.length = 0
    },
  } as unknown as ContentScriptContext & { runInvalidated: () => void }
}

/** Имитирует iframe: content script не должен работать в top frame. */
export const mockIframeWindow = (): (() => void) => {
  const originalTop = window.top
  Object.defineProperty(window, 'top', {
    configurable: true,
    value: {},
  })

  return () => {
    Object.defineProperty(window, 'top', {
      configurable: true,
      value: originalTop,
    })
  }
}

/** Смотрит за postMessage родительского окна. */
export const spyParentPostMessage = (): {
  messages: unknown[]
  restore: () => void
} => {
  const messages: unknown[] = []
  const parent = { postMessage: vi.fn((message: unknown) => messages.push(message)) }
  const originalParent = window.parent

  Object.defineProperty(window, 'parent', {
    configurable: true,
    value: parent,
  })

  return {
    messages,
    restore: () => {
      Object.defineProperty(window, 'parent', {
        configurable: true,
        value: originalParent,
      })
    },
  }
}
