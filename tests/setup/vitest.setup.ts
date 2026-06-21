import { DOMParser as XmlDomParser } from '@xmldom/xmldom'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, expect } from 'vitest'
import * as axeMatchers from 'vitest-axe/matchers'
import { resetBrowserMocks } from './browser_mock'
import { resetYandexMockState, yandexHandlers } from './yandex_handlers'

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
}

beforeAll(startMockServer)
afterEach(resetMockServerHandlers)
afterAll(stopMockServer)
beforeEach(resetMocksBeforeTest)
