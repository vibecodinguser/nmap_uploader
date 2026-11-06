import type { CommitAction, CommitAuthor, ObjectCommit } from './types'

/** Сырой коммит из ответа `editor/getGeoObjectCommits`. */
interface RawCommit {
  id?: unknown
  date?: unknown
  action?: unknown
  primary?: unknown
  primaryObjectId?: unknown
  approveStatus?: unknown
  state?: unknown
  editNotes?: unknown
  user?: { publicId?: unknown; displayName?: unknown; moderationStatus?: unknown } | null
}

const KNOWN_ACTIONS: readonly CommitAction[] = [
  'object-created',
  'object-deleted',
  'object-modified',
  'group-modified-attributes',
  'service',
  'import',
]

/** Приводит действие коммита к известному набору, иначе `unknown`. */
export const normalizeAction = (action: string): CommitAction => {
  const found = KNOWN_ACTIONS.find((item) => item === action)
  return found ?? 'unknown'
}

/** Человекочитаемое действие для интерфейса. */
export const describeAction = (action: CommitAction): string => {
  switch (action) {
    case 'object-created':
      return 'Объект создан'
    case 'object-deleted':
      return 'Объект удалён'
    case 'object-modified':
      return 'Объект изменён'
    case 'group-modified-attributes':
      return 'Изменены атрибуты группы'
    case 'service':
      return 'Техническая правка'
    case 'import':
      return 'Импорт'
    default:
      return 'Другое изменение'
  }
}

/** Русская подпись статуса модерации. */
export const describeApproveStatus = (status: string): string => {
  switch (status) {
    case 'published':
      return 'Опубликована'
    case 'pending':
      return 'На рассмотрении'
    case 'rejected':
      return 'Не принята'
    case 'approved':
      return 'Одобрена'
    default:
      return status || 'Без статуса'
  }
}

/**
 * Что изменилось в правке.
 *
 * `editNotes` — вложенный объект с секциями `created` / `modified` / `deleted`,
 * поэтому собираем подписи по ключам, не полагаясь на точную форму.
 */
export const describeEditNotes = (editNotes: unknown): string => {
  if (!editNotes || typeof editNotes !== 'object') {
    return ''
  }

  const notes = editNotes as Record<string, unknown>
  const parts: string[] = []

  const hasGeometry = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    if ('geometry' in record) return true
    if ('contours' in record) return true
    return Object.values(record).some(hasGeometry)
  }

  if (hasGeometry(notes.modified) || hasGeometry(notes.created)) {
    parts.push('изменена геометрия')
  }
  if (notes.created && typeof notes.created === 'object' && !hasGeometry(notes.created)) {
    parts.push('создан объект')
  }
  if (notes.deleted && typeof notes.deleted === 'object') {
    parts.push('удалён объект')
  }

  const modified = notes.modified
  if (modified && typeof modified === 'object') {
    const record = modified as Record<string, unknown>
    if ('relations' in record || 'masters' in record) {
      parts.push('изменены связи')
    }
    if ('attributes' in record || 'tags' in record) {
      parts.push('изменены атрибуты')
    }
  }

  return parts.join(', ')
}

const normalizeAuthor = (user: RawCommit['user']): CommitAuthor | null => {
  if (!user || typeof user !== 'object') {
    return null
  }
  const publicId = typeof user.publicId === 'string' ? user.publicId : ''
  const displayName =
    typeof user.displayName === 'string' && user.displayName ? user.displayName : publicId
  if (!publicId) {
    return null
  }
  const rawStatus = (user as { moderationStatus?: unknown }).moderationStatus
  return {
    publicId,
    displayName,
    moderationStatus: typeof rawStatus === 'string' ? rawStatus : undefined,
  }
}

/** Проверяет, что значение похоже на коммит истории объекта. */
const isRawCommit = (value: unknown): value is RawCommit =>
  Boolean(value) && typeof value === 'object' && typeof (value as RawCommit).id === 'string'

/**
 * Приводит сырой коммит к доменной модели.
 * Возвращает `null`, если запись не является коммитом (например, служебный элемент).
 */
export const normalizeCommit = (raw: unknown, fallbackObjectId: string): ObjectCommit | null => {
  if (!isRawCommit(raw)) {
    return null
  }

  const id = String(raw.id)
  const objectId = typeof raw.primaryObjectId === 'string' ? raw.primaryObjectId : fallbackObjectId
  const date = typeof raw.date === 'string' ? raw.date : ''
  const action = normalizeAction(typeof raw.action === 'string' ? raw.action : '')

  return {
    id,
    objectId,
    date,
    action,
    approveStatus: typeof raw.approveStatus === 'string' ? raw.approveStatus : '',
    state: typeof raw.state === 'string' ? raw.state : '',
    primary: raw.primary !== false,
    author: normalizeAuthor(raw.user),
    summary: describeEditNotes(raw.editNotes),
  }
}

/** Приводит список сырых коммитов, отбрасывая мусор. */
export const normalizeCommits = (rawCommits: unknown, objectId: string): ObjectCommit[] => {
  if (!Array.isArray(rawCommits)) {
    return []
  }
  return rawCommits
    .map((raw) => normalizeCommit(raw, objectId))
    .filter((commit): commit is ObjectCommit => commit !== null)
}
