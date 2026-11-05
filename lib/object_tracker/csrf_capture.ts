/**
 * Перехват CSRF-токена в MAIN world.
 *
 * Приложение кладёт токен в заголовок `x-csrf-token` каждого своего запроса,
 * но нигде его не сохраняет наружу. Перехватываем заголовки и пересылаем токен
 * в изолированный content script через `postMessage`.
 *
 * Модуль не импортирует `wxt/browser`: он исполняется в контексте страницы.
 */
import { CSRF_HEADER, CSRF_MESSAGE_SOURCE } from './csrf_bridge'

const INSTALLED_FLAG = '__nmapCsrfCaptureInstalled'

type CsrfWindow = Window & {
  [INSTALLED_FLAG]?: boolean
}

const postToken = (token: string): void => {
  if (!token) {
    return
  }
  try {
    window.postMessage({ source: CSRF_MESSAGE_SOURCE, token }, window.location.origin)
  } catch {
    // Молча: перехват не должен ломать страницу.
  }
}

/** Достаёт значение заголовка из разных форм, которые принимает fetch. */
const readHeader = (headers: HeadersInit | undefined, name: string): string | null => {
  if (!headers) {
    return null
  }

  try {
    if (typeof Headers !== 'undefined' && headers instanceof Headers) {
      return headers.get(name)
    }
    if (Array.isArray(headers)) {
      const found = headers.find((pair) => String(pair[0]).toLowerCase() === name)
      return found ? String(found[1]) : null
    }
    const record = headers as Record<string, string>
    const key = Object.keys(record).find((item) => item.toLowerCase() === name)
    return key ? String(record[key]) : null
  } catch {
    return null
  }
}

const installFetchHook = (): void => {
  const originalFetch = window.fetch
  if (typeof originalFetch !== 'function') {
    return
  }

  const hooked = async function csrfFetch(
    this: unknown,
    input: RequestInfo | URL,
    init?: RequestInit,
  ) {
    try {
      const fromInit = readHeader(init?.headers, CSRF_HEADER)
      const fromRequest =
        !fromInit && input && typeof input === 'object' && 'headers' in input
          ? readHeader((input as Request).headers, CSRF_HEADER)
          : null
      const token = fromInit ?? fromRequest
      if (token) {
        postToken(token)
      }
    } catch {
      // ignore
    }
    return originalFetch.call(this, input, init)
  }

  try {
    Object.defineProperty(window, 'fetch', {
      value: hooked,
      configurable: true,
      writable: true,
    })
  } catch {
    // Если свойство не переопределяется, остаётся XHR-перехват.
  }
}

type XhrWithHeaders = XMLHttpRequest & {
  __nmapCsrf?: { token: string | null }
}

const installXhrHook = (): void => {
  const proto = XMLHttpRequest.prototype as unknown as Record<string, unknown>
  const originalSetRequestHeader = proto.setRequestHeader as
    | ((this: XhrWithHeaders, name: string, value: string) => void)
    | undefined

  if (typeof originalSetRequestHeader !== 'function') {
    return
  }

  proto.setRequestHeader = function csrfSetRequestHeader(
    this: XhrWithHeaders,
    name: string,
    value: string,
  ) {
    try {
      if (String(name).toLowerCase() === CSRF_HEADER) {
        this.__nmapCsrf = { token: String(value) }
        postToken(String(value))
      }
    } catch {
      // ignore
    }
    return originalSetRequestHeader.call(this, name, value)
  }
}

/** Идемпотентно ставит перехватчики заголовков. */
export const installCsrfCapture = (): void => {
  const csrfWindow = window as CsrfWindow
  if (csrfWindow[INSTALLED_FLAG]) {
    return
  }
  csrfWindow[INSTALLED_FLAG] = true

  installFetchHook()
  installXhrHook()
}
