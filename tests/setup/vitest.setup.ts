import { DOMParser as XmlDomParser } from '@xmldom/xmldom'
import { setupServer } from 'msw/node'

if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = XmlDomParser as unknown as typeof DOMParser
}

import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { resetBrowserMocks } from './browser_mock'
import { resetYandexMockState, yandexHandlers } from './yandex_handlers'

export const server = setupServer(...yandexHandlers)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  resetYandexMockState()
})

afterAll(() => {
  server.close()
})

beforeEach(async () => {
  await resetBrowserMocks()
})
