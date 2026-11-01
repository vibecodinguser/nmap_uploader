/**
 * Модуль перехвата сетевых ответов nspd.gov.ru с геоданными.
 */
import type { Feature, Geometry } from 'geojson'
import { extractCadastralNumber, extractRegistryNumber } from '@/lib/nspd/extractor'
import { nspdFeatureStore } from '@/lib/nspd/feature_store'

export const NSPD_INTERCEPTOR_SOURCE = 'NMAP_NSPD_INTERCEPTOR'

/**
 * Устанавливает перехватчики на window.fetch и XMLHttpRequest в контексте страницы.
 */
export const installFetchAndXhrInterceptor = (postData: (data: unknown) => void): void => {
  const win = globalThis as unknown as Record<string, unknown>
  if (win.__nmapNspdInterceptorInjected) return
  win.__nmapNspdInterceptorInjected = true

  const origFetch = window.fetch
  if (typeof origFetch === 'function') {
    window.fetch = async function (...args: Parameters<typeof origFetch>) {
      const res = await origFetch.apply(this, args)
      try {
        const clone = res.clone()
        clone
          .json()
          .then((json: unknown) => {
            if (json && typeof json === 'object') {
              postData(json)
            }
          })
          .catch(() => {})
      } catch {}
      return res
    }
  }

  const origOpen = XMLHttpRequest.prototype.open
  const origSend = XMLHttpRequest.prototype.send
  const xhrProto = XMLHttpRequest.prototype as unknown as { open: (...args: unknown[]) => void }
  xhrProto.open = function (...args: unknown[]) {
    return (origOpen as (...a: unknown[]) => void).apply(this, args)
  }
  XMLHttpRequest.prototype.send = function (...args: Parameters<typeof origSend>) {
    this.addEventListener('load', function () {
      try {
        if (this.responseText && (this.responseType === '' || this.responseType === 'text')) {
          const json = JSON.parse(this.responseText)
          if (json && typeof json === 'object') {
            postData(json)
          }
        }
      } catch {}
    })
    return origSend.apply(this, args)
  }
}

/** Код инъекции для автономного внедрения (если требуется). */
export const NSPD_PAGE_INTERCEPTOR_SCRIPT = `
(function() {
  if (window.__nmapNspdInterceptorInjected) return;
  window.__nmapNspdInterceptorInjected = true;

  function postData(data) {
    try {
      window.postMessage({ source: '${NSPD_INTERCEPTOR_SOURCE}', data: data }, '*');
    } catch (e) {}
  }

  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = async function() {
      var res = await origFetch.apply(this, arguments);
      try {
        var clone = res.clone();
        clone.json().then(function(json) {
          if (json && typeof json === 'object') {
            postData(json);
          }
        }).catch(function() {});
      } catch (e) {}
      return res;
    };
  }

  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function() {
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      try {
        if (this.responseText && (this.responseType === '' || this.responseType === 'text')) {
          var json = JSON.parse(this.responseText);
          if (json && typeof json === 'object') {
            postData(json);
          }
        }
      } catch (e) {}
    });
    return origSend.apply(this, arguments);
  };
})();
`

/** Парсит произвольный JSON-объект и сохраняет найденные геометрии в хранилище. */
export const inspectAndStorePayload = (payload: unknown): number => {
  if (!payload || typeof payload !== 'object') return 0
  let stored = 0

  const obj = payload as Record<string, unknown>

  // Случай FeatureCollection
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    for (const f of obj.features) {
      if (f && typeof f === 'object' && 'geometry' in f) {
        const feature = f as Feature
        if (feature.geometry) {
          nspdFeatureStore.add({
            geometry: feature.geometry,
            properties: feature.properties ?? {},
            cadastralNumber: extractCadastralNumber(feature.properties) ?? undefined,
            registryNumber: extractRegistryNumber(feature.properties) ?? undefined,
          })
          stored += 1
        }
      }
    }
    return stored
  }

  // Случай отдельной Feature
  if (obj.type === 'Feature' && obj.geometry) {
    const feature = obj as unknown as Feature
    nspdFeatureStore.add({
      geometry: feature.geometry,
      properties: feature.properties ?? {},
      cadastralNumber: extractCadastralNumber(feature.properties) ?? undefined,
      registryNumber: extractRegistryNumber(feature.properties) ?? undefined,
    })
    return 1
  }

  // Случай объекта с geometry / geom
  const geomCandidate = (obj.geometry ?? obj.geom) as Geometry | undefined
  if (geomCandidate && typeof geomCandidate === 'object' && 'type' in geomCandidate) {
    nspdFeatureStore.add({
      geometry: geomCandidate,
      properties: (obj.properties ?? obj) as Record<string, unknown>,
      cadastralNumber: extractCadastralNumber(obj) ?? undefined,
      registryNumber: extractRegistryNumber(obj) ?? undefined,
    })
    stored += 1
  }

  // Рекурсивно проверяем списки внутри ответа (items, features, data, result)
  for (const key of ['items', 'features', 'data', 'result', 'list', 'geometries']) {
    const list = obj[key]
    if (Array.isArray(list)) {
      for (const item of list) {
        stored += inspectAndStorePayload(item)
      }
    } else if (list && typeof list === 'object') {
      stored += inspectAndStorePayload(list)
    }
  }

  return stored
}

/** Инициализирует получение перехваченных сообщений в изолированном контексте content-скрипта. */
export const initNspdNetworkInterceptor = (): (() => void) => {
  const handleMessage = (event: MessageEvent) => {
    if (event.source !== window || !event.data || event.data.source !== NSPD_INTERCEPTOR_SOURCE) {
      return
    }
    const count = inspectAndStorePayload(event.data.data)
    if (count > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nmap:nspd-feature-stored'))
    }
  }

  window.addEventListener('message', handleMessage)

  return () => {
    window.removeEventListener('message', handleMessage)
  }
}
