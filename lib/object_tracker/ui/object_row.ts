/**
 * Карточка отслеживаемого объекта в разметке нативной ленты «Мои правки».
 *
 * Разметка и классы повторяют `nk-event-view` из ленты событий: иконка
 * категории, относительная дата, ссылка на объект и строка-пояснение. Своего
 * вида у карточки нет — всё, что нужно, даёт CSS редактора, поэтому светлая и
 * тёмная темы совпадают с лентой без дополнительных правил.
 */

import { parseStaticSvg } from '@/lib/parse_static_svg'
import type { ObjectCommit, TrackedObject } from '../types'
import { resolveCategoryIconClass } from './category_icons'
import { buildObjectUrl, describeObject, formatCommitDate } from './format'
import { openNmapsRoute } from './navigation'
import { formatRelativeDate } from './relative_date'

/**
 * Нативная иконка корзины.
 *
 * В CSS редактора у `nk-icon_id_delete-small` есть только размеры: сам глиф
 * приложение вставляет инлайн-SVG, поэтому разметку храним здесь.
 */
const TRASH_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g fill-rule="evenodd"><path d="M6 16.5c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8.01a.51.51 0 0 0-.51-.51H6.51a.506.506 0 0 0-.51.51zm1.5.5V9h7v8zM13 5h3.248a.75.75 0 1 1 .001 1.5H5.751A.75.75 0 0 1 5 5.75c0-.414.341-.75.752-.75H9v-.508a.995.995 0 0 1 1.01-.992h1.98a1 1 0 0 1 1.01.992z"/><path d="M9.5 10a.5.5 0 0 1 .5.5v5a.5.5 0 1 1-1 0v-5a.5.5 0 0 1 .5-.5m3 0a.5.5 0 0 1 .5.5v5a.5.5 0 1 1-1 0v-5a.5.5 0 0 1 .5-.5"/></g></svg>'

const createRemoveButton = (
  object: TrackedObject,
  onRemove: (objectId: string) => void,
): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className =
    'nmap-ot-object__remove nk-icon nk-icon_id_delete-small nk-icon_align_auto nk-icon_colored nk-icon_interactive'
  button.title = 'Убрать из наблюдения'
  button.setAttribute('aria-label', `Убрать ${describeObject(object)} из наблюдения`)
  button.appendChild(parseStaticSvg(TRASH_ICON_SVG))
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onRemove(object.id)
  })
  return button
}

/** Карточка объекта в том же виде, что карточка события в ленте. */
export const createObjectRow = (
  object: TrackedObject,
  commits: ObjectCommit[],
  onRemove: (objectId: string) => void,
): HTMLElement => {
  const objectUrl = buildObjectUrl(
    object.id,
    typeof window === 'undefined' ? '' : window.location.href,
  )

  const row = document.createElement('div')
  row.className = 'nmap-ot-object nk-list-item-view nk-list-item-view_interactive'

  const eventView = document.createElement('div')
  eventView.className = 'nk-event-view'
  row.appendChild(eventView)

  const grid = document.createElement('div')
  grid.className = 'nk-event-view__event nk-section nk-section_level_2 nk-grid'
  eventView.appendChild(grid)

  const iconColumn = document.createElement('div')
  iconColumn.className = 'nk-event-view__icon nk-grid__col nk-grid__col_span_2'

  const categoryIcon = document.createElement('span')
  categoryIcon.className = resolveCategoryIconClass(object.categoryId)
  categoryIcon.setAttribute('aria-hidden', 'true')
  iconColumn.appendChild(categoryIcon)

  grid.appendChild(iconColumn)

  const content = document.createElement('div')
  content.className = 'nmap-ot-object__content nk-grid__col nk-grid__col_span_10 nk-grid__col_stick'

  const latest = commits[0]
  const dateAndAction = document.createElement('div')
  dateAndAction.className = 'nk-event-view__date-and-action'
  const date = document.createElement('span')
  date.className = 'nk-date-time nk-date-time_mode_relative nk-event-view__date'
  if (latest) {
    date.textContent = formatRelativeDate(latest.date)
    date.title = formatCommitDate(latest.date)
  } else {
    date.textContent = 'Правок пока нет'
  }
  dateAndAction.appendChild(date)
  content.appendChild(dateAndAction)

  const titleRow = document.createElement('div')
  titleRow.className = 'nk-event-view__title'
  const titleLink = document.createElement('a')
  titleLink.className = 'nk-link nk-link_theme_islands nk-link_view_text'
  titleLink.href = objectUrl
  const titleText = document.createElement('span')
  titleText.className = 'nk-geoobject-preview-opener-view'
  titleText.dataset.id = object.id
  titleText.textContent = describeObject(object)
  titleLink.appendChild(titleText)
  titleRow.appendChild(titleLink)
  content.appendChild(titleRow)

  const notes = document.createElement('div')
  notes.className = 'nk-commit-edit-notes-view'
  const note = document.createElement('div')
  note.className = 'nk-commit-edit-notes-view__edit-note'
  note.textContent = latest ? `id ${object.id} · правок: ${commits.length}` : `id ${object.id}`
  notes.appendChild(note)
  content.appendChild(notes)

  grid.appendChild(content)
  row.appendChild(createRemoveButton(object, onRemove))

  // Кликабельна вся карточка: открываем карточку объекта, как в ленте.
  row.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    openNmapsRoute(objectUrl)
  })

  return row
}
