/**
 * Строка коммита в разметке нативной ленты «Мои правки».
 */

import {
  COMMIT_STATE_ICONS,
  MODERATOR_ICON,
  resolveCommitStateIcon,
} from '@/lib/nmaps_commit_state_icons'
import { parseStaticSvg } from '@/lib/parse_static_svg'
import { describeApproveStatus } from '../commit_normalizer'
import type { ObjectCommit, TrackedObject } from '../types'
import { resolveCategoryIconClass } from './category_icons'
import {
  buildObjectHistoryUrl,
  describeCommitNote,
  describeObject,
  formatCommitDate,
} from './format'
import { formatRelativeDate } from './relative_date'

/**
 * Иконка статуса коммита — та же, что в нативной ленте.
 * В карточке она рисуется поверх иконки категории.
 *
 * Класса `.nk-icon_id_commit-*` в CSS редактора нет: приложение вставляет
 * инлайн-SVG внутрь span, поэтому без разметки иконка остаётся пустой.
 */
const createCommitStateIcon = (approveStatus: string): HTMLElement => {
  const icon = COMMIT_STATE_ICONS[resolveCommitStateIcon(approveStatus)]
  const element = document.createElement('span')
  element.className = icon.className
  element.setAttribute('title', describeApproveStatus(approveStatus))
  element.appendChild(parseStaticSvg(icon.svgMarkup))
  return element
}

/** Иконка модератора у имени автора. */
const createModeratorIcon = (status: string): HTMLElement => {
  const element = document.createElement('span')
  element.className = MODERATOR_ICON.className
  element.setAttribute('title', status)
  element.appendChild(parseStaticSvg(MODERATOR_ICON.svgMarkup))
  return element
}

/** Создаёт строку коммита в разметке нативной ленты «Мои правки». */
export const createCommitRow = (
  commit: ObjectCommit,
  object: TrackedObject,
  isNew: boolean,
  now: number = Date.now(),
): HTMLElement => {
  const objectTitle = describeObject(object)
  const historyUrl = buildObjectHistoryUrl(commit.objectId)

  const row = document.createElement('div')
  row.className = 'nmap-ot-commit nk-list-item-view nk-list-item-view_interactive'
  if (isNew) {
    row.classList.add('nmap-ot-commit_new')
  }

  if (isNew) {
    const dot = document.createElement('span')
    dot.className = 'nmap-ot-new-dot'
    dot.setAttribute('title', 'Новое событие')
    row.appendChild(dot)
  }

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

  const statusIcon = createCommitStateIcon(commit.approveStatus)
  iconColumn.appendChild(statusIcon)

  grid.appendChild(iconColumn)

  const content = document.createElement('div')
  content.className = 'nk-grid__col nk-grid__col_span_10 nk-grid__col_stick'

  const dateAndAction = document.createElement('div')
  dateAndAction.className = 'nk-event-view__date-and-action'
  const date = document.createElement('span')
  date.className = 'nk-date-time nk-date-time_mode_relative nk-event-view__date'
  date.textContent = formatRelativeDate(commit.date, now)
  date.title = formatCommitDate(commit.date)
  dateAndAction.appendChild(date)
  content.appendChild(dateAndAction)

  const titleRow = document.createElement('div')
  titleRow.className = 'nk-event-view__title'
  const titleLink = document.createElement('a')
  titleLink.className = 'nk-link nk-link_theme_islands nk-link_view_text'
  titleLink.href = historyUrl
  const titleText = document.createElement('span')
  titleText.className = 'nk-geoobject-preview-opener-view'
  titleText.dataset.id = commit.objectId
  titleText.textContent = objectTitle
  titleLink.appendChild(titleText)
  titleRow.appendChild(titleLink)
  content.appendChild(titleRow)

  if (commit.author) {
    const userRow = document.createElement('div')
    userRow.className = 'nk-event-view__user'

    const userLink = document.createElement('a')
    userLink.className = 'nk-link nk-link_theme_islands nk-user-link-view'

    const userName = document.createElement('span')
    userName.className = 'nk-user-name-view nk-user-name-view_colored'

    const nameText = document.createElement('span')
    nameText.className = 'nk-user-name-view__name'
    nameText.textContent = commit.author.displayName
    userName.appendChild(nameText)

    const status = commit.author.moderationStatus
    if (status && status !== 'none') {
      userName.appendChild(createModeratorIcon(status))
    }

    userLink.appendChild(userName)
    userRow.appendChild(userLink)
    content.appendChild(userRow)
  }

  const noteText = describeCommitNote(commit)
  if (noteText) {
    const notes = document.createElement('div')
    notes.className = 'nk-commit-edit-notes-view'
    const note = document.createElement('div')
    note.className = 'nk-commit-edit-notes-view__edit-note'
    note.textContent = noteText
    notes.appendChild(note)
    content.appendChild(notes)
  }

  grid.appendChild(content)

  // Кликабельна вся карточка: ведём на историю объекта.
  row.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    window.location.assign(historyUrl)
  })

  return row
}
