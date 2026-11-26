/**
 * Сборка панели трекера: шапка, переключатель режимов и список.
 */

import { parseStaticSvg } from '@/lib/parse_static_svg'
import { createCommitRow } from './commit_row'
import { flattenCommits } from './format'
import { createNativeButton } from './native_button'
import { createObjectRow } from './object_row'
import {
  MODES_SELECTION_CLASS,
  type PanelCallbacks,
  type TrackerViewMode,
  type TrackerViewModel,
} from './view_model'

/**
 * Нативная иконка обновления.
 *
 * У `nk-icon_id_reload` в CSS редактора есть только размеры: глиф приложение
 * вставляет инлайн-SVG из своего реестра иконок (`app-bundle`, модуль `54612`,
 * ключ `reload`). Разметку берём оттуда один в один, чтобы наша кнопка была
 * той же иконкой, что «Обновить» в панелях редактора, — как `CUT_ICON_SVG`.
 */
export const RELOAD_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><path d="M17.646 13.646a.5.5 0 0 0 .707 0l2.94-2.939c.63-.63.184-1.707-.707-1.707h-1.602A7.5 7.5 0 0 0 5.9 4.51a.476.476 0 0 0 .066.686l.773.629a.54.54 0 0 0 .73-.068A5.5 5.5 0 0 1 11.5 4c2.869 0 5.225 2.197 5.5 5h-1.586c-.89 0-1.337 1.077-.707 1.707zM4.353 7.354a.5.5 0 0 0-.707 0L.707 10.293C.077 10.923.523 12 1.414 12h1.602A7.5 7.5 0 0 0 16.1 16.49a.475.475 0 0 0-.066-.686l-.773-.628a.54.54 0 0 0-.73.067A5.5 5.5 0 0 1 10.5 17c-2.87 0-5.225-2.197-5.5-5h1.586c.89 0 1.337-1.077.707-1.707z"/></svg>'

/**
 * Кнопка обновления — нативная иконка редактора, а не текстовая кнопка.
 *
 * В строке добавления она стоит рядом с полем и «Добавить» и не отнимает
 * ширину у заголовка панели.
 */
const createRefreshButton = (
  view: TrackerViewModel,
  callbacks: PanelCallbacks,
): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className =
    'nmap-ot-refresh nk-icon nk-icon_id_reload nk-icon_align_auto nk-icon_colored nk-icon_interactive'
  button.disabled = view.isLoading
  button.title = view.isLoading ? 'Загрузка…' : 'Обновить список'
  button.setAttribute('aria-label', view.isLoading ? 'Загрузка…' : 'Обновить список')
  if (view.isLoading) {
    button.classList.add('nmap-ot-refresh_loading')
    button.setAttribute('aria-busy', 'true')
  }
  button.appendChild(parseStaticSvg(RELOAD_ICON_SVG))
  button.addEventListener('click', () => callbacks.onRefresh())
  return button
}

const createHeader = (view: TrackerViewModel, callbacks: PanelCallbacks): HTMLElement => {
  const header = document.createElement('div')
  header.className = 'nmap-ot-header'

  const titleRow = document.createElement('div')
  titleRow.className = 'nmap-ot-title-row'

  const title = document.createElement('span')
  title.className = 'nmap-ot-title'
  title.textContent = `Наблюдаемые объекты (${view.objects.length})`
  titleRow.appendChild(title)

  header.appendChild(titleRow)

  if (!view.hasToken) {
    const warning = document.createElement('div')
    warning.className = 'nmap-ot-warning'
    warning.textContent =
      'Нет доступа к API редактора. Откройте ленту правок или обновите страницу.'
    header.appendChild(warning)
  } else if (view.isRateLimited) {
    const warning = document.createElement('div')
    warning.className = 'nmap-ot-warning'
    warning.textContent =
      'Редактор ограничил частоту запросов. Обновление повторится автоматически чуть позже.'
    header.appendChild(warning)
  }

  const form = document.createElement('form')
  form.className = 'nmap-ot-add'
  form.autocomplete = 'off'

  const row = document.createElement('div')
  row.className = 'nmap-ot-add__row'

  const field = document.createElement('span')
  field.className =
    'nk-text-input nk-text-input_theme_islands nk-text-input_size_m nk-text-input_width_available nmap-ot-add__field'

  const input = document.createElement('input')
  input.id = 'nmap-ot-add-input'
  input.type = 'text'
  input.className = 'nk-text-input__control'
  input.placeholder = 'id объекта, например 53161481'
  input.inputMode = 'numeric'
  /*
   * Подписи над полем нет, поэтому доступное имя задаётся здесь: без него
   * поле остаётся без метки (placeholder именем не считается).
   */
  input.setAttribute('aria-label', 'id объекта')
  /*
   * Поле выглядит для менеджеров паролей как поле для секрета: они предлагают
   * сохранить введённый id. `autocomplete` и `data-form-type` понимают браузеры
   * и Dashlane, остальные атрибуты — конкретные расширения (1Password,
   * LastPass, Bitwarden, Proton Pass). Вместе это гасит автозаполнение.
   */
  input.autocomplete = 'off'
  input.spellcheck = false
  input.autocapitalize = 'off'
  input.setAttribute('autocorrect', 'off')
  input.dataset.formType = 'other'
  input.dataset['1pIgnore'] = 'true'
  input.dataset.lpignore = 'true'
  input.dataset.bwignore = 'true'
  input.dataset.protonpassIgnore = 'true'
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
      error.textContent = 'Идентификатор объекта должен состоять из цифр'
      return
    }
    error.textContent = ''
    callbacks.onAddObject(value)
    input.value = ''
  })

  row.appendChild(field)
  row.appendChild(submit)
  row.appendChild(createRefreshButton(view, callbacks))
  form.appendChild(row)
  form.appendChild(error)
  header.appendChild(form)

  return header
}

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
  // Оба режима рисуют карточки нативной ленты: они идут от края до края панели.
  if (view.objects.length > 0) {
    body.classList.add('nmap-ot-body_cards')
  }

  if (view.objects.length === 0) {
    body.appendChild(createEmptyState('Добавьте объекты для наблюдения'))
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
