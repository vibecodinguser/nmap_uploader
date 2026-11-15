// @vitest-environment node

/**
 * Фильтр dev-шума WXT.
 *
 * WXT печатает «Reloading content script» на каждый скрипт при пересборке, а
 * для рантайм-скриптов НСПД — «not registered yet». Это не ошибки, и они
 * закрывают в консоли то, что важно.
 */
import { describe, expect, it } from 'vitest'
import { shouldSilenceWxtLog } from '@/lib/wxt_log_filter'

describe('shouldSilenceWxtLog', () => {
  it('скрывает строку о перезагрузке content script', () => {
    expect(
      shouldSilenceWxtLog([
        'Reloading content script:',
        { js: ['content-scripts/nspd-collector.js'] },
      ]),
    ).toBe(true)
  })

  it('скрывает строку о незарегистрированном рантайм-скрипте', () => {
    expect(
      shouldSilenceWxtLog([
        'Content script is not registered yet, nothing to reload',
        { js: ['content-scripts/nspd-collector.js'] },
      ]),
    ).toBe(true)
  })

  it('не трогает сообщения сборки', () => {
    expect(shouldSilenceWxtLog(['Built extension in 793 ms'])).toBe(false)
    expect(shouldSilenceWxtLog(['Started dev server @ http://localhost:3000'])).toBe(false)
  })

  it('не трогает предупреждения и ошибки', () => {
    expect(shouldSilenceWxtLog(['Failed to update .wxt directory:'])).toBe(false)
    expect(shouldSilenceWxtLog(['Entrypoint validation failed: 1 error'])).toBe(false)
  })

  it('не трогает сообщения без текста', () => {
    expect(shouldSilenceWxtLog([{ some: 'object' }])).toBe(false)
    expect(shouldSilenceWxtLog([])).toBe(false)
  })
})
