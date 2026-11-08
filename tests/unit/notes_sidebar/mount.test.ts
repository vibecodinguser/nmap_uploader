// @vitest-environment happy-dom

import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { NotesCreateSidebar } from '@/lib/notes_sidebar'
import { NOTES_BACK_ID, NOTES_PANEL_ID, NOTES_TILE_ID } from '@/lib/notes_sidebar/core'

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(() => Promise.resolve({ notes_button_enabled: true, locale: 'ru' })),
        set: vi.fn(() => Promise.resolve()),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    i18n: {
      getUILanguage: vi.fn(() => 'ru'),
      getMessage: vi.fn((key: string) => key),
    },
    runtime: {
      id: 'test-extension',
      sendMessage: vi.fn(() => Promise.resolve()),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}))

type SidebarDom = {
  content: HTMLElement
  view: HTMLElement
  header: HTMLElement
  title: HTMLElement
  suggest: HTMLElement
  lastUsedIsland: HTMLElement
}

/** Повторяет разметку панели выбора категорий редактора. */
const buildSidebar = (): SidebarDom => {
  const sidebar = document.createElement('aside')
  sidebar.className = 'nk-sidebar-view'

  const outerObserver = document.createElement('div')
  outerObserver.className = 'nk-size-observer nk-scrollable__content-size-observer'

  const island = document.createElement('div')
  island.className = 'nk-island'

  const header = document.createElement('div')
  header.className = 'nk-sidebar-header-view nk-grid nk-section nk-section_level_1'

  const title = document.createElement('div')
  title.className =
    'nk-sidebar-header-view__title nk-sidebar-header-view__title_centered nk-grid__col nk-grid__col_span_10 nk-grid__col_shift_1'

  const close = document.createElement('div')
  close.className = 'nk-sidebar-header-view__close nk-grid__col'

  header.append(title, close)

  const scrollable = document.createElement('div')
  scrollable.className = 'nk-scrollable nk-category-selector-groups-view'

  const container = document.createElement('div')
  container.className = 'nk-scrollable__container'

  const scrollContent = document.createElement('div')
  scrollContent.className = 'nk-scrollable__content'

  const observer = document.createElement('div')
  observer.className = 'nk-size-observer nk-scrollable__content-size-observer'

  const content = document.createElement('div')
  content.className = 'nk-category-selector-groups-view__content'

  const nativeGroup = document.createElement('div')
  nativeGroup.className = 'nk-category-selector-groups-view__group'
  nativeGroup.textContent = 'Дороги'
  content.appendChild(nativeGroup)

  observer.appendChild(content)
  scrollContent.appendChild(observer)
  container.appendChild(scrollContent)
  scrollable.appendChild(container)

  const suggest = document.createElement('div')
  suggest.className = 'nk-category-selector-view__suggest'
  suggest.textContent = 'Поиск'

  island.append(header, suggest, scrollable)

  const lastUsedIsland = document.createElement('div')
  lastUsedIsland.className = 'nk-island'
  lastUsedIsland.textContent = 'Недавно созданные'

  outerObserver.append(island, lastUsedIsland)
  sidebar.appendChild(outerObserver)
  document.body.appendChild(sidebar)

  return { content, view: scrollable, header, title, suggest, lastUsedIsland }
}

let sidebar: NotesCreateSidebar | null = null

const openPanel = (): void => {
  act(() => {
    document.getElementById(NOTES_TILE_ID)?.click()
  })
}

beforeEach(() => {
  ;(browser.storage.local.get as any).mockResolvedValue({
    notes_button_enabled: true,
    locale: 'ru',
  })
})

afterEach(() => {
  sidebar?.stop()
  sidebar = null
  vi.useRealTimers()
  document.body.replaceChildren()
  vi.clearAllMocks()
})

describe('NotesCreateSidebar', () => {
  it('добавляет плитку «Заметки» последней в список категорий', async () => {
    const { content } = buildSidebar()
    sidebar = new NotesCreateSidebar()
    await sidebar.start()

    const tile = document.getElementById(NOTES_TILE_ID)
    expect(tile).not.toBeNull()
    expect(content.lastElementChild).toBe(tile)
    expect(tile?.textContent).toContain('Заметки')
  })

  it('не показывает плитку, если настройка «Кнопка: Заметки» выключена', async () => {
    ;(browser.storage.local.get as any).mockResolvedValue({
      notes_button_enabled: false,
      locale: 'ru',
    })
    buildSidebar()

    sidebar = new NotesCreateSidebar()
    await sidebar.start()

    expect(document.getElementById(NOTES_TILE_ID)).toBeNull()
  })

  it('по клику скрывает список категорий и показывает блок создания', async () => {
    const { content } = buildSidebar()
    sidebar = new NotesCreateSidebar()
    await sidebar.start()

    openPanel()

    expect(content.style.display).toBe('none')
    expect(document.getElementById(NOTES_PANEL_ID)).not.toBeNull()
    expect(document.getElementById(NOTES_TILE_ID)?.getAttribute('aria-expanded')).toBe('true')
  })

  it('ставит нативную стрелку «Назад» в шапку и освобождает отступ заголовка', async () => {
    const { header, title } = buildSidebar()
    sidebar = new NotesCreateSidebar()
    await sidebar.start()

    openPanel()

    const back = document.getElementById(NOTES_BACK_ID)
    expect(back).not.toBeNull()
    expect(back?.classList.contains('nk-icon_id_back')).toBe(true)
    expect(back?.classList.contains('nk-icon_colored')).toBe(true)
    expect(back?.parentElement?.parentElement).toBe(header)
    expect(header.firstElementChild?.contains(back)).toBe(true)
    expect(title.classList.contains('nk-grid__col_shift_1')).toBe(false)
  })

  it('находит шапку, даже если она лежит вне острова', async () => {
    document.body.replaceChildren()

    const sidebarElement = document.createElement('aside')
    sidebarElement.className = 'nk-sidebar-view'

    const header = document.createElement('div')
    header.className = 'nk-sidebar-header-view nk-grid nk-section nk-section_level_1'
    const title = document.createElement('div')
    title.className = 'nk-sidebar-header-view__title nk-grid__col nk-grid__col_shift_1'
    header.appendChild(title)

    const scrollable = document.createElement('div')
    scrollable.className = 'nk-scrollable nk-category-selector-groups-view'
    const container = document.createElement('div')
    container.className = 'nk-scrollable__container'
    const scrollContent = document.createElement('div')
    scrollContent.className = 'nk-scrollable__content'
    const observer = document.createElement('div')
    observer.className = 'nk-size-observer nk-scrollable__content-size-observer'
    const content = document.createElement('div')
    content.className = 'nk-category-selector-groups-view__content'
    observer.appendChild(content)
    scrollContent.appendChild(observer)
    container.appendChild(scrollContent)
    scrollable.appendChild(container)

    sidebarElement.append(header, scrollable)
    document.body.appendChild(sidebarElement)

    sidebar = new NotesCreateSidebar()
    await sidebar.start()
    openPanel()

    const back = document.getElementById(NOTES_BACK_ID)
    expect(back).not.toBeNull()
    expect(header.firstElementChild?.contains(back)).toBe(true)
    expect(title.classList.contains('nk-grid__col_shift_1')).toBe(false)
  })

  it('схлопывает поиск до нативного разделителя и возвращает по «Назад»', async () => {
    const { content, lastUsedIsland, suggest, title } = buildSidebar()
    sidebar = new NotesCreateSidebar()
    await sidebar.start()

    openPanel()
    expect(lastUsedIsland.style.display).toBe('none')
    // Поиск не скрывается: его border-top — разделитель под заголовком.
    expect(suggest.classList.contains('nmap-notes-create__suggest-collapsed')).toBe(true)
    expect(suggest.style.display).toBe('')

    act(() => {
      document.getElementById(NOTES_BACK_ID)?.click()
    })

    expect(content.style.display).toBe('')
    expect(lastUsedIsland.style.display).toBe('')
    expect(suggest.classList.contains('nmap-notes-create__suggest-collapsed')).toBe(false)
    expect(title.classList.contains('nk-grid__col_shift_1')).toBe(true)
    expect(document.getElementById(NOTES_TILE_ID)?.getAttribute('aria-expanded')).toBe('false')
  })

  it('поднимает отступ списка, чтобы блок не уезжал под разделитель', async () => {
    const { content, view } = buildSidebar()
    view.style.marginTop = '-13px'

    sidebar = new NotesCreateSidebar()
    await sidebar.start()
    openPanel()

    expect(view.style.marginTop).toBe('0px')
    expect(content.style.display).toBe('none')

    act(() => {
      document.getElementById(NOTES_BACK_ID)?.click()
    })

    expect(view.style.marginTop).toBe('-13px')
  })

  it('возвращает плитку после перерисовки панели', async () => {
    const { content } = buildSidebar()
    sidebar = new NotesCreateSidebar()
    await sidebar.start()

    content.replaceChildren()

    act(() => {
      sidebar?.sync()
    })

    expect(document.getElementById(NOTES_TILE_ID)?.parentElement).toBe(content)
  })

  it('подхватывает только что открытую панель без задержки в секунду', async () => {
    vi.useFakeTimers()

    sidebar = new NotesCreateSidebar()
    await sidebar.start()

    // Панели ещё нет: плитка не должна появиться.
    expect(document.getElementById(NOTES_TILE_ID)).toBeNull()

    const { content } = buildSidebar()

    await vi.advanceTimersByTimeAsync(150)

    expect(document.getElementById(NOTES_TILE_ID)?.parentElement).toBe(content)
  })
})
