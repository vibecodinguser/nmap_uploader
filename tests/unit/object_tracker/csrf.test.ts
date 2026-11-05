// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CSRF_HEADER, CSRF_MESSAGE_SOURCE, isCsrfMessage } from '@/lib/object_tracker/csrf_bridge'
import { installCsrfCapture } from '@/lib/object_tracker/csrf_capture'
import {
  getCsrfToken,
  hasCsrfToken,
  installCsrfTokenListener,
  resetCsrfToken,
} from '@/lib/object_tracker/csrf_token'

const originalFetch = window.fetch

const setFetch = (next: typeof window.fetch): void => {
  Object.defineProperty(window, 'fetch', { value: next, configurable: true, writable: true })
}

const CAPTURE_FLAG = '__nmapCsrfCaptureInstalled'

const resetCapture = (): void => {
  delete (window as unknown as Record<string, unknown>)[CAPTURE_FLAG]
}

describe('object_tracker: isCsrfMessage', () => {
  it('принимает сообщение нашего формата', () => {
    expect(isCsrfMessage({ source: CSRF_MESSAGE_SOURCE, token: 'abc' })).toBe(true)
  })

  it('отклоняет чужие сообщения', () => {
    expect(isCsrfMessage({ source: 'other', token: 'abc' })).toBe(false)
    expect(isCsrfMessage({ source: CSRF_MESSAGE_SOURCE })).toBe(false)
    expect(isCsrfMessage(null)).toBe(false)
    expect(isCsrfMessage('строка')).toBe(false)
  })
})

describe('object_tracker: csrf_token', () => {
  beforeEach(() => {
    resetCsrfToken()
  })

  it('начинает с пустого токена', () => {
    expect(getCsrfToken()).toBe('')
    expect(hasCsrfToken()).toBe(false)
  })

  it('запоминает токен из сообщения окна', () => {
    const uninstall = installCsrfTokenListener()

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: CSRF_MESSAGE_SOURCE, token: 'token-1' },
        source: window,
      }),
    )

    expect(getCsrfToken()).toBe('token-1')
    expect(hasCsrfToken()).toBe(true)
    uninstall()
  })

  it('игнорирует сообщения из другого источника', () => {
    const uninstall = installCsrfTokenListener()

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: CSRF_MESSAGE_SOURCE, token: 'чужая' },
        source: null,
      }),
    )

    expect(getCsrfToken()).toBe('')
    uninstall()
  })

  it('сбрасывает токен', () => {
    const uninstall = installCsrfTokenListener()
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: CSRF_MESSAGE_SOURCE, token: 'token' },
        source: window,
      }),
    )

    resetCsrfToken()

    expect(getCsrfToken()).toBe('')
    uninstall()
  })
})

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('object_tracker: перехват CSRF', () => {
  const received: string[] = []

  const handleMessage = (event: MessageEvent): void => {
    if (event.data?.source === CSRF_MESSAGE_SOURCE) {
      received.push(String(event.data.token))
    }
  }

  beforeEach(() => {
    received.length = 0
    resetCapture()
    window.addEventListener('message', handleMessage)
  })

  afterEach(() => {
    window.removeEventListener('message', handleMessage)
    setFetch(originalFetch)
    resetCapture()
    vi.restoreAllMocks()
  })

  it('запоминает токен из заголовков fetch', async () => {
    setFetch(vi.fn(async () => new Response('{}')) as unknown as typeof window.fetch)
    installCsrfCapture()

    await window.fetch('/api/v2/batch', {
      method: 'POST',
      headers: { [CSRF_HEADER]: 'fetch-token' },
    })
    await flush()

    expect(received).toContain('fetch-token')
  })

  it('понимает заголовки в форме Headers', async () => {
    setFetch(vi.fn(async () => new Response('{}')) as unknown as typeof window.fetch)
    installCsrfCapture()

    await window.fetch('/api/v2/batch', {
      headers: new Headers({ [CSRF_HEADER]: 'headers-token' }),
    })
    await flush()

    expect(received).toContain('headers-token')
  })

  it('не падает на запросе без заголовков', async () => {
    setFetch(vi.fn(async () => new Response('{}')) as unknown as typeof window.fetch)
    installCsrfCapture()

    await expect(window.fetch('/api/v2/batch')).resolves.toBeDefined()
    await flush()
    expect(received).toHaveLength(0)
  })

  it('перехватывает токен из XHR', async () => {
    installCsrfCapture()

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/v2/batch')
    xhr.setRequestHeader(CSRF_HEADER, 'xhr-token')
    await flush()

    expect(received).toContain('xhr-token')
  })

  it('идемпотентен: повторная установка не дублирует перехват', async () => {
    setFetch(vi.fn(async () => new Response('{}')) as unknown as typeof window.fetch)
    installCsrfCapture()
    installCsrfCapture()

    await window.fetch('/api', { headers: { [CSRF_HEADER]: 'once' } })
    await flush()

    expect(received.filter((token) => token === 'once')).toHaveLength(1)
  })
})
