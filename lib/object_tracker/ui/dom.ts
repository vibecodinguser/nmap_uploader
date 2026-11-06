import {
  COMMIT_STATE_ICONS,
  MODERATOR_ICON,
  resolveCommitStateIcon,
} from '@/lib/nmaps_commit_state_icons'
import { parseStaticSvg } from '@/lib/parse_static_svg'
import { describeAction, describeApproveStatus } from '../commit_normalizer'
import type { ObjectCommit, TrackedObject } from '../types'
import { formatRelativeDate } from './relative_date'

/**
 * Нативная кнопка редактора.
 *
 * Текст обязан лежать в `.nk-button__text`: у нативной кнопки поверхность
 * нарисована в `:before`, и без позиционированной обёртки текст уходит под неё.
 */
const createNativeButton = (className: string, label: string): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `nk-button nk-button_theme_islands nk-button_size_m ${className}`
  const text = document.createElement('span')
  text.className = 'nk-button__text'
  text.textContent = label
  button.appendChild(text)
  return button
}

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

/**
 * Иконочные классы конкретных категорий из CSS редактора.
 *
 * Список снят с `social-bundle`/`app-bundle`: у редактора есть иконки не только
 * для групп (`group-*`), но и для отдельных категорий — POI, регионы, indoor,
 * платные дороги и прочее. Без этого POI и регионы получали placeholder.
 */
const CATEGORY_ICON_IDS: ReadonlySet<string> = new Set([
  'category-ad-neutral',
  'category-addr-unity',
  'category-aoi',
  'category-bld-complex',
  'category-cond',
  'category-cond-border-checkpoint',
  'category-cond-cam',
  'category-cond-closure',
  'category-cond-hd-trajectory',
  'category-cond-lane',
  'category-cond-pedestrian-traffic-light',
  'category-cond-railway-crossing',
  'category-cond-speed-bump',
  'category-cond-toll',
  'category-cond-toll-connection',
  'category-cond-traffic-light',
  'category-error',
  'category-feedback-limit',
  'category-hd-area',
  'category-hydro',
  'category-hydro-ln-el',
  'category-hydro-ln-jc',
  'category-hydro-point',
  'category-indoor-area',
  'category-indoor-barrier',
  'category-indoor-level',
  'category-indoor-plan',
  'category-indoor-poi-info',
  'category-indoor-poi-infra',
  'category-indoor-turnstile-control-line',
  'category-model3d',
  'category-mrc-region',
  'category-outsource-region',
  'category-piecework-region',
  'category-piecework-task',
  'category-poi-auto',
  'category-poi-culture',
  'category-poi-edu',
  'category-poi-entrance',
  'category-poi-finance',
  'category-poi-food',
  'category-poi-government',
  'category-poi-industry',
  'category-poi-leisure',
  'category-poi-medicine',
  'category-poi-medicine-tr',
  'category-poi-other',
  'category-poi-religion',
  'category-poi-service',
  'category-poi-shopping',
  'category-poi-sport',
  'category-poi-urban',
  'category-region',
  'category-relief',
  'category-rd',
  'category-rd-jc',
  'category-road-marking-point-road-sign-speed-limit',
  'category-road-marking-point-text',
  'category-sport-track',
  'category-toll-road-pass',
  'category-toll-road-system',
  'category-transport-airport',
  'category-transport-airport-terminal',
  'category-transport-bus-route',
  'category-transport-bus-thread',
  'category-transport-bus-thread-connector',
  'category-transport-helicopter',
  'category-transport-metro-el',
  'category-transport-metro-exit',
  'category-transport-metro-station',
  'category-transport-metro-thread-connector',
  'category-transport-operator',
  'category-transport-passageway',
  'category-transport-railway-el',
  'category-transport-railway-platform',
  'category-transport-railway-station',
  'category-transport-stop',
  'category-transport-terminal',
  'category-transport-tram-el',
  'category-transport-tram-route',
  'category-transport-tram-thread',
  'category-transport-tram-thread-connector',
  'category-transport-transition',
  'category-transport-transition-boarding',
  'category-transport-waterway-el',
  'category-transport-waterway-route',
  'category-transport-waterway-stop',
  'category-transport-waterway-thread-connector',
  'category-urban-roadnet-fence-el',
  'category-urban-roadnet-parking-controlled-zone',
  'category-urban-roadnet-parking-lot',
  'category-urban-roadnet-parking-lot-linear',
  'category-urban-roadnet-traffic-light',
  'category-vehicle-restriction',
  'category-vehicle-restriction-area',
  'category-zipcode',
])

/**
 * Категории, которых нет в CSS под своим именем, но есть под чужим.
 * `feed_region` — объект подписки, редактор рисует его иконкой региона.
 */
const CATEGORY_ICON_ALIASES: Readonly<Record<string, string>> = {
  'feed-region': 'category-region',
  region: 'category-region',
}

/** Групповые иконки категорий, которые есть в CSS редактора. */
const CATEGORY_GROUPS = [
  'group-urban-roadnet',
  'group-urban',
  'group-ad',
  'group-addr',
  'group-bld',
  'group-group',
  'group-hydro',
  'group-org',
  'group-rd',
  'group-relief',
  'group-service',
  'group-transport',
  'group-vegetation',
] as const

/**
 * Подбирает иконку категории.
 *
 * Порядок как в редакторе: сначала иконка конкретной категории, затем группа,
 * затем placeholder. Категории вида `ad_jc`, `rd_el`, `poi_food` — подчёркивания
 * заменяем дефисами, как в именах классов.
 */
export const resolveCategoryIconClass = (categoryId?: string): string => {
  const normalized = (categoryId ?? '').toLowerCase().replaceAll('_', '-')
  if (!normalized) {
    return 'nk-geoobject-icon nk-geoobject-icon_id_placeholder'
  }

  const categoryIcon = CATEGORY_ICON_ALIASES[normalized] ?? `category-${normalized}`
  if (CATEGORY_ICON_IDS.has(categoryIcon)) {
    return `nk-geoobject-icon nk-geoobject-icon_id_${categoryIcon}`
  }

  const group = CATEGORY_GROUPS.find((candidate) => {
    const prefix = candidate.replace(/^group-/, '')
    return normalized === prefix || normalized.startsWith(`${prefix}-`)
  })
  return `nk-geoobject-icon nk-geoobject-icon_id_${group ?? 'placeholder'}`
}

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

  const refresh = createNativeButton('nmap-ot-refresh', view.isLoading ? 'Загрузка…' : 'Обновить')
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

  const label = document.createElement('label')
  label.className = 'nmap-ot-add__label'
  label.textContent = 'id объекта'
  label.htmlFor = 'nmap-ot-add-input'
  form.appendChild(label)

  const row = document.createElement('div')
  row.className = 'nmap-ot-add__row'

  const field = document.createElement('span')
  field.className =
    'nk-text-input nk-text-input_theme_islands nk-text-input_size_m nk-text-input_width_available nmap-ot-add__field'

  const input = document.createElement('input')
  input.id = 'nmap-ot-add-input'
  input.type = 'text'
  input.className = 'nk-text-input__control'
  input.placeholder = 'Например, 53161481'
  input.inputMode = 'numeric'
  field.appendChild(input)

  const submit = createNativeButton('nmap-ot-add__submit', 'Добавить')
  submit.type = 'submit'
  submit.classList.add('nk-button_view_action')

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

  row.appendChild(field)
  row.appendChild(submit)
  form.appendChild(row)
  form.appendChild(error)
  header.appendChild(form)

  return header
}

export const MODES_SELECTION_CLASS = 'nmap-ot-modes__selection'

/**
 * Ставит полосу выбранного режима под нужную вкладку.
 *
 * Работает по той же схеме, что нативный индикатор `.nk-tabs-bar__selection`:
 * элемент шириной 1px сдвигается на `left + (width - 1) / 2` и растягивается
 * через `scaleX`, потому что `transform-origin` по умолчанию — центр.
 */
export const syncModeSelection = (container: HTMLElement): void => {
  const switcher = container.querySelector<HTMLElement>('.nmap-ot-modes')
  const selection = switcher?.querySelector<HTMLElement>(`.${MODES_SELECTION_CLASS}`)
  const active = switcher?.querySelector<HTMLElement>('.nmap-ot-mode_active')
  if (!switcher || !selection || !active) {
    return
  }

  const width = active.offsetWidth
  if (width <= 0) {
    return
  }

  const offset = active.offsetLeft + (width - 1) / 2
  selection.style.transform = `translateX(${offset}px) scaleX(${width})`
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
    /*
     * Классы нативных вкладок здесь использовать нельзя: на `.nk-tabs-bar__tab`
     * висят обработчики редактора и нашего же сайдбара, и клик по режиму
     * переключал нативную панель. Оформление повторяем своими классами.
     */
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
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      callbacks.onModeChange(mode.id)
    })
    switcher.appendChild(button)
  }

  const selection = document.createElement('div')
  selection.className = MODES_SELECTION_CLASS
  switcher.appendChild(selection)

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
  const modeSwitch = createModeSwitch(view, callbacks)
  container.appendChild(modeSwitch)

  const body = document.createElement('div')
  body.className = 'nmap-ot-body'
  const isFeed = view.objects.length > 0 && view.mode === 'feed'
  if (isFeed) {
    body.classList.add('nmap-ot-body_feed')
  }

  if (view.objects.length === 0) {
    body.appendChild(createEmptyState('Добавьте id объекта, чтобы следить за его историей'))
  } else if (view.mode === 'feed') {
    const commits = flattenCommits(view.commitsByObject)
    if (commits.length === 0) {
      body.appendChild(createEmptyState('Правок пока нет'))
    } else {
      const objectsById = new Map(view.objects.map((object) => [object.id, object]))
      for (const commit of commits) {
        const object = objectsById.get(commit.objectId) ?? {
          id: commit.objectId,
          title: '',
          addedAt: 0,
        }
        body.appendChild(createCommitRow(commit, object, view.newCommitIds.has(commit.id)))
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

  // Полосу режима считаем после вставки в DOM: до этого offsetWidth равен нулю.
  syncModeSelection(container)
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => syncModeSelection(container))
  }
}
