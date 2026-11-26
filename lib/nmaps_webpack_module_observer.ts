type WebpackModuleObserver = (exports: unknown, moduleId: string) => void

type WebpackModule = {
  exports: unknown
}

type WebpackModuleFactory = (module: WebpackModule, exports: unknown, require: unknown) => unknown

type WebpackChunk = [unknown, Record<string, WebpackModuleFactory>, ...unknown[]]

type ChunkQueue = unknown[] & {
  push: (...chunks: unknown[]) => unknown
}

/**
 * Общий реестр наблюдателей одной очереди чанков.
 *
 * Скрипты расширения собраны раздельно, и каждый несёт свою копию этого
 * модуля, поэтому общее состояние нельзя держать в замыкании: оно лежит на
 * самой очереди чанков в мире страницы. Перехват `push` ставит первый
 * пришедший, остальные только добавляют подписчика.
 *
 * Если каждый ставит свой перехват, работает лишь последний: рантайм НЯК
 * копирует фабрики модулей к себе раньше, чем зовёт предыдущий `push`, и
 * обёртки более раннего наблюдателя остаются в стороне.
 */
type ObserverRegistry = {
  listeners: WebpackModuleObserver[]
  /** Обёртки фабрик: общие, чтобы новая копия не обернула фабрику повторно. */
  wrapped: WeakSet<WebpackModuleFactory>
  /** Снимает перехват `push`; `null`, пока перехват не установлен. */
  uninstall: (() => void) | null
}

const REGISTRY_KEY = '__nmapWebpackModuleObservers__'

const isWebpackChunk = (value: unknown): value is WebpackChunk =>
  Array.isArray(value) && Boolean(value[1]) && typeof value[1] === 'object'

const isRegistry = (value: unknown): value is ObserverRegistry => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ObserverRegistry>
  return Array.isArray(candidate.listeners) && candidate.wrapped instanceof WeakSet
}

const ensureRegistry = (chunks: ChunkQueue): ObserverRegistry => {
  const existing = (chunks as unknown as Record<string, unknown>)[REGISTRY_KEY]
  if (isRegistry(existing)) return existing

  const registry: ObserverRegistry = { listeners: [], wrapped: new WeakSet(), uninstall: null }
  // Неперечислимое свойство: очередь чанков обходит и рантайм НЯК.
  Object.defineProperty(chunks, REGISTRY_KEY, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: registry,
  })
  return registry
}

/** Сообщает о модуле всем подписчикам; сбой одного не трогает остальных и страницу. */
const notifyListeners = (registry: ObserverRegistry, exports: unknown, moduleId: string): void => {
  for (const listener of [...registry.listeners]) {
    try {
      listener(exports, moduleId)
    } catch {
      // Подписчик мог остаться от выгруженной копии расширения
    }
  }
}

const installPushHook = (chunks: ChunkQueue, registry: ObserverRegistry): (() => void) => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(chunks, 'push')
  let delegate = chunks.push.bind(chunks)
  let delegateWasAssigned = false

  const instrument = (chunk: unknown): void => {
    if (!isWebpackChunk(chunk)) {
      return
    }

    for (const [moduleId, factory] of Object.entries(chunk[1])) {
      if (typeof factory !== 'function' || registry.wrapped.has(factory)) {
        continue
      }

      const wrapped: WebpackModuleFactory = function (this: unknown, module, exports, require) {
        const result = Reflect.apply(factory, this, [module, exports, require])
        notifyListeners(registry, module.exports, moduleId)
        return result
      }
      registry.wrapped.add(wrapped)
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

  /*
   * Чанк мог лечь в очередь раньше, чем загрузился рантайм НЯК: тогда рантайм
   * заберёт его фабрики позже, уже обёрнутыми. На чанки, которые рантайм успел
   * обработать, обёртка не действует — их фабрики он скопировал к себе.
   */
  for (const chunk of Array.from(chunks as ArrayLike<unknown>)) {
    instrument(chunk)
  }

  return () => {
    if (delegateWasAssigned) {
      // Рантайм НЯК подменил `push` уже при нас: возвращаем его версию,
      // а не то, что было до установки перехвата.
      Object.defineProperty(chunks, 'push', {
        configurable: true,
        writable: true,
        value: delegate,
      })
    } else if (originalDescriptor) {
      Object.defineProperty(chunks, 'push', originalDescriptor)
    } else {
      Reflect.deleteProperty(chunks, 'push')
    }
  }
}

/**
 * Сообщает о каждом исполненном модуле НЯК. Возвращает функцию отписки.
 *
 * Наблюдателей на одной очереди может быть сколько угодно, в том числе из
 * разных скриптов расширения: все получают один и тот же модуль по разу.
 */
export const observeWebpackModules = (
  globalObject: Record<string, unknown>,
  chunkName: string,
  onModule: WebpackModuleObserver,
): (() => void) => {
  if (!globalObject[chunkName]) {
    globalObject[chunkName] = []
  }
  const chunks = globalObject[chunkName] as ChunkQueue
  const registry = ensureRegistry(chunks)

  // Каждая подписка — отдельная запись, даже если обработчик тот же.
  const listener: WebpackModuleObserver = (exports, moduleId) => onModule(exports, moduleId)
  registry.listeners.push(listener)
  if (!registry.uninstall) {
    registry.uninstall = installPushHook(chunks, registry)
  }

  return () => {
    const index = registry.listeners.indexOf(listener)
    if (index < 0) return
    registry.listeners.splice(index, 1)

    // Реестр остаётся на очереди: к нему привязаны уже обёрнутые фабрики,
    // и следующий наблюдатель должен получить их модули.
    if (registry.listeners.length === 0) {
      registry.uninstall?.()
      registry.uninstall = null
    }
  }
}
