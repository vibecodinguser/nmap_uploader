/**
 * Сборка панели трекера: шапка, переключатель режимов и список.
 */

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

const createHeader = (view: TrackerViewModel, callbacks: PanelCallbacks): HTMLElement => {
  const header = document.createElement('div')
  header.className = 'nmap-ot-header'

  const titleRow = document.createElement('div')
  titleRow.className = 'nmap-ot-title-row'

  const title = document.createElement('span')
  title.className = 'nmap-ot-title'
  title.textContent = `Отслеживаемые объекты (${view.objects.length})`
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
  form.autocomplete = 'off'

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
  input.placeholder = 'id объекта, например 53161481'
  input.inputMode = 'numeric'
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
  const isFeed = view.objects.length > 0 && view.mode === 'feed'
  if (isFeed) {
    body.classList.add('nmap-ot-body_feed')
  }

  if (view.objects.length === 0) {
    body.appendChild(createEmptyState('Добавьте объекты для отслеживания'))
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
