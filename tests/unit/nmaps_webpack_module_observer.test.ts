import { describe, expect, it, vi } from 'vitest'
import { observeWebpackModules } from '@/lib/nmaps_webpack_module_observer'

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
