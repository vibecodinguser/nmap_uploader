/**
 * Копия загрузчика чанков из `app.js` Народной карты (редактор 3.548.0).
 *
 * Порядок действий повторяет настоящий рантайм: он сначала копирует фабрики
 * модулей к себе, и только потом зовёт прежний `push`. Именно на этом порядке
 * ломались наблюдатели, поэтому в тестах нужен он, а не упрощённая подмена.
 */

export type RuntimeModule = { exports: Record<string, unknown> }

export type RuntimeFactory = (
  module: RuntimeModule,
  exports: Record<string, unknown>,
  require: RuntimeRequire,
) => void

export type RuntimeChunk = [
  Array<number | string>,
  Record<string, RuntimeFactory>,
  ((require: RuntimeRequire) => void)?,
]

export type RuntimeRequire = {
  (id: number | string): Record<string, unknown>
  m: Record<string, RuntimeFactory>
}

/** Очередь чанков: массив, у которого рантайм подменяет `push` своим колбэком. */
type ChunkQueue = Omit<RuntimeChunk[], 'push'> & { push: (chunk: RuntimeChunk) => unknown }

/** Ставит рантайм так же, как это делает `app.js`, и возвращает его `require`. */
export const installWebpackRuntime = (
  globalObject: Record<string, unknown>,
  chunkName = 'webpackChunknmaps',
): RuntimeRequire => {
  const installedChunks: Record<string, unknown> = { 524: 0 }
  const cache: Record<string, RuntimeModule> = {}

  const require = ((id: number | string) => {
    const cached = cache[id]
    if (cached !== undefined) return cached.exports
    const module: RuntimeModule = { exports: {} }
    cache[id] = module
    require.m[id].call(module.exports, module, module.exports, require)
    return module.exports
  }) as RuntimeRequire
  require.m = {}

  const jsonpCallback = (
    parentPush: ((chunk: RuntimeChunk) => unknown) | 0,
    chunk: RuntimeChunk,
  ): void => {
    const [chunkIds, moreModules, runtime] = chunk
    if (chunkIds.some((id) => installedChunks[id] !== 0)) {
      for (const moduleId of Object.keys(moreModules)) {
        require.m[moduleId] = moreModules[moduleId]
      }
      if (runtime) runtime(require)
    }
    if (parentPush) parentPush(chunk)
    for (const chunkId of chunkIds) {
      installedChunks[chunkId] = 0
    }
  }

  if (!globalObject[chunkName]) globalObject[chunkName] = []
  const queue = globalObject[chunkName] as ChunkQueue
  queue.forEach((chunk) => {
    jsonpCallback(0, chunk)
  })
  queue.push = jsonpCallback.bind(null, queue.push.bind(queue))

  return require
}

/** Регистрирует чанк так же, как это делает загруженный бандл НЯК. */
export const pushWebpackChunk = (
  globalObject: Record<string, unknown>,
  chunk: RuntimeChunk,
  chunkName = 'webpackChunknmaps',
): void => {
  if (!globalObject[chunkName]) globalObject[chunkName] = []
  ;(globalObject[chunkName] as ChunkQueue).push(chunk)
}
