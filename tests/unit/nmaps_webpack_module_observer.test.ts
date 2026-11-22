import { describe, expect, it, vi } from 'vitest'
import { observeWebpackModules } from '@/lib/nmaps_webpack_module_observer'
import {
  installWebpackRuntime,
  pushWebpackChunk,
  type RuntimeFactory,
} from './nmaps_webpack_runtime_fixture'

type Factory = (
  module: { exports: Record<string, unknown> },
  exports: Record<string, unknown>,
  require: unknown,
) => void

type Chunk = [number[], Record<string, Factory>]

const execute = (factory: Factory): Record<string, unknown> => {
  const module = { exports: {} as Record<string, unknown> }
  factory(module, module.exports, vi.fn())
  return module.exports
}

describe('observeWebpackModules', () => {
  it('наблюдает модуль после замены push webpack runtime', () => {
    const globalObject: Record<string, unknown> = {}
    const seen = vi.fn()
    const restore = observeWebpackModules(globalObject, 'webpackChunknmaps', seen)
    const chunks = globalObject.webpackChunknmaps as Chunk[] & {
      push: (chunk: Chunk) => number
    }
    const factories: Record<string, Factory> = {}

    chunks.push = (chunk: Chunk) => {
      Object.assign(factories, chunk[1])
      return 1
    }
    chunks.push([
      [265],
      {
        48590: (_module, exports) => {
          exports.A = class GeometryFactory {}
        },
      },
    ])
    const exports = execute(factories['48590'])

    expect(seen).toHaveBeenCalledWith(exports, '48590')
    restore()
  })

  it('не оборачивает одну фабрику повторно в цепочке runtime', () => {
    const globalObject: Record<string, unknown> = {}
    const seen = vi.fn()
    observeWebpackModules(globalObject, 'webpackChunknmaps', seen)
    const chunks = globalObject.webpackChunknmaps as Chunk[] & {
      push: (chunk: Chunk) => number
    }
    const previousPush = chunks.push.bind(chunks)
    const factories: Record<string, Factory> = {}

    chunks.push = (chunk: Chunk) => {
      previousPush(chunk)
      Object.assign(factories, chunk[1])
      return 1
    }
    chunks.push([
      [540],
      {
        61653: (_module, exports) => {
          exports.A = class Hotspot {}
        },
      },
    ])
    execute(factories['61653'])

    expect(seen).toHaveBeenCalledOnce()
  })

  it('после restore сохраняет runtime push, но прекращает наблюдение', () => {
    const globalObject: Record<string, unknown> = {}
    const seen = vi.fn()
    const restore = observeWebpackModules(globalObject, 'webpackChunknmaps', seen)
    const chunks = globalObject.webpackChunknmaps as Chunk[] & {
      push: (chunk: Chunk) => number
    }
    const runtimePush = vi.fn((_chunk: Chunk) => 1)
    chunks.push = runtimePush

    restore()
    const factory: Factory = (_module, exports) => {
      exports.A = class AfterRestore {}
    }
    chunks.push([[1], { 1: factory }])
    execute(factory)

    expect(runtimePush).toHaveBeenCalledOnce()
    expect(seen).not.toHaveBeenCalled()
  })
})

describe('несколько наблюдателей на одной странице', () => {
  const geometryModule: RuntimeFactory = (_module, exports) => {
    exports.A = class GeometryFactory {}
  }

  /** Страница грузит `app.js`, затем чанк с модулем, затем исполняет модуль. */
  const loadPage = (globalObject: Record<string, unknown>): Record<string, unknown> => {
    const require = installWebpackRuntime(globalObject)
    pushWebpackChunk(globalObject, [[265], { 48590: geometryModule }])
    return require(48590)
  }

  it('оба скрипта видят модуль, если встали до загрузки НЯК', () => {
    // Скрипты расширения собраны раздельно и ставят наблюдатель по очереди
    // на `document_start`; порядок задаёт манифест.
    const globalObject: Record<string, unknown> = {}
    const first = vi.fn()
    const second = vi.fn()
    observeWebpackModules(globalObject, 'webpackChunknmaps', first)
    observeWebpackModules(globalObject, 'webpackChunknmaps', second)

    const exports = loadPage(globalObject)

    expect(first).toHaveBeenCalledExactlyOnceWith(exports, '48590')
    expect(second).toHaveBeenCalledExactlyOnceWith(exports, '48590')
  })

  it('снятие одного наблюдателя не глушит второй', () => {
    const globalObject: Record<string, unknown> = {}
    const first = vi.fn()
    const second = vi.fn()
    const restoreFirst = observeWebpackModules(globalObject, 'webpackChunknmaps', first)
    observeWebpackModules(globalObject, 'webpackChunknmaps', second)

    restoreFirst()
    const exports = loadPage(globalObject)

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledExactlyOnceWith(exports, '48590')
  })

  it('наблюдатель, вставший после снятия всех прежних, видит модуль один раз', () => {
    const globalObject: Record<string, unknown> = {}
    const gone = vi.fn()
    const late = vi.fn()
    observeWebpackModules(globalObject, 'webpackChunknmaps', gone)()
    // Чанк лёг в очередь до рантайма: его фабрики рантайм заберёт позже.
    pushWebpackChunk(globalObject, [[265], { 48590: geometryModule }])
    observeWebpackModules(globalObject, 'webpackChunknmaps', late)

    const exports = installWebpackRuntime(globalObject)(48590)

    expect(gone).not.toHaveBeenCalled()
    expect(late).toHaveBeenCalledExactlyOnceWith(exports, '48590')
  })

  it('сбой одного наблюдателя не ломает модуль страницы и второй наблюдатель', () => {
    const globalObject: Record<string, unknown> = {}
    const second = vi.fn()
    observeWebpackModules(globalObject, 'webpackChunknmaps', () => {
      throw new Error('Extension context invalidated')
    })
    observeWebpackModules(globalObject, 'webpackChunknmaps', second)

    expect(() => loadPage(globalObject)).not.toThrow()
    expect(second).toHaveBeenCalledOnce()
  })

  it('не оставляет перечислимых следов в очереди чанков', () => {
    const globalObject: Record<string, unknown> = {}
    observeWebpackModules(globalObject, 'webpackChunknmaps', vi.fn())

    expect(Object.keys(globalObject.webpackChunknmaps as object)).toEqual([])
  })
})
