import { describeAction, describeApproveStatus } from '../commit_normalizer'
import type { ObjectCommit, TrackedObject } from '../types'

export const TRACKER_TAB_ID = 'nmap-uploader-object-tracker-tab'
export const TRACKER_PANEL_ID = 'nmap-uploader-object-tracker-panel'
export const TRACKER_STYLES_ID = 'nmap-uploader-object-tracker-styles'

export type TrackerViewMode = 'feed' | 'objects'

export interface TrackerViewModel {
  mode: TrackerViewMode
  objects: TrackedObject[]
  commitsByObject: Record<string, ObjectCommit[]>
  /** id коммитов, которые пользователь ещё не видел. */
  newCommitIds: ReadonlySet<string>
  errors: Record<string, string>
  isLoading: boolean
  hasToken: boolean
  intervalMinutes: number
}

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

const STATUS_CLASS: Record<string, string> = {
  published: 'nmap-ot-status-published',
  approved: 'nmap-ot-status-approved',
  pending: 'nmap-ot-status-pending',
  rejected: 'nmap-ot-status-rejected',
}

/** Создаёт строку коммита. */
export const createCommitRow = (
  commit: ObjectCommit,
  objectTitle: string,
  isNew: boolean,
): HTMLElement => {
  const row = document.createElement('div')
  row.className = 'nmap-ot-commit'
  if (isNew) {
    row.classList.add('nmap-ot-commit_new')
  }

  const head = document.createElement('div')
  head.className = 'nmap-ot-commit__head'

  const date = document.createElement('span')
  date.className = 'nmap-ot-commit__date'
  date.textContent = formatCommitDate(commit.date)
  head.appendChild(date)

  const status = document.createElement('span')
  status.className = `nmap-ot-status ${STATUS_CLASS[commit.approveStatus] ?? 'nmap-ot-status-other'}`
  status.textContent = describeApproveStatus(commit.approveStatus)
  head.appendChild(status)

  if (isNew) {
    const badge = document.createElement('span')
    badge.className = 'nmap-ot-new-badge'
    badge.textContent = 'новое'
    head.appendChild(badge)
  }

  row.appendChild(head)

  const title = document.createElement('a')
  title.className = 'nmap-ot-commit__object'
  title.href = buildObjectHistoryUrl(commit.objectId)
  title.textContent = objectTitle
  row.appendChild(title)

  const action = document.createElement('div')
  action.className = 'nmap-ot-commit__action'
  action.textContent = describeAction(commit.action)
  row.appendChild(action)

  const details = [
    commit.summary,
    commit.author?.displayName ? `— ${commit.author.displayName}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  if (details) {
    const detail = document.createElement('div')
    detail.className = 'nmap-ot-commit__details'
    detail.textContent = details
    row.appendChild(detail)
  }

  return row
}

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

  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'nmap-ot-object__remove'
  remove.textContent = 'Убрать'
  remove.setAttribute('aria-label', `Убрать ${describeObject(object)} из наблюдения`)
  remove.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onRemove(object.id)
  })
  row.appendChild(remove)

  return row
}

export interface PanelCallbacks {
  onAddObject: (objectId: string) => void
  onRemoveObject: (objectId: string) => void
  onModeChange: (mode: TrackerViewMode) => void
  onRefresh: () => void
  onMarkAllRead: () => void
}

const createHeader = (view: TrackerViewModel, callbacks: PanelCallbacks): HTMLElement => {
  const header = document.createElement('div')
  header.className = 'nmap-ot-header'

  const titleRow = document.createElement('div')
  titleRow.className = 'nmap-ot-title-row'

  const title = document.createElement('span')
  title.className = 'nmap-ot-title'
  title.textContent = `Мои объекты (${view.objects.length})`
  titleRow.appendChild(title)

  const refresh = document.createElement('button')
  refresh.type = 'button'
  refresh.className = 'nmap-ot-icon-button'
  refresh.textContent = view.isLoading ? '…' : 'Обновить'
  refresh.disabled = view.isLoading
  refresh.addEventListener('click', () => callbacks.onRefresh())
  titleRow.appendChild(refresh)

  header.appendChild(titleRow)

  if (!view.hasToken) {
    const warning = document.createElement('div')
    warning.className = 'nmap-ot-warning'
    warning.textContent =
      'Нет доступа к API редактора. Откройте ленту правок или обновите страницу.'
    header.appendChild(warning)
  }

  const form = document.createElement('form')
  form.className = 'nmap-ot-add'

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'nmap-ot-add__input'
  input.placeholder = 'id объекта'
  input.setAttribute('aria-label', 'id объекта для наблюдения')
  input.inputMode = 'numeric'

  const submit = document.createElement('button')
  submit.type = 'submit'
  submit.className = 'nmap-ot-add__submit'
  submit.textContent = 'Добавить'

  const error = document.createElement('div')
  error.className = 'nmap-ot-add__error'

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const value = input.value.trim()
    if (!/^\d{1,20}$/.test(value)) {
      error.textContent = 'id объекта должен состоять из цифр'
      return
    }
    error.textContent = ''
    callbacks.onAddObject(value)
    input.value = ''
  })

  form.appendChild(input)
  form.appendChild(submit)
  header.appendChild(form)
  header.appendChild(error)

  return header
}

const createModeSwitch = (view: TrackerViewModel, callbacks: PanelCallbacks): HTMLElement => {
  const switcher = document.createElement('div')
  switcher.className = 'nmap-ot-modes'
  switcher.setAttribute('role', 'tablist')

  const modes: Array<{ id: TrackerViewMode; label: string }> = [
    { id: 'feed', label: 'Лента событий' },
    { id: 'objects', label: 'Объекты' },
  ]

  for (const mode of modes) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'nmap-ot-mode'
    button.textContent = mode.label
    button.setAttribute('role', 'tab')
    const isActive = view.mode === mode.id
    button.setAttribute('aria-selected', isActive ? 'true' : 'false')
    if (isActive) {
      button.classList.add('nmap-ot-mode_active')
    }
    button.addEventListener('click', () => callbacks.onModeChange(mode.id))
    switcher.appendChild(button)
  }

  return switcher
}

const createEmptyState = (message: string): HTMLElement => {
  const empty = document.createElement('div')
  empty.className = 'nmap-ot-empty'
  empty.textContent = message
  return empty
}

/** Собирает содержимое панели. Перерисовка полностью заменяет children. */
export const renderPanel = (
  container: HTMLElement,
  view: TrackerViewModel,
  callbacks: PanelCallbacks,
): void => {
  const scrollTop = container.scrollTop
  container.replaceChildren()

  container.appendChild(createHeader(view, callbacks))
  container.appendChild(createModeSwitch(view, callbacks))

  const body = document.createElement('div')
  body.className = 'nmap-ot-body'

  if (view.objects.length === 0) {
    body.appendChild(createEmptyState('Добавьте id объекта, чтобы следить за его историей'))
  } else if (view.mode === 'feed') {
    const commits = flattenCommits(view.commitsByObject)
    if (commits.length === 0) {
      body.appendChild(createEmptyState('Правок пока нет'))
    } else {
      const titles = new Map(view.objects.map((object) => [object.id, describeObject(object)]))
      for (const commit of commits) {
        body.appendChild(
          createCommitRow(
            commit,
            titles.get(commit.objectId) ?? `Объект ${commit.objectId}`,
            view.newCommitIds.has(commit.id),
          ),
        )
      }
    }
  } else {
    for (const object of view.objects) {
      const commits = view.commitsByObject[object.id] ?? []
      body.appendChild(createObjectRow(object, commits, callbacks.onRemoveObject))

      const errorType = view.errors[object.id]
      if (errorType) {
        const error = document.createElement('div')
        error.className = 'nmap-ot-object__error'
        error.textContent =
          errorType === 'ERR_MISSING_OBJECT'
            ? 'Объект не найден в редакторе'
            : `Ошибка загрузки: ${errorType}`
        body.appendChild(error)
      }
    }
  }

  container.appendChild(body)
  container.scrollTop = scrollTop
}
