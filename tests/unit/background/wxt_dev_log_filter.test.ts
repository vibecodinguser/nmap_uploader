// @vitest-environment node

/**
 * Фильтр служебных сообщений WXT в консоли браузера.
 *
 * Строки «Reloading content script» и «Content script is not registered yet»
 * печатает внутренний логгер WXT, вшитый в собранный background. Опция `logger`
 * в `wxt.config.ts` на него не влияет, поэтому перехват идёт на уровне
 * `console` — и только в dev-сборке.
 */
import { describe, expect, it, vi } from 'vitest'
import { installWxtDevLogFilter, shouldSilenceWxtLog } from '@/lib/wxt_dev_log_filter'

describe('shouldSilenceWxtLog', () => {
  it('узнаёт строку о перезагрузке content script', () => {
    expect(
      shouldSilenceWxtLog(['[wxt] Reloading content script:', { js: ['nspd-collector.js'] }]),
    ).toBe(true)
  })

  it('узнаёт строку о незарегистрированном рантайм-скрипте', () => {
    expect(
      shouldSilenceWxtLog([
        '[wxt] Content script is not registered yet, nothing to reload',
        { js: ['nspd-collector.js'] },
      ]),
    ).toBe(true)
  })

  it('не трогает сообщения расширения', () => {
    expect(shouldSilenceWxtLog(['[nmap_uploader] notes sidebar sync failed:', {}])).toBe(false)
    expect(shouldSilenceWxtLog(['Reloaded: notes-panel'])).toBe(false)
  })

  it('не трогает сообщения без текста', () => {
    expect(shouldSilenceWxtLog([{ some: 'object' }])).toBe(false)
    expect(shouldSilenceWxtLog([])).toBe(false)
  })
})

describe('installWxtDevLogFilter', () => {
  const createConsole = (): Console => {
    const fake = {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }
    return fake as unknown as Console
  }

  it('пропускает обычные сообщения', () => {
    const target = createConsole()
    // Обёртка вызывает исходный шпион, поэтому проверяем его, а не свойство.
    const logSpy = target.log as unknown as { mock: { calls: unknown[][] } }

    installWxtDevLogFilter(target)
    target.log('полезное сообщение')

    expect(logSpy.mock.calls).toEqual([['полезное сообщение']])
  })

  it('глушит служебные строки WXT', () => {
    const target = createConsole()
    const logSpy = target.log as unknown as { mock: { calls: unknown[][] } }
    const infoSpy = target.info as unknown as { mock: { calls: unknown[][] } }

    installWxtDevLogFilter(target)
    target.log('[wxt] Reloading content script:', { js: ['a.js'] })
    target.info('[wxt] Content script is not registered yet, nothing to reload', {})

    expect(logSpy.mock.calls).toEqual([])
    expect(infoSpy.mock.calls).toEqual([])
  })

  it('не оборачивает консоль дважды', () => {
    const target = createConsole()
    const originalLog = target.log

    installWxtDevLogFilter(target)
    const afterFirst = target.log
    installWxtDevLogFilter(target)

    expect(target.log).toBe(afterFirst)
    expect(target.log).not.toBe(originalLog)
  })

  it('не трогает warn и error — настоящие проблемы должны быть видны', () => {
    const target = createConsole()
    const warn = target.warn
    const error = target.error

    installWxtDevLogFilter(target)

    expect(target.warn).toBe(warn)
    expect(target.error).toBe(error)
  })
})
