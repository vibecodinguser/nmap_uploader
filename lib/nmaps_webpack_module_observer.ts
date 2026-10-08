export type WebpackModuleObserver = (exports: unknown, moduleId: string) => void

type WebpackModule = {
  exports: unknown
}

type WebpackModuleFactory = (module: WebpackModule, exports: unknown, require: unknown) => unknown

type WebpackChunk = [unknown, Record<string, WebpackModuleFactory>, ...unknown[]]

const isWebpackChunk = (value: unknown): value is WebpackChunk =>
  Array.isArray(value) && Boolean(value[1]) && typeof value[1] === 'object'

export const observeWebpackModules = (
  globalObject: Record<string, unknown>,
  chunkName: string,
  onModule: WebpackModuleObserver,
): (() => void) => {
  if (!globalObject[chunkName]) {
    globalObject[chunkName] = []
  }
  const chunks = globalObject[chunkName] as unknown[] & {
    push: (...chunks: unknown[]) => unknown
  }
  const originalDescriptor = Object.getOwnPropertyDescriptor(chunks, 'push')
  let delegate = chunks.push.bind(chunks)
  let delegateWasAssigned = false
  const wrappedFactories = new WeakSet<WebpackModuleFactory>()
  let active = true

  const instrument = (chunk: unknown): void => {
    if (!isWebpackChunk(chunk)) {
      return
    }

    for (const [moduleId, factory] of Object.entries(chunk[1])) {
      if (wrappedFactories.has(factory)) {
        continue
      }

      const wrapped: WebpackModuleFactory = function (this: unknown, module, exports, require) {
        const result = Reflect.apply(factory, this, [module, exports, require])
        if (active) {
          onModule(module.exports, moduleId)
        }
        return result
      }
      wrappedFactories.add(wrapped)
      chunk[1][moduleId] = wrapped
    }
  }

  Object.defineProperty(chunks, 'push', {
    configurable: true,
    get() {
      const currentDelegate = delegate
      return (...incoming: unknown[]) => {
        incoming.forEach(instrument)
        return currentDelegate(...incoming)
      }
    },
    set(next: unknown) {
      if (typeof next === 'function') {
        delegate = next.bind(chunks)
        delegateWasAssigned = true
      }
    },
  })

  return () => {
    active = false
    if (originalDescriptor) {
      Object.defineProperty(chunks, 'push', originalDescriptor)
    } else if (delegateWasAssigned) {
      Object.defineProperty(chunks, 'push', {
        configurable: true,
        writable: true,
        value: delegate,
      })
    } else {
      Reflect.deleteProperty(chunks, 'push')
    }
  }
}
