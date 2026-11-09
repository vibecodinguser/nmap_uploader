/** Доменные типы наблюдения за историей конкретного объекта карты. */

/** Объект, добавленный пользователем в отслеживание. */
export interface TrackedObject {
  /** id объекта в редакторе Народной карты (числовая строка). */
  id: string
  /** Название на момент добавления: для шаблонных title показываем id. */
  title: string
  /** Категория объекта: нужна для нативной иконки в карточке события. */
  categoryId?: string
  /** Когда объект добавлен (мс). */
  addedAt: number
}

/** Коммит истории объекта в нормализованном виде. */
export interface ObjectCommit {
  id: string
  objectId: string
  /** ISO-дата коммита. */
  date: string
  action: CommitAction
  approveStatus: string
  state: string
  /** Основная правка объекта, а не косвенная (например, связь). */
  primary: boolean
  author: CommitAuthor | null
  /** Что именно изменилось, человекочитаемо. */
  summary: string
}

export interface CommitAuthor {
  publicId: string
  displayName: string
  /** `moderator`, `expert`, … — в нативной ленте показывается иконкой у имени. */
  moderationStatus?: string
}

export type CommitAction =
  | 'object-created'
  | 'object-deleted'
  | 'object-modified'
  | 'group-modified-attributes'
  | 'service'
  | 'import'
  | 'unknown'

export interface ObjectHistoryPage {
  commits: ObjectCommit[]
  totalCount: number
  page: number
  perPage: number
}

/** Настройки, которые переезжают между устройствами. */
export interface TrackerSettings {
  enabled: boolean
  objects: TrackedObject[]
}

/** Локальные данные устройства: не синхронизируются. */
export interface TrackerLocalState {
  /** Последний увиденный коммит по каждому объекту. */
  readMarks: Record<string, string>
  /** Кэш первой страницы истории: нужен, чтобы таб открывался мгновенно. */
  cachedCommits: Record<string, ObjectCommit[]>
}

/** Период фонового опроса истории: 3 часа. */
export const POLL_INTERVAL_MINUTES = 180
export const MAX_TRACKED_OBJECTS = 30
