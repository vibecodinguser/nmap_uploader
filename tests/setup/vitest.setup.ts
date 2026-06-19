import { DOMParser as XmlDomParser } from '@xmldom/xmldom';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import { resetBrowserMocks } from './browser_mock';
import { resetYandexMockState, yandexHandlers } from './yandex_handlers';

if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = XmlDomParser as unknown as typeof DOMParser;
}

expect.extend(axeMatchers);

export const server = setupServer(...yandexHandlers);

function startMockServer(): void {
  server.listen({ onUnhandledRequest: 'error' });
}

function resetMockServerHandlers(): void {
  server.resetHandlers();
  resetYandexMockState();
}

function stopMockServer(): void {
  server.close();
}

async function resetMocksBeforeTest(): Promise<void> {
  await resetBrowserMocks();
}

beforeAll(startMockServer);
afterEach(resetMockServerHandlers);
afterAll(stopMockServer);
beforeEach(resetMocksBeforeTest);
