import { browser } from 'wxt/browser'
import {
  DEFAULT_INTERVAL_MINUTES,
  MAX_INTERVAL_MINUTES,
  MAX_TRACKED_OBJECTS,
  MIN_INTERVAL_MINUTES,
  type ObjectCommit,
  type TrackedObject,
  type TrackerLocalState,
  type TrackerSettings,
} from './types'

export const TRACKER_ENABLED_KEY = 'object_tracker_enabled'
export const TRACKER_INTERVAL_KEY = 'object_tracker_interval_minutes'
export const TRACKER_OBJECTS_KEY = 'object_tracker_objects'
export const TRACKER_READ_MARKS_KEY = 'object_tracker_read_marks'
export const TRACKER_CACHED_COMMITS_KEY = 'object_tracker_cached_commits'

/** id объекта в редакторе — числовая строка. */
export const isValidObjectId = (value: string): boolean => /^\d{1,20}$/.test(value.trim())

/** Приводит id к каноническому виду: без пробелов и ведущих нулей не трогаем. */
export const normalizeObjectId = (value: string): string => value.trim()

/** Ограничивает период опроса разумными рамками. */
export const clampIntervalMinutes = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_INTERVAL_MINUTES
  }
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Math.round(value)))
}

/** Убирает дубли и превышение лимита, сохраняя порядок добавления. */
export const sanitizeTrackedObjects = (objects: readonly TrackedObject[]): TrackedObject[] => {
  const seen = new Set<string>()
  const result: TrackedObject[] = []

  for (const object of objects) {
    const id = normalizeObjectId(object?.id ?? '')
    if (!isValidObjectId(id) || seen.has(id)) {
      continue
    }
    seen.add(id)
    result.push({
      id,
      title: typeof object.title === 'string' ? object.title : '',
      addedAt: typeof object.addedAt === 'number' ? object.addedAt : Date.now(),
    })
    if (result.length >= MAX_TRACKED_OBJECTS) {
      break
    }
  }

  return result
}

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const parseObjects = (value: unknown): TrackedObject[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return sanitizeTrackedObjects(
    value.filter((item): item is TrackedObject => Boolean(item) && typeof item === 'object'),
  )
}

/** Читает синхронизируемые настройки наблюдения. */
export const getTrackerSettings = async (): Promise<TrackerSettings> => {
  const stored = await browser.storage.sync.get([
    TRACKER_ENABLED_KEY,
    TRACKER_INTERVAL_KEY,
    TRACKER_OBJECTS_KEY,
  ])

  const rawInterval = stored[TRACKER_INTERVAL_KEY]
  const interval =
    typeof rawInterval === 'number' ? clampIntervalMinutes(rawInterval) : DEFAULT_INTERVAL_MINUTES

  return {
    enabled: readBoolean(stored[TRACKER_ENABLED_KEY], false),
    intervalMinutes: interval,
    objects: parseObjects(stored[TRACKER_OBJECTS_KEY]),
  }
}

export const setTrackerEnabled = async (enabled: boolean): Promise<void> => {
  await browser.storage.sync.set({ [TRACKER_ENABLED_KEY]: enabled })
}

export const setTrackerInterval = async (minutes: number): Promise<void> => {
  await browser.storage.sync.set({ [TRACKER_INTERVAL_KEY]: clampIntervalMinutes(minutes) })
}

export const setTrackedObjects = async (objects: readonly TrackedObject[]): Promise<void> => {
  await browser.storage.sync.set({ [TRACKER_OBJECTS_KEY]: sanitizeTrackedObjects(objects) })
}

/** Читает локальное состояние устройства: отметки прочтения и кэш истории. */
export const getTrackerLocalState = async (): Promise<TrackerLocalState> => {
  const stored = await browser.storage.local.get([
    TRACKER_READ_MARKS_KEY,
    TRACKER_CACHED_COMMITS_KEY,
  ])

  const rawMarks = stored[TRACKER_READ_MARKS_KEY]
  const readMarks: Record<string, string> = {}
  if (rawMarks && typeof rawMarks === 'object') {
    for (const [key, value] of Object.entries(rawMarks as Record<string, unknown>)) {
      if (typeof value === 'string') {
        readMarks[key] = value
      }
    }
  }

  const rawCache = stored[TRACKER_CACHED_COMMITS_KEY]
  const cachedCommits: Record<string, ObjectCommit[]> = {}
  if (rawCache && typeof rawCache === 'object') {
    for (const [key, value] of Object.entries(rawCache as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        cachedCommits[key] = value as ObjectCommit[]
      }
    }
  }

  return { readMarks, cachedCommits }
}

export const setReadMarks = async (marks: Record<string, string>): Promise<void> => {
  await browser.storage.local.set({ [TRACKER_READ_MARKS_KEY]: marks })
}

export const setCachedCommits = async (cache: Record<string, ObjectCommit[]>): Promise<void> => {
  await browser.storage.local.set({ [TRACKER_CACHED_COMMITS_KEY]: cache })
}

/** Удаляет локальные данные объекта при снятии с наблюдения. */
export const forgetObjectLocalState = async (objectId: string): Promise<void> => {
  const state = await getTrackerLocalState()

  const readMarks = { ...state.readMarks }
  delete readMarks[objectId]

  const cachedCommits = { ...state.cachedCommits }
  delete cachedCommits[objectId]

  await browser.storage.local.set({
    [TRACKER_READ_MARKS_KEY]: readMarks,
    [TRACKER_CACHED_COMMITS_KEY]: cachedCommits,
  })
}
