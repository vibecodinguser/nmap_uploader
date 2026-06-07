/** Безопасная замена пакета setimmediate: без Function() для прохождения AMO-линтера. */
type ImmediateHandle = ReturnType<typeof setTimeout>

const setImmediateImpl = (
  callback: (...args: unknown[]) => void,
  ...args: unknown[]
): ImmediateHandle =>
  setTimeout(() => {
    callback(...args)
  }, 0)

const clearImmediateImpl = (handle: ImmediateHandle): void => {
  clearTimeout(handle)
}

const globalScope = globalThis as typeof globalThis & {
  setImmediate?: typeof setImmediateImpl
  clearImmediate?: typeof clearImmediateImpl
}

if (!globalScope.setImmediate) {
  globalScope.setImmediate = setImmediateImpl
  globalScope.clearImmediate = clearImmediateImpl
}

export {}
