/** Безопасная замена пакета setimmediate: без Function() для прохождения AMO-линтера. */
type ImmediateHandle = ReturnType<typeof setTimeout>
type SetImmediateFn = (
  callback: (...args: unknown[]) => void,
  ...args: unknown[]
) => ImmediateHandle
type ClearImmediateFn = (handle: ImmediateHandle) => void

const setImmediateImpl: SetImmediateFn = (callback, ...args) =>
  setTimeout(() => {
    callback(...args)
  }, 0)

const clearImmediateImpl: ClearImmediateFn = (handle) => {
  clearTimeout(handle)
}

if (typeof globalThis.setImmediate !== 'function') {
  const scope = globalThis as unknown as {
    setImmediate: SetImmediateFn
    clearImmediate: ClearImmediateFn
  }
  scope.setImmediate = setImmediateImpl
  scope.clearImmediate = clearImmediateImpl
}

export {}
