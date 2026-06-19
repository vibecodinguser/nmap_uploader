import { defineContentScript } from 'wxt/utils/define-content-script';
import { notifyNmapsBoundsChange } from '@/lib/nmaps_bounds_notify';
import { NMAPS_MAP_RESIZE_EVENT } from '@/lib/nmaps_map_resize_notify';
import { notifyNmapsUrlChange } from '@/lib/nmaps_url_notify';

const MAP_DISCOVERY_POLL_MS = 500;
const MAP_DISCOVERY_TIMEOUT_MS = 30_000;

type YmapsMapLike = {
  getCenter: () => [number, number];
  getZoom: () => number;
  events: {
    add: (event: string, handler: (...args: unknown[]) => void) => void;
    remove: (event: string, handler: (...args: unknown[]) => void) => void;
  };
};

type YmapsGlobal = {
  Map?: new (...args: unknown[]) => YmapsMapLike;
  ready?: (callback: () => void) => void;
};

type YmapsMapWithContainer = {
  container?: { fitToViewport?: () => void };
};

const isNonNullObject = (value: unknown): value is Record<string, unknown> => {
  let result = false;
  if (typeof value === 'object') {
    if (value !== null) {
      result = true;
    }
  }
  return result;
};

const hasYmapsEventsAdd = (record: Record<string, unknown>): boolean => {
  const events = record.events;
  let result = false;
  if (isNonNullObject(events)) {
    if (typeof events.add === 'function') {
      result = true;
    }
  }
  return result;
};

const isYmapsMapLike = (value: unknown): value is YmapsMapLike => {
  let result = false;
  if (isNonNullObject(value)) {
    if (typeof value.getCenter === 'function') {
      if (typeof value.getZoom === 'function') {
        if (hasYmapsEventsAdd(value)) {
          result = true;
        }
      }
    }
  }
  return result;
};

const findMapInElement = (element: Element): YmapsMapLike | null => {
  const record = element as unknown as Record<string, unknown>;
  const keys = Object.keys(record);
  let map: YmapsMapLike | null = null;
  for (let index = 0; index < keys.length && map === null; index += 1) {
    const value = record[keys[index]];
    if (isYmapsMapLike(value)) {
      map = value;
    }
  }
  return map;
};

const findMapInSelector = (selector: string): YmapsMapLike | null => {
  const elements = document.querySelectorAll(selector);
  let map: YmapsMapLike | null = null;
  for (let index = 0; index < elements.length && map === null; index += 1) {
    const candidate = findMapInElement(elements[index]);
    if (candidate) {
      map = candidate;
    }
  }
  return map;
};

/** Ищет экземпляр ymaps-карты через DOM-сканирование контейнеров. */
const findMapInstanceFromDom = (): YmapsMapLike | null => {
  const selectors = [
    "[class*='ymaps-2'][class*='-map']",
    "[class*='ymaps'][class*='map']",
    '.ymaps-map',
  ];

  let map: YmapsMapLike | null = null;
  for (let index = 0; index < selectors.length && map === null; index += 1) {
    const candidate = findMapInSelector(selectors[index]);
    if (candidate) {
      map = candidate;
    }
  }
  return map;
};

/** Находит карту через глобальный ymaps API (если доступен). */
const findMapFromGlobalYmaps = (): YmapsMapLike | null => {
  const windowRecord = window as unknown as Record<string, unknown>;
  const ymaps = windowRecord.ymaps as YmapsGlobal | undefined;
  let map: YmapsMapLike | null = null;
  if (ymaps) {
    map = findMapInstanceFromDom();
  }
  return map;
};

const dispatchWindowResize = (): void => {
  const resizeEvent = new Event('resize');
  window.dispatchEvent(resizeEvent);
};

const findActiveMap = (): YmapsMapLike | null => {
  return findMapFromGlobalYmaps() ?? findMapInstanceFromDom();
};

/** Пересчитывает размер карты после изменения layout страницы. */
const requestMapRepaint = (): void => {
  dispatchWindowResize();

  const map = findActiveMap();
  if (map) {
    try {
      const container = (map as unknown as YmapsMapWithContainer).container;
      container?.fitToViewport?.();
    } catch {
      // Объект карты мог быть уничтожен
    }
  }
};

const isValidMapView = (center: unknown, zoom: unknown): center is [number, number] => {
  let result = false;
  if (Array.isArray(center)) {
    if (Number.isFinite(center[0])) {
      if (Number.isFinite(center[1])) {
        if (Number.isFinite(zoom)) {
          result = true;
        }
      }
    }
  }
  return result;
};

/** Подписывается на события карты и транслирует координаты через CustomEvent. */
const subscribeToMapEvents = (map: YmapsMapLike): void => {
  const handleBoundsChange = (): void => {
    try {
      const center = map.getCenter();
      const zoom = map.getZoom();
      if (isValidMapView(center, zoom)) {
        notifyNmapsBoundsChange({
          latitude: center[0],
          longitude: center[1],
          zoom,
        });
      }
    } catch {
      // Объект карты мог быть уничтожен
    }
  };

  map.events.add('boundschange', handleBoundsChange);
  map.events.add('actiontick', handleBoundsChange);
};

/** Запускает поиск ymaps-карты с retry и таймаутом. */
const startMapDiscovery = (): void => {
  const startedAt = Date.now();

  const poll = (): void => {
    const timedOut = Date.now() - startedAt > MAP_DISCOVERY_TIMEOUT_MS;
    if (!timedOut) {
      const map = findActiveMap();
      if (map) {
        subscribeToMapEvents(map);
      } else {
        setTimeout(poll, MAP_DISCOVERY_POLL_MS);
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', poll, { once: true });
  } else {
    poll();
  }
};

type HistoryStateMethod = typeof history.pushState;

const wrapHistoryMethod = (method: 'pushState' | 'replaceState', onChange: () => void): void => {
  const original: HistoryStateMethod = history[method].bind(history);
  const patched: HistoryStateMethod = (...args: Parameters<HistoryStateMethod>): void => {
    original(...args);
    queueMicrotask(onChange);
  };
  if (method === 'pushState') {
    history.pushState = patched;
  } else {
    history.replaceState = patched;
  }
};

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_start',
  world: 'MAIN',

  main() {
    window.addEventListener('hashchange', notifyNmapsUrlChange);
    window.addEventListener('popstate', notifyNmapsUrlChange);

    wrapHistoryMethod('pushState', notifyNmapsUrlChange);
    wrapHistoryMethod('replaceState', notifyNmapsUrlChange);

    startMapDiscovery();

    document.addEventListener(NMAPS_MAP_RESIZE_EVENT, requestMapRepaint);
  },
});
