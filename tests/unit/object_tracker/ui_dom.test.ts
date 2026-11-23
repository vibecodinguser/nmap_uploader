// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ObjectCommit, TrackedObject } from '@/lib/object_tracker/types'
import {
  buildObjectHistoryUrl,
  createCommitRow,
  createObjectRow,
  describeObject,
  flattenCommits,
  formatCommitDate,
  renderPanel,
  resolveCategoryIconClass,
  syncModeSelection,
  type TrackerViewModel,
} from '@/lib/object_tracker/ui/dom'

const commit = (overrides: Partial<ObjectCommit> = {}): ObjectCommit => ({
  id: '1',
  objectId: '4465652155',
  date: '2026-11-05T11:22:11+03:00',
  action: 'object-modified',
  approveStatus: 'pending',
  state: 'draft',
  primary: true,
  author: { publicId: 'stylesvoboda', displayName: 'stylesvoboda' },
  summary: 'изменена геометрия',
  ...overrides,
})

const tracked: TrackedObject[] = [{ id: '4465652155', title: 'хутор Захаров', addedAt: 0 }]

describe('object_tracker: форматирование', () => {
  it('форматирует дату коммита', () => {
    const formatted = formatCommitDate('2026-11-05T11:22:11+03:00')

    expect(formatted).toContain('05.11.2026')
  })

  it('возвращает исходную строку на невалидной дате', () => {
    expect(formatCommitDate('не дата')).toBe('не дата')
  })

  it('строит ссылку на историю объекта', () => {
    expect(buildObjectHistoryUrl('123')).toBe(
      'https://n.maps.yandex.ru/#!/objects/123/history/commits',
    )
  })

  it('подписывает объект названием, а без него — id', () => {
    expect(describeObject({ id: '1', title: 'Хутор', addedAt: 0 })).toBe('Хутор')
    expect(describeObject({ id: '1', title: '', addedAt: 0 })).toBe('Объект 1')
    expect(describeObject({ id: '1', title: '1', addedAt: 0 })).toBe('Объект 1')
  })

  it('сортирует коммиты по убыванию даты', () => {
    const commits = flattenCommits({
      a: [commit({ id: '1', date: '2026-11-01T00:00:00Z' })],
      b: [commit({ id: '2', date: '2026-11-05T00:00:00Z' })],
    })

    expect(commits.map((item) => item.id)).toEqual(['2', '1'])
  })
})

describe('object_tracker: строки', () => {
  const object = tracked[0]
  if (!object) throw new Error('нет тестового объекта')

  it('строит карточку в разметке нативной ленты', () => {
    const row = createCommitRow(commit(), object, true, Date.parse('2026-11-05T12:00:00+03:00'))

    // Нативные классы карточки события.
    expect(row.classList.contains('nk-list-item-view')).toBe(true)
    expect(row.querySelector('.nk-event-view')).not.toBeNull()
    expect(row.querySelector('.nk-event-view__event.nk-grid')).not.toBeNull()
    expect(row.querySelector('.nk-event-view__icon')).not.toBeNull()
    expect(row.querySelector('.nk-event-view__title')).not.toBeNull()
    expect(row.querySelector('.nk-event-view__user')).not.toBeNull()
    expect(row.querySelector('.nk-commit-edit-notes-view__edit-note')).not.toBeNull()

    expect(row.querySelector('.nk-geoobject-preview-opener-view')?.getAttribute('data-id')).toBe(
      '4465652155',
    )
  })

  it('показывает статус иконкой, а не чипом', () => {
    const row = createCommitRow(commit(), object, false)
    const stateIcon = row.querySelector('.nk-event-view__commit-state')

    expect(stateIcon?.className).toContain('nk-icon_id_commit-pending')
    expect(row.querySelector('.nmap-ot-status')).toBeNull()
  })

  it('вставляет SVG внутрь иконки статуса', () => {
    // Класса .nk-icon_id_commit-* в CSS редактора нет: без инлайн-SVG
    // иконка остаётся пустым квадратом.
    const row = createCommitRow(commit(), object, false)

    expect(row.querySelector('.nk-event-view__commit-state svg')).not.toBeNull()
  })

  it('подбирает SVG под каждый статус', () => {
    const cases: Array<[string, string]> = [
      ['pending', 'nk-icon_id_commit-pending'],
      ['published', 'nk-icon_id_commit-published'],
      ['approved', 'nk-icon_id_commit-approved'],
      ['rejected', 'nk-icon_id_commit-rejected'],
    ]

    for (const [status, iconClass] of cases) {
      const row = createCommitRow(commit({ approveStatus: status }), object, false)
      const icon = row.querySelector('.nk-event-view__commit-state')

      expect(icon?.className).toContain(iconClass)
      expect(icon?.querySelector('svg')).not.toBeNull()
    }
  })

  it('показывает относительную дату и абсолютную в title', () => {
    const row = createCommitRow(commit(), object, false, Date.parse('2026-11-05T12:00:11+03:00'))
    const date = row.querySelector('.nk-event-view__date')

    expect(date?.textContent).toBe('38 минут назад')
    expect(date?.getAttribute('title')).toContain('05.11.2026')
  })

  it('помечает новое событие точкой', () => {
    const fresh = createCommitRow(commit(), object, true)
    const read = createCommitRow(commit(), object, false)

    expect(fresh.querySelector('.nmap-ot-new-dot')).not.toBeNull()
    expect(read.querySelector('.nmap-ot-new-dot')).toBeNull()
    expect(fresh.classList.contains('nmap-ot-commit_new')).toBe(true)
  })

  it('рисует иконку категории объекта', () => {
    const row = createCommitRow(commit(), { ...object, categoryId: 'ad_jc' }, false)

    expect(row.querySelector('.nk-geoobject-icon')?.className).toContain(
      'nk-geoobject-icon_id_group-ad',
    )
  })
  it('показывает иконку модератора у автора', () => {
    const row = createCommitRow(
      commit({ author: { publicId: 'u', displayName: 'u', moderationStatus: 'moderator' } }),
      object,
      false,
    )

    expect(row.querySelector('.nk-user-name-view__name')?.textContent).toBe('u')
    expect(row.querySelector('.nk-user-name-view__icon svg')).not.toBeNull()
  })

  it('ведёт на историю объекта полной загрузкой маршрута', () => {
    const row = createCommitRow(commit(), object, false)
    const assign = vi.fn()
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: 'https://n.maps.yandex.ru/#!/users/stylesvoboda/feeds/edits',
      assign,
      reload,
    } as unknown as Location)

    row.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(assign).toHaveBeenCalledWith(buildObjectHistoryUrl('4465652155'))
    expect(reload).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('создаёт строку объекта с кнопкой удаления', () => {
    const onRemove = vi.fn()
    const row = createObjectRow(object, [commit()], onRemove)

    expect(row.textContent).toContain('хутор Захаров')
    row.querySelector<HTMLButtonElement>('.nmap-ot-object__remove')?.click()
    expect(onRemove).toHaveBeenCalledWith('4465652155')
  })

  it('повторяет разметку карточки ленты событий', () => {
    const row = createObjectRow(object, [commit()], vi.fn())

    // Те же классы, что у нативной карточки в «Моих правках»: вид целиком
    // приходит из CSS редактора.
    expect(row.classList.contains('nk-list-item-view')).toBe(true)
    expect(row.querySelector('.nk-event-view__event.nk-section.nk-section_level_2')).not.toBeNull()
    expect(row.querySelector('.nk-event-view__icon .nk-geoobject-icon')).not.toBeNull()
    expect(row.querySelector('.nk-event-view__date')?.textContent).toBeTruthy()
    expect(row.querySelector('.nk-event-view__title a')?.getAttribute('href')).toContain(
      '#!/objects/4465652155',
    )
    expect(row.querySelector('.nk-geoobject-preview-opener-view')?.getAttribute('data-id')).toBe(
      '4465652155',
    )
    expect(row.querySelector('.nk-commit-edit-notes-view__edit-note')?.textContent).toBe(
      'id 4465652155 · правок: 1',
    )
  })

  it('показывает дату последней правки и число правок', () => {
    const row = createObjectRow(object, [commit(), commit({ id: '2' })], vi.fn())

    const date = row.querySelector<HTMLElement>('.nk-event-view__date')
    expect(date?.textContent).toBeTruthy()
    expect(date?.title).toBe(formatCommitDate('2026-11-05T11:22:11+03:00'))
    expect(row.querySelector('.nk-commit-edit-notes-view__edit-note')?.textContent).toBe(
      'id 4465652155 · правок: 2',
    )
  })

  it('подписывает кнопку удаления и не уводит по карточке при клике', () => {
    const onRemove = vi.fn()
    const assign = vi.fn()
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      assign,
      reload,
    } as unknown as Location)

    const row = createObjectRow(object, [commit()], onRemove)
    const remove = row.querySelector<HTMLButtonElement>('.nmap-ot-object__remove')
    expect(remove?.getAttribute('aria-label')).toBe('Убрать хутор Захаров из наблюдения')

    remove?.click()

    expect(onRemove).toHaveBeenCalledWith('4465652155')
    expect(assign).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('открывает карточку объекта полной загрузкой маршрута', () => {
    // Роутер редактора не реагирует на смену hash извне: без перезагрузки
    // адрес меняется, а вид остаётся прежним — ссылка выглядела нерабочей.
    const assign = vi.fn()
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: 'https://n.maps.yandex.ru/#!/users/stylesvoboda/feeds/edits?z=18&ll=38.9%2C45.0&l=nk%23sat',
      assign,
      reload,
    } as unknown as Location)

    const row = createObjectRow(object, [commit()], vi.fn())
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(assign).toHaveBeenCalledWith(
      'https://n.maps.yandex.ru/#!/objects/4465652155?z=18&ll=38.9%2C45.0&l=nk%23sat',
    )
    expect(reload).toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('ставит ссылку на карточку объекта в заголовок карточки', () => {
    const row = createObjectRow(object, [commit()], vi.fn())
    const link = row.querySelector<HTMLAnchorElement>('.nk-event-view__title a')

    expect(link?.getAttribute('href')).toContain('#!/objects/4465652155')
    expect(link?.getAttribute('href')).not.toContain('/history/commits')
  })
})

describe('object_tracker: renderPanel', () => {
  const baseView: TrackerViewModel = {
    mode: 'feed',
    objects: tracked,
    commitsByObject: { '4465652155': [commit()] },
    newCommitIds: new Set(['1']),
    errors: {},
    isLoading: false,
    hasToken: true,
    isRateLimited: false,
  }

  const callbacks = {
    onAddObject: vi.fn(),
    onRemoveObject: vi.fn(),
    onModeChange: vi.fn(),
    onRefresh: vi.fn(),
    onMarkAllRead: vi.fn(),
  }

  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('рисует шапку, переключатель режимов и ленту', () => {
    const container = document.createElement('div')

    renderPanel(container, baseView, callbacks)

    expect(container.textContent).toContain('Отслеживаемые объекты (1)')
    expect(container.textContent).toContain('Лента событий')
    expect(container.querySelectorAll('.nmap-ot-commit')).toHaveLength(1)
  })

  it('показывает предупреждение без токена', () => {
    const container = document.createElement('div')

    renderPanel(container, { ...baseView, hasToken: false }, callbacks)

    expect(container.querySelector('.nmap-ot-warning')).not.toBeNull()
  })

  it('показывает паузу после 429 вместо предупреждения о токене', () => {
    const container = document.createElement('div')

    renderPanel(container, { ...baseView, isRateLimited: true }, callbacks)

    expect(container.querySelector('.nmap-ot-warning')?.textContent).toContain(
      'ограничил частоту запросов',
    )
  })

  it('в режиме объектов показывает список и ошибку загрузки', () => {
    const container = document.createElement('div')

    renderPanel(
      container,
      { ...baseView, mode: 'objects', errors: { '4465652155': 'ERR_MISSING_OBJECT' } },
      callbacks,
    )

    expect(container.querySelectorAll('.nmap-ot-object')).toHaveLength(1)
    expect(container.textContent).toContain('Объект не найден')
  })

  it('рисует объекты карточками нативной ленты, как и события', () => {
    const container = document.createElement('div')

    renderPanel(container, { ...baseView, mode: 'objects' }, callbacks)

    const body = container.querySelector('.nmap-ot-body')
    expect(body?.classList.contains('nmap-ot-body_cards')).toBe(true)

    const card = container.querySelector('.nmap-ot-object')
    expect(card?.classList.contains('nk-list-item-view')).toBe(true)
    expect(card?.querySelector('.nk-event-view__event')).not.toBeNull()
  })

  it('не растягивает пустое состояние карточками', () => {
    const container = document.createElement('div')

    renderPanel(container, { ...baseView, objects: [], commitsByObject: {} }, callbacks)

    const body = container.querySelector('.nmap-ot-body')
    expect(body?.classList.contains('nmap-ot-body_cards')).toBe(false)
  })

  it('не использует классы нативных вкладок у режимов', () => {
    const container = document.createElement('div')

    renderPanel(container, baseView, callbacks)

    const switcher = container.querySelector('.nmap-ot-modes')
    const tabs = switcher?.querySelectorAll('.nmap-ot-mode') ?? []
    expect(switcher).not.toBeNull()
    expect(tabs).toHaveLength(2)
    // На .nk-tabs-bar__tab висят обработчики редактора и сайдбара: клик по режиму
    // переключал нативную панель.
    expect(tabs[0]?.classList.contains('nk-tabs-bar__tab')).toBe(false)
    expect(tabs[0]?.classList.contains('nmap-ot-mode_active')).toBe(true)
    expect(tabs[1]?.classList.contains('nmap-ot-mode_active')).toBe(false)

    expect(switcher?.querySelector('.nmap-ot-modes__selection')).not.toBeNull()
  })

  it('не всплывает клик по режиму наружу', () => {
    const container = document.createElement('div')
    const onDocumentClick = vi.fn()
    document.addEventListener('click', onDocumentClick)

    renderPanel(container, baseView, callbacks)
    document.body.appendChild(container)
    container.querySelectorAll<HTMLElement>('.nmap-ot-mode')[1]?.click()

    document.removeEventListener('click', onDocumentClick)
    container.remove()
    expect(onDocumentClick).not.toHaveBeenCalled()
  })

  it('передаёт выбранный режим в обработчик', () => {
    const container = document.createElement('div')
    const onModeChange = vi.fn()

    renderPanel(container, baseView, { ...callbacks, onModeChange })
    const tabs = container.querySelectorAll<HTMLElement>('.nmap-ot-mode')
    tabs[1]?.click()

    expect(onModeChange).toHaveBeenCalledWith('objects')
  })

  it('ставит полосу режима под выбранную вкладку', () => {
    const container = document.createElement('div')
    renderPanel(container, baseView, callbacks)

    const active = container.querySelector<HTMLElement>('.nmap-ot-mode_active')
    const selection = container.querySelector<HTMLElement>('.nmap-ot-modes__selection')
    if (!active || !selection) throw new Error('нет элементов режимов')

    Object.defineProperty(active, 'offsetLeft', { value: 12, configurable: true })
    Object.defineProperty(active, 'offsetWidth', { value: 100, configurable: true })
    syncModeSelection(container)

    expect(selection.style.transform).toBe('translateX(61.5px) scaleX(100)')
  })

  it('не двигает полосу, если вкладка не отрисована', () => {
    const container = document.createElement('div')
    renderPanel(container, baseView, callbacks)

    const active = container.querySelector<HTMLElement>('.nmap-ot-mode_active')
    const selection = container.querySelector<HTMLElement>('.nmap-ot-modes__selection')
    if (!active || !selection) throw new Error('нет элементов режимов')

    Object.defineProperty(active, 'offsetLeft', { value: 0, configurable: true })
    Object.defineProperty(active, 'offsetWidth', { value: 0, configurable: true })
    syncModeSelection(container)

    expect(selection.style.transform).toBe('')
  })

  it('показывает пустое состояние без объектов', () => {
    const container = document.createElement('div')

    renderPanel(container, { ...baseView, objects: [], commitsByObject: {} }, callbacks)

    expect(container.textContent).toContain('Добавьте объекты для отслеживания')
  })

  it('валидирует id в форме добавления', () => {
    const container = document.createElement('div')
    renderPanel(container, { ...baseView, objects: [] }, callbacks)

    const form = container.querySelector<HTMLFormElement>('.nmap-ot-add')
    const input = container.querySelector<HTMLInputElement>(
      '.nmap-ot-add__field .nk-text-input__control',
    )
    if (input) input.value = 'abc'
    form?.dispatchEvent(new Event('submit', { cancelable: true }))

    expect(callbacks.onAddObject).not.toHaveBeenCalled()
    expect(container.querySelector('.nmap-ot-add__error')?.textContent).toContain('цифр')
  })

  it('передаёт корректный id в обработчик добавления', () => {
    const container = document.createElement('div')
    renderPanel(container, { ...baseView, objects: [] }, callbacks)

    const form = container.querySelector<HTMLFormElement>('.nmap-ot-add')
    const input = container.querySelector<HTMLInputElement>(
      '.nmap-ot-add__field .nk-text-input__control',
    )
    if (input) input.value = '12345'
    form?.dispatchEvent(new Event('submit', { cancelable: true }))

    expect(callbacks.onAddObject).toHaveBeenCalledWith('12345')
  })

  it('просит менеджеры паролей не запоминать id объекта', () => {
    const container = document.createElement('div')
    renderPanel(container, { ...baseView, objects: [] }, callbacks)

    const form = container.querySelector<HTMLFormElement>('.nmap-ot-add')
    const input = container.querySelector<HTMLInputElement>(
      '.nmap-ot-add__field .nk-text-input__control',
    )

    expect(form?.getAttribute('autocomplete')).toBe('off')
    expect(input?.getAttribute('autocomplete')).toBe('off')
    expect(input?.getAttribute('data-form-type')).toBe('other')
    expect(input?.getAttribute('data-1p-ignore')).not.toBeNull()
    expect(input?.getAttribute('data-lpignore')).toBe('true')
    expect(input?.getAttribute('data-bwignore')).not.toBeNull()
    expect(input?.getAttribute('data-protonpass-ignore')).toBe('true')
  })
})

describe('object_tracker: иконка категории', () => {
  it('подбирает группу по префиксу категории', () => {
    expect(resolveCategoryIconClass('ad_jc')).toContain('nk-geoobject-icon_id_group-ad')
    expect(resolveCategoryIconClass('ad_el')).toContain('nk-geoobject-icon_id_group-ad')
    expect(resolveCategoryIconClass('rd_el')).toContain('nk-geoobject-icon_id_group-rd')
    expect(resolveCategoryIconClass('hydro_ln')).toContain('nk-geoobject-icon_id_group-hydro')
    expect(resolveCategoryIconClass('bld')).toContain('nk-geoobject-icon_id_group-bld')
    expect(resolveCategoryIconClass('group')).toContain('nk-geoobject-icon_id_group-group')
  })

  it('предпочитает самую длинную группу', () => {
    expect(resolveCategoryIconClass('urban_roadnet')).toContain(
      'nk-geoobject-icon_id_group-urban-roadnet',
    )
    expect(resolveCategoryIconClass('urban_areal')).toContain('nk-geoobject-icon_id_group-urban')
  })

  it('не путает ad и addr', () => {
    expect(resolveCategoryIconClass('addr')).toContain('nk-geoobject-icon_id_group-addr')
  })

  it('показывает placeholder без категории', () => {
    expect(resolveCategoryIconClass(undefined)).toContain('nk-geoobject-icon_id_placeholder')
    expect(resolveCategoryIconClass('')).toContain('nk-geoobject-icon_id_placeholder')
    expect(resolveCategoryIconClass('неизвестная')).toContain('nk-geoobject-icon_id_placeholder')
  })
})

describe('object_tracker: иконки конкретных категорий', () => {
  it('берёт иконку категории, когда она есть в CSS', () => {
    expect(resolveCategoryIconClass('poi_food')).toContain('nk-geoobject-icon_id_category-poi-food')
    expect(resolveCategoryIconClass('poi_medicine')).toContain(
      'nk-geoobject-icon_id_category-poi-medicine',
    )
    expect(resolveCategoryIconClass('aoi')).toContain('nk-geoobject-icon_id_category-aoi')
    expect(resolveCategoryIconClass('indoor_area')).toContain(
      'nk-geoobject-icon_id_category-indoor-area',
    )
    expect(resolveCategoryIconClass('hydro_ln_el')).toContain(
      'nk-geoobject-icon_id_category-hydro-ln-el',
    )
    expect(resolveCategoryIconClass('zipcode')).toContain('nk-geoobject-icon_id_category-zipcode')
  })

  it('категория важнее группы', () => {
    // hydro_ln_el есть и как категория, и как группа hydro — берём точную.
    expect(resolveCategoryIconClass('hydro_ln_el')).not.toContain('group-hydro')
  })

  it('подписка-регион показывается иконкой региона', () => {
    expect(resolveCategoryIconClass('feed_region')).toContain(
      'nk-geoobject-icon_id_category-region',
    )
  })

  it('падает на группу, если точной категории нет', () => {
    expect(resolveCategoryIconClass('ad_jc')).toContain('nk-geoobject-icon_id_group-ad')
    expect(resolveCategoryIconClass('rd_el')).toContain('nk-geoobject-icon_id_group-rd')
    expect(resolveCategoryIconClass('vegetation_ln')).toContain(
      'nk-geoobject-icon_id_group-vegetation',
    )
  })
})
