import { browser } from 'wxt/browser'

export const POINT_COUNTER_ENABLED_STORAGE_KEY = 'point_counter_enabled'

export const POINT_COUNTER_STATE_MSG = 'nmap:point-counter-state'
export const POINT_COUNTER_REQUEST_MSG = 'nmap:point-counter-request'

export type PointCounterStateMessage = {
  type: typeof POINT_COUNTER_STATE_MSG
  enabled: boolean
}

export type PointCounterRequestMessage = {
  type: typeof POINT_COUNTER_REQUEST_MSG
}

/**
 * Возвращает флаг включения счетчика вершин из локального хранилища.
 * По умолчанию счетчик активен (true).
 */
export const getStoredPointCounterEnabled = async (): Promise<boolean> => {
  const stored = await browser.storage.local.get(POINT_COUNTER_ENABLED_STORAGE_KEY)
  const value = stored[POINT_COUNTER_ENABLED_STORAGE_KEY]
  return value === undefined ? true : Boolean(value)
}

/**
 * Сохраняет флаг включения счетчика вершин в локальное хранилище.
 */
export const setStoredPointCounterEnabled = async (enabled: boolean): Promise<void> => {
  await browser.storage.local.set({ [POINT_COUNTER_ENABLED_STORAGE_KEY]: enabled })
}

/**
 * Проверяет, является ли сообщение уведомлением об изменении состояния счетчика.
 */
export const isPointCounterStateMessage = (data: unknown): data is PointCounterStateMessage => {
  if (!data || typeof data !== 'object') return false
  const record = data as Partial<PointCounterStateMessage>
  return record.type === POINT_COUNTER_STATE_MSG && typeof record.enabled === 'boolean'
}

/**
 * Проверяет, является ли сообщение запросом текущего состояния счетчика.
 */
export const isPointCounterRequestMessage = (data: unknown): data is PointCounterRequestMessage => {
  if (!data || typeof data !== 'object') return false
  const record = data as Partial<PointCounterRequestMessage>
  return record.type === POINT_COUNTER_REQUEST_MSG
}
