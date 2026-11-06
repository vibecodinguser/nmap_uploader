import {
  type BatchTransport,
  CsrfTokenRejectedError,
  getGeoObjectCall,
  getObjectCommitsCall,
  parseCommitsResult,
  parseGeoObjectResult,
} from './batch_api'
import type { ObjectCommit, TrackedObject } from './types'

/**
 * Считает коммиты, которых пользователь ещё не видел.
 *
 * Отметка прочтения — id последнего просмотренного коммита. Всё, что новее
 * идёт до неё включительно, считается новым. Если отметки нет (объект только
 * добавили), новой считается пустота: иначе вся история разом попала бы в счётчик.
 */
export const computeNewCommits = (
  commits: readonly ObjectCommit[],
  readMarkId: string | undefined,
): ObjectCommit[] => {
  if (!readMarkId) {
    return []
  }

  const result: ObjectCommit[] = []
  for (const commit of commits) {
    if (commit.id === readMarkId) {
      break
    }
    result.push(commit)
  }
  return result
}

export interface PollDeps {
  transport: BatchTransport
  token: string
}

export interface PollResult {
  /** Первая страница истории по каждому объекту. */
  commitsByObject: Record<string, ObjectCommit[]>
  /** Новые коммиты, ещё не показанные пользователю. */
  newCommits: ObjectCommit[]
  /** Ошибки по объектам: id → тип ошибки. */
  errors: Record<string, string>
  /** Токен не принят сервером: нужен новый перехват. */
  tokenRejected: boolean
  /** Уточнённые данные объектов: название и категория для иконки. */
  enrichedObjects: Record<string, { title: string | null; categoryId: string | null }>
}

const emptyResult = (): PollResult => ({
  commitsByObject: {},
  newCommits: [],
  errors: {},
  tokenRejected: false,
  enrichedObjects: {},
})

/**
 * Опрашивает историю всех объектов **одним** batch-запросом.
 *
 * Запрашивается только первая страница: её достаточно, чтобы заметить новые
 * правки. Полная история грузится отдельно при открытии объекта.
 */
export const pollTrackedObjects = async (
  deps: PollDeps,
  objects: readonly TrackedObject[],
  readMarks: Record<string, string>,
): Promise<PollResult> => {
  if (objects.length === 0) {
    return emptyResult()
  }

  if (!deps.token) {
    return { ...emptyResult(), errors: { '*': 'NO_TOKEN' } }
  }

  /*
   * Объектам без категории нужен `editor/getGeoObject`: без него в карточке
   * остаётся серый placeholder вместо иконки. Запрашиваем отдельным batch —
   * смешивать с историей рискованно, а платим только пока категория неизвестна.
   */
  const missingDetails = objects.filter((object) => !object.categoryId)
  const commitsCalls = objects.map((object) => getObjectCommitsCall(object.id))

  let results: Awaited<ReturnType<BatchTransport>>
  try {
    results = await deps.transport(commitsCalls, deps.token)
  } catch (error: unknown) {
    if (error instanceof CsrfTokenRejectedError) {
      return { ...emptyResult(), tokenRejected: true }
    }
    throw error
  }

  const enrichedObjects: Record<string, { title: string | null; categoryId: string | null }> = {}

  if (missingDetails.length > 0) {
    try {
      const detailsResults = await deps.transport(
        missingDetails.map((object) => getGeoObjectCall(object.id)),
        deps.token,
      )

      missingDetails.forEach((object, index) => {
        const info = parseGeoObjectResult(detailsResults[index])
        if (info.exists) {
          enrichedObjects[object.id] = { title: info.title, categoryId: info.categoryId }
        }
      })
    } catch (error: unknown) {
      if (error instanceof CsrfTokenRejectedError) {
        return { ...emptyResult(), tokenRejected: true }
      }
      // История уже получена: сбой уточнения не должен её терять.
      console.warn('[nmap_uploader] object tracker details failed:', error)
    }
  }

  const commitsByObject: Record<string, ObjectCommit[]> = {}
  const errors: Record<string, string> = {}
  const newCommits: ObjectCommit[] = []

  objects.forEach((object, index) => {
    const result = results[index]
    if (result?.error) {
      errors[object.id] = result.error.type
      return
    }

    const page = parseCommitsResult(result, object.id)
    commitsByObject[object.id] = page.commits

    for (const commit of computeNewCommits(page.commits, readMarks[object.id])) {
      newCommits.push(commit)
    }
  })

  newCommits.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))

  return { commitsByObject, newCommits, errors, tokenRejected: false, enrichedObjects }
}

/** Сколько всего новых правок: основа для бейджа. */
export const countNewCommits = (result: PollResult): number => result.newCommits.length

/**
 * Новая отметка прочтения: id самого свежего коммита по объекту.
 * Если истории нет, отметка не меняется.
 */
export const buildReadMarks = (
  commitsByObject: Record<string, ObjectCommit[]>,
  previous: Record<string, string>,
): Record<string, string> => {
  const marks = { ...previous }

  for (const [objectId, commits] of Object.entries(commitsByObject)) {
    const latest = commits[0]
    if (latest) {
      marks[objectId] = latest.id
    }
  }

  return marks
}

/** Хранит только первую страницу истории: этого хватает для списка. */
export const mergeCachedCommits = (
  previous: Record<string, ObjectCommit[]>,
  next: Record<string, ObjectCommit[]>,
): Record<string, ObjectCommit[]> => {
  return { ...previous, ...next }
}
