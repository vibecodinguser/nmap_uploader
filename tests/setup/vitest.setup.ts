import { DOMParser as XmlDomParser } from '@xmldom/xmldom'
import { Storage } from 'happy-dom'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, expect } from 'vitest'
import * as axeMatchers from 'vitest-axe/matchers'
import { YANDEX_PERMISSION_REQUEST } from '@/lib/manifest/yandex_optional_hosts'
import { permissionsMock, resetBrowserMocks } from './browser_mock'
import { resetYandexMockState, yandexHandlers } from './yandex_handlers'

/*
 * Node 26 объявляет `localStorage` в глобальном объекте и без флага
 * `--localstorage-file` возвращает `undefined`. Его getter перебивает тот,
 * что создаёт happy-dom, поэтому тесты happy-dom падали на `localStorage`
 * даже там, где браузерное окружение их поднимало. Здесь подставляется
 * настоящее хранилище happy-dom — только если глобальное не работает.
 */
function ensureWorkingLocalStorage(): void {
  const win = globalThis.window as unknown as Record<string, unknown> | undefined
  if (!win) return

  const hasStorage = (value: unknown): boolean =>
    typeof (value as { setItem?: unknown } | null)?.setItem === 'function'

  if (hasStorage(globalThis.localStorage)) return

  const storage = new Storage()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => storage,
  })
  Object.defineProperty(win, 'localStorage', {
    configurable: true,
    get: () => storage,
  })
}

ensureWorkingLocalStorage()

globalThis.DOMParser ??= class MockDOMParser {
  parseFromString(str: string, type: string): Document {
    let hasError = false
    const parser = new XmlDomParser({
      onError: () => {
        hasError = true
      },
    })
    let doc: any
    try {
      doc = parser.parseFromString(str, type)
    } catch {
      return new XmlDomParser().parseFromString(
        '<error><parsererror/></error>',
        type,
      ) as unknown as Document
    }

    if (hasError) {
      const errorNode = doc.createElement('parsererror')
      if (doc.documentElement) {
        doc.documentElement.appendChild(errorNode)
      } else {
        doc.appendChild(errorNode)
      }
    }
    return doc
  }
} as any

expect.extend(axeMatchers)

export const server = setupServer(...yandexHandlers)

function startMockServer(): void {
  server.listen({ onUnhandledRequest: 'error' })
}

function resetMockServerHandlers(): void {
  server.resetHandlers()
  resetYandexMockState()
}

function stopMockServer(): void {
  server.close()
}

async function resetMocksBeforeTest(): Promise<void> {
  await resetBrowserMocks()
  /*
   * Разрешения Яндекса — необязательные (ADR 0022): без выдачи любой вход,
   * загрузка и заметки отвечали бы `PERMISSION_REQUIRED`. Тестам, которые
   * проверяют бизнес-логику, этот шаг не нужен, поэтому в фикстуре
   * разрешения выдаются по умолчанию, а отсутствие выдачи моделируется
   * `permissionsMock.revoke(...)`.
   */
  permissionsMock.grant(...YANDEX_PERMISSION_REQUEST.origins)
}

beforeAll(startMockServer)
afterEach(resetMockServerHandlers)
afterAll(stopMockServer)
beforeEach(resetMocksBeforeTest)
