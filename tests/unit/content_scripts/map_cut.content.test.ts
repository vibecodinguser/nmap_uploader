// @vitest-environment happy-dom

/**
 * Content script разреза.
 *
 * Проверяем то, что видно снаружи: скрипт стартует, помечает состояние для
 * диагностики и убирает за собой при выгрузке страницы.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import mapCutScript from '@/entrypoints/map-cut.content'
import { CUT_STATE_ATTR } from '@/lib/cut/controller'
import { CUT_TOAST_ID } from '@/lib/cut/toast'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

const getState = (): string | null => document.documentElement.getAttribute(CUT_STATE_ATTR)

const firePagehide = (): void => {
  window.dispatchEvent(new Event('pagehide'))
}

let ctx: ReturnType<typeof createContentScriptContext>

beforeEach(() => {
  ctx = createContentScriptContext()
  document.body.innerHTML = ''
  document.documentElement.removeAttribute(CUT_STATE_ATTR)
  Reflect.deleteProperty(globalThis, 'webpackChunknmaps')
})

afterEach(() => {
  firePagehide()
  document.body.innerHTML = ''
  document.documentElement.removeAttribute(CUT_STATE_ATTR)
  Reflect.deleteProperty(globalThis, 'webpackChunknmaps')
  vi.restoreAllMocks()
})

describe('map-cut.content', () => {
  it('стартует и помечает состояние для диагностики', () => {
    mapCutScript.main?.(ctx)

    // Модулей НЯК в тесте нет, поэтому хук стоит без перехваченных классов.
    expect(getState()).toBe('hooked:0')
  })

  it('не падает без ymaps и webpack-рантайма', () => {
    expect(() => mapCutScript.main?.(ctx)).not.toThrow()
  })

  it('при выгрузке страницы снимает метку и убирает плашку', () => {
    mapCutScript.main?.(ctx)
    expect(getState()).not.toBeNull()

    firePagehide()

    expect(getState()).toBeNull()
    expect(document.getElementById(CUT_TOAST_ID)).toBeNull()
  })

  it('при выгрузке возвращает очередь чанков в исходное состояние', () => {
    mapCutScript.main?.(ctx)

    const chunks = (globalThis as Record<string, unknown>).webpackChunknmaps as unknown[] & {
      push?: unknown
    }
    expect(chunks).toBeDefined()
    // Наблюдатель подменяет push, чтобы ловить будущие чанки.
    expect(Object.hasOwn(chunks, 'push')).toBe(true)

    firePagehide()

    // После остановки на странице не остаётся нашей подмены.
    expect(Object.hasOwn(chunks, 'push')).toBe(false)
  })

  it('не печатает в консоль при загрузке', () => {
    const info = vi.spyOn(console, 'info')
    const log = vi.spyOn(console, 'log')

    mapCutScript.main?.(ctx)

    expect(info).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })
})
