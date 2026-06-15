const listeners = new Set<() => void>()
let cacheEpoch = 0

export const getOccupiedDatesCacheEpoch = (): number => cacheEpoch

/** Сбрасывает кэш дат с папками на Диске (после загрузки и т.п.). */
export const invalidateOccupiedDatesCache = (): void => {
  cacheEpoch += 1
  for (const listener of listeners) {
    listener()
  }
}

export const subscribeOccupiedDatesCache = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
