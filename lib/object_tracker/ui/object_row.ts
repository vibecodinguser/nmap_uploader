/**
 * Строка списка отслеживаемых объектов.
 */

import type { ObjectCommit, TrackedObject } from '../types'
import { buildObjectHistoryUrl, describeObject, formatCommitDate } from './format'
import { createNativeButton } from './native_button'

/** Список объектов с кнопками удаления. */
export const createObjectRow = (
  object: TrackedObject,
  commits: ObjectCommit[],
  onRemove: (objectId: string) => void,
): HTMLElement => {
  const row = document.createElement('div')
  row.className = 'nmap-ot-object'

  const info = document.createElement('div')
  info.className = 'nmap-ot-object__info'

  const link = document.createElement('a')
  link.className = 'nmap-ot-object__title'
  link.href = buildObjectHistoryUrl(object.id)
  link.textContent = describeObject(object)
  info.appendChild(link)

  const idLine = document.createElement('div')
  idLine.className = 'nmap-ot-object__meta'
  const latest = commits[0]
  idLine.textContent = latest
    ? `id ${object.id} · правок: ${commits.length} · последняя ${formatCommitDate(latest.date)}`
    : `id ${object.id} · правок пока нет`
  info.appendChild(idLine)

  row.appendChild(info)

  const remove = createNativeButton('nmap-ot-object__remove', 'Убрать')
  remove.setAttribute('aria-label', `Убрать ${describeObject(object)} из наблюдения`)
  remove.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onRemove(object.id)
  })
  row.appendChild(remove)

  return row
}
