/**
 * Модуль перехвата сетевых ответов nspd.gov.ru с геоданными.
 */
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { extractCadastralNumber } from '@/lib/nspd/extractor'
import { nspdFeatureStore } from '@/lib/nspd/feature_store'

export const NSPD_INTERCEPTOR_SOURCE = 'NMAP_NSPD_INTERCEPTOR'

/** Код инъекции в контекст страницы nspd.gov.ru. */
export const NSPD_PAGE_INTERCEPTOR_SCRIPT = `
(function() {
  if (window.__nmapNspdInterceptorInjected) return;
  window.__nmapNspdInterceptorInjected = true;

  function postData(data) {
    try {
      window.postMessage({ source: '${NSPD_INTERCEPTOR_SOURCE}', data }, '*');
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

/** Внедряет скрипт перехвата в страницу и подписывается на сообщения. */
export const initNspdNetworkInterceptor = (): (() => void) => {
  const handleMessage = (event: MessageEvent) => {
    if (event.source !== window || !event.data || event.data.source !== NSPD_INTERCEPTOR_SOURCE) {
      return
    }
    inspectAndStorePayload(event.data.data)
  }

  window.addEventListener('message', handleMessage)

  try {
    const script = document.createElement('script')
    script.textContent = NSPD_PAGE_INTERCEPTOR_SCRIPT
    ;(document.head || document.documentElement).appendChild(script)
    script.remove()
  } catch (err) {
    console.error('[nmap_uploader] failed to inject NSPD interceptor script', err)
  }

  return () => {
    window.removeEventListener('message', handleMessage)
  }
}
