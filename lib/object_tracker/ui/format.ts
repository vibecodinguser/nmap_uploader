/**
 * Форматирование данных трекера для отображения.
 */

import { describeAction } from '../commit_normalizer'
import type { ObjectCommit, TrackedObject } from '../types'

/** Дата и время коммита в читаемом виде. */
export const formatCommitDate = (iso: string): string => {
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) {
    return iso
  }
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

/** Ссылка на историю объекта в редакторе. */
export const buildObjectHistoryUrl = (objectId: string): string =>
  `https://n.maps.yandex.ru/#!/objects/${objectId}/history/commits`

/** Подпись объекта: имя, а если его нет — id. */
export const describeObject = (object: TrackedObject): string =>
  object.title && object.title !== object.id ? object.title : `Объект ${object.id}`

/** Все коммиты из кэша, самые свежие сверху. */
export const flattenCommits = (commitsByObject: Record<string, ObjectCommit[]>): ObjectCommit[] =>
  Object.values(commitsByObject)
    .flat()
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))

/** Подпись изменения с заглавной буквы, как в нативной ленте. */
const capitalize = (value: string): string =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value

/** Что показать в блоке edit-notes. */
export const describeCommitNote = (commit: ObjectCommit): string => {
  if (commit.summary) {
    return capitalize(commit.summary)
  }
  return describeAction(commit.action)
}
