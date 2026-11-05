// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRACKER_PANEL_ID, TRACKER_TAB_ID } from '@/lib/object_tracker/ui/dom'
import {
  findNativeContent,
  findTabsContainer,
  ObjectTrackerSidebar,
  TRACKER_TAB_LABEL,
} from '@/lib/object_tracker/ui/mount'

const buildSidebar = (): HTMLElement => {
  const root = document.createElement('div')
  root.className = 'nk-size-observer'

  const header = document.createElement('div')
  header.className = 'nk-sidebar-header-view nk-section nk-section_level_1'
  header.textContent = 'Уведомления'

  const tabsBar = document.createElement('div')
  tabsBar.className = 'nk-tabs-bar nk-section nk-section_level_1'
  const tabs = document.createElement('div')
  tabs.className = 'nk-tabs-bar__tabs'

  const first = document.createElement('div')
  first.className = 'nk-tabs-bar__tab nk-tabs-bar__tab_selected'
  first.textContent = 'Мои правки'

  const second = document.createElement('div')
  second.className = 'nk-tabs-bar__tab'
  second.textContent = 'Подписки'

  tabs.appendChild(first)
  tabs.appendChild(second)
  tabsBar.appendChild(tabs)

  const content = document.createElement('div')
  content.className = 'nk-section nk-section_level_1'
  content.textContent = 'нативный контент'

  root.appendChild(header)
  root.appendChild(tabsBar)
  root.appendChild(content)
  document.body.appendChild(root)

  return content
}

describe('object_tracker: поиск вкладок', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('находит контейнер вкладок', () => {
    buildSidebar()

    expect(findTabsContainer()).not.toBeNull()
  })

  it('возвращает null без панели', () => {
    expect(findTabsContainer()).toBeNull()
  })

  it('находит нативный контент рядом с вкладками', () => {
    const content = buildSidebar()
    const tabs = findTabsContainer()

    expect(tabs).not.toBeNull()
    if (tabs) {
      expect(findNativeContent(tabs)).toBe(content)
    }
  })
})

describe('object_tracker: вкладка панели', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('монтирует вкладку последней и скрытую панель', () => {
    buildSidebar()
    const sidebar = new ObjectTrackerSidebar({ onActivate: vi.fn() })

    expect(sidebar.mount()).toBe(true)

    const tabs = document.querySelectorAll('.nk-tabs-bar__tab')
    expect(tabs[tabs.length - 1]?.id).toBe(TRACKER_TAB_ID)
    expect(tabs[tabs.length - 1]?.textContent).toBe(TRACKER_TAB_LABEL)

    const panel = document.getElementById(TRACKER_PANEL_ID)
    expect(panel).not.toBeNull()
    expect(panel?.style.display).toBe('none')
  })

  it('не дублирует вкладку при повторном монтировании', () => {
    buildSidebar()
    const sidebar = new ObjectTrackerSidebar({ onActivate: vi.fn() })

    sidebar.mount()
    sidebar.mount()

    expect(document.querySelectorAll(`#${TRACKER_TAB_ID}`)).toHaveLength(1)
  })

  it('при открытии скрывает нативный контент и вызывает onActivate', () => {
    const content = buildSidebar()
    const onActivate = vi.fn()
    const sidebar = new ObjectTrackerSidebar({ onActivate })
    sidebar.mount()

    document
      .getElementById(TRACKER_TAB_ID)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(sidebar.isActive()).toBe(true)
    expect(content.style.display).toBe('none')
    expect(document.getElementById(TRACKER_PANEL_ID)?.style.display).toBe('')
  })

  it('переносит класс выбранной вкладки на нашу', () => {
    buildSidebar()
    const sidebar = new ObjectTrackerSidebar({ onActivate: vi.fn() })
    sidebar.mount()

    document
      .getElementById(TRACKER_TAB_ID)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    const selected = document.querySelectorAll('.nk-tabs-bar__tab_selected')
    expect(selected).toHaveLength(1)
    expect((selected[0] as HTMLElement).id).toBe(TRACKER_TAB_ID)
  })

  it('возвращает нативный контент по клику на нативную вкладку', () => {
    const content = buildSidebar()
    const sidebar = new ObjectTrackerSidebar({ onActivate: vi.fn() })
    sidebar.mount()

    document
      .getElementById(TRACKER_TAB_ID)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const nativeTab = Array.from(document.querySelectorAll('.nk-tabs-bar__tab')).find(
      (tab) => tab.id !== TRACKER_TAB_ID,
    )
    nativeTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(sidebar.isActive()).toBe(false)
    expect(content.style.display).toBe('')
    expect(document.getElementById(TRACKER_PANEL_ID)?.style.display).toBe('none')
  })

  it('снимает вкладку и панель, возвращая нативный контент', () => {
    const content = buildSidebar()
    const sidebar = new ObjectTrackerSidebar({ onActivate: vi.fn() })
    sidebar.mount()
    document
      .getElementById(TRACKER_TAB_ID)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    sidebar.unmount()

    expect(document.getElementById(TRACKER_TAB_ID)).toBeNull()
    expect(document.getElementById(TRACKER_PANEL_ID)).toBeNull()
    expect(content.style.display).toBe('')
    expect(sidebar.isMounted()).toBe(false)
  })

  it('не монтируется без панели редактора', () => {
    const sidebar = new ObjectTrackerSidebar({ onActivate: vi.fn() })

    expect(sidebar.mount()).toBe(false)
  })

  it('переносит вкладку в новую панель, если старая осталась скрытой после Escape', () => {
    const oldContent = buildSidebar()
    const sidebar = new ObjectTrackerSidebar({ onActivate: vi.fn() })
    sidebar.mount()

    // Escape: панель прячется, но остаётся в документе.
    const oldRoot = oldContent.parentElement
    if (oldRoot instanceof HTMLElement) oldRoot.style.display = 'none'

    // Повторное открытие создаёт новую панель.
    const newContent = buildSidebar()

    expect(sidebar.mount()).toBe(true)

    const tab = document.getElementById(TRACKER_TAB_ID)
    expect(tab).not.toBeNull()
    expect(tab?.closest('.nk-size-observer')).toBe(newContent.parentElement)
    expect(document.querySelectorAll(`#${TRACKER_TAB_ID}`)).toHaveLength(1)
  })

  it('считает вкладку несмонтированной, если её панель скрыта', () => {
    const content = buildSidebar()
    const sidebar = new ObjectTrackerSidebar({ onActivate: vi.fn() })
    sidebar.mount()
    expect(sidebar.isMounted()).toBe(true)

    const root = content.parentElement
    if (root instanceof HTMLElement) root.style.display = 'none'

    expect(sidebar.isMounted()).toBe(false)
  })

  it('возвращает вкладку в ту же панель после повторного открытия', () => {
    const content = buildSidebar()
    const sidebar = new ObjectTrackerSidebar({ onActivate: vi.fn() })
    sidebar.mount()

    const root = content.parentElement
    if (root instanceof HTMLElement) root.style.display = 'none'
    expect(sidebar.mount()).toBe(true)

    if (root instanceof HTMLElement) root.style.display = ''

    expect(sidebar.mount()).toBe(true)
    expect(document.querySelectorAll(`#${TRACKER_TAB_ID}`)).toHaveLength(1)
    expect(document.getElementById(TRACKER_TAB_ID)?.closest('.nk-size-observer')).toBe(root)
  })

  it('показывает точку непрочитанного на вкладке', () => {
    buildSidebar()
    const sidebar = new ObjectTrackerSidebar({ onActivate: vi.fn() })
    sidebar.mount()

    sidebar.setHasUnread(true)
    expect(document.getElementById(TRACKER_TAB_ID)?.classList.contains('nmap-ot-tab-unread')).toBe(
      true,
    )

    sidebar.setHasUnread(false)
    expect(document.getElementById(TRACKER_TAB_ID)?.classList.contains('nmap-ot-tab-unread')).toBe(
      false,
    )
  })
})
