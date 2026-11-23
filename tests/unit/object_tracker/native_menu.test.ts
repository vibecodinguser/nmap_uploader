// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  findObjectMenu,
  isObjectMenu,
  NATIVE_MENU_ITEM_CLASS,
  NATIVE_MENU_ITEM_DISABLED_CLASS,
  ObjectTrackerNativeMenu,
  readObjectIdFromUrl,
  readObjectTitle,
} from '@/lib/object_tracker/native_menu'
import { TRACKER_TOAST_ID } from '@/lib/object_tracker/ui/toast'

const OBJECT_ID = '3470560507'
const OBJECT_TITLE = 'Участок дороги'

/** Разметка повторяет живую страницу редактора: меню рендерится порталом. */
const buildPage = ({ menuVisible = true }: { menuVisible?: boolean } = {}): void => {
  document.body.innerHTML = `
    <div class="nk-app-view">
      <aside class="nk-sidebar-view nk-geoobject-viewer-view">
        <div class="nk-sidebar-header-view nk-grid nk-section nk-section_level_1">
          <div class="nk-grid__col">
            <span class="nk-icon nk-icon_id_edit nk-icon_align_auto nk-icon_colored nk-icon_interactive"></span>
          </div>
          <div class="nk-grid__col">
            <span class="nk-icon nk-icon_id_more nk-icon_align_auto nk-icon_colored nk-icon_interactive"><svg></svg></span>
          </div>
          <div class="nk-sidebar-header-view__title nk-grid__col">${OBJECT_TITLE}</div>
        </div>
      </aside>
    </div>
    <div class="nk-portal">
      <div class="nk-popup nk-popup_theme_islands nk-popup_restrict-height ${menuVisible ? 'nk-popup_visible' : ''}" style="left: 2184px; top: 109px;">
        <div class="nk-size-observer">
          <div class="nk-popup__content">
            <div class="nk-menu nk-menu_theme_islands nk-menu_size_m" tabindex="0">
              <div class="nk-menu__group" role="group">
                <div class="nk-menu-item nk-menu-item_theme_islands nk-menu-item_size_m">Удалить</div>
                <div class="nk-menu-item nk-menu-item_theme_islands nk-menu-item_size_m">Копировать</div>
                <div class="nk-menu-item nk-menu-item_theme_islands nk-menu-item_size_m">Поделиться</div>
                <div class="nk-menu-item nk-menu-item_theme_islands nk-menu-item_size_m">Сообщить об&nbsp;ошибке</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="nk-popup nk-popup_theme_islands nk-popup_visible">
        <div class="nk-size-observer">
          <div class="nk-popup__content">
            <div class="nk-menu nk-menu_theme_islands nk-menu_size_l" tabindex="0">
              <div class="nk-menu__group" role="group">
                <div class="nk-menu-item nk-menu-item_theme_islands nk-menu-item_size_l">Справка</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

const clickMoreIcon = (): void => {
  const icon = document.querySelector<HTMLElement>('.nk-geoobject-viewer-view .nk-icon_id_more')
  icon?.click()
}

const setObjectMenuItems = (texts: readonly string[]): void => {
  const group = document.querySelector<HTMLElement>('.nk-menu__group')
  if (!group) return
  group.replaceChildren(
    ...texts.map((text) => {
      const item = document.createElement('div')
      item.className = 'nk-menu-item nk-menu-item_theme_islands nk-menu-item_size_m'
      item.textContent = text
      return item
    }),
  )
}

const getMenuItem = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(`.${NATIVE_MENU_ITEM_CLASS}`)

const flushPromises = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('object_tracker: пункт «Отслеживать» в нативном меню', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.location.hash = `#!/objects/${OBJECT_ID}?z=14&ll=39.18%2C44.96`
    buildPage()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    window.location.hash = ''
  })

  const createMenu = (
    overrides: Partial<ConstructorParameters<typeof ObjectTrackerNativeMenu>[0]> = {},
  ) => {
    const tracked = new Set<string>()
    const onAdd = vi.fn(async (objectId: string) => {
      tracked.add(objectId)
      return { ok: true }
    })
    const onRemove = vi.fn(async (objectId: string) => {
      tracked.delete(objectId)
      return { ok: true }
    })
    const menu = new ObjectTrackerNativeMenu({
      isTracked: (objectId) => tracked.has(objectId),
      canAdd: () => true,
      onAdd,
      onRemove,
      translate: (key) => key,
      ...overrides,
    })
    return { menu, onAdd, onRemove, tracked }
  }

  const isPopupVisible = (): boolean =>
    Boolean(document.querySelector('.nk-portal .nk-popup')?.classList.contains('nk-popup_visible'))

  it('достаёт id объекта из hash редактора', () => {
    expect(readObjectIdFromUrl(`https://n.maps.yandex.ru/#!/objects/${OBJECT_ID}?z=14`)).toBe(
      OBJECT_ID,
    )
    expect(readObjectIdFromUrl('https://n.maps.yandex.ru/#!/?z=14&ll=1,2')).toBeNull()
    expect(readObjectIdFromUrl('не url')).toBeNull()
  })

  it('читает название объекта из шапки карточки', () => {
    expect(readObjectTitle()).toBe(OBJECT_TITLE)
  })

  it('отличает меню объекта от меню справки', () => {
    const menus = document.querySelectorAll<HTMLElement>('.nk-menu')

    expect(isObjectMenu(menus[0] as HTMLElement)).toBe(true)
    expect(isObjectMenu(menus[1] as HTMLElement)).toBe(false)
    expect(findObjectMenu()).toBe(menus[0])
  })

  it('вставляет пункт последним по клику на иконку «Ещё»', () => {
    const { menu } = createMenu()
    menu.start()

    clickMoreIcon()
    vi.advanceTimersByTime(800)

    const item = getMenuItem()
    const group = item?.parentElement
    expect(item?.textContent).toBe('objectTracker.menuTrack')
    expect(item?.getAttribute('role')).toBe('menuitem')
    expect(group?.lastElementChild).toBe(item)
    expect(item?.nextElementSibling).toBeNull()

    menu.stop()
  })

  it('переносит пункт в конец, если редактор дописал свой после него', async () => {
    const { menu } = createMenu()
    menu.start()

    clickMoreIcon()
    await vi.advanceTimersByTimeAsync(100)

    const item = getMenuItem()
    const group = item?.parentElement
    const nativeItem = document.createElement('div')
    nativeItem.className = 'nk-menu-item nk-menu-item_theme_islands nk-menu-item_size_m'
    nativeItem.textContent = 'История объекта'
    group?.appendChild(nativeItem)
    expect(group?.lastElementChild).not.toBe(item)

    // Ближайшая синхронизация возвращает пункт в конец.
    document.body.appendChild(document.createElement('span'))
    await vi.advanceTimersByTimeAsync(100)

    expect(group?.lastElementChild).toBe(item)
    expect(item?.nextElementSibling).toBeNull()

    menu.stop()
  })

  it('не трогает меню справки', () => {
    const { menu } = createMenu()
    menu.start()

    clickMoreIcon()
    vi.advanceTimersByTime(800)

    const helpGroup = document.querySelectorAll<HTMLElement>('.nk-menu__group')[1]
    expect(helpGroup?.querySelector(`.${NATIVE_MENU_ITEM_CLASS}`)).toBeNull()

    menu.stop()
  })

  it('показывает активный пункт «Не отслеживать», если объект уже наблюдается', () => {
    const { menu } = createMenu({ isTracked: () => true })
    menu.start()

    clickMoreIcon()
    vi.advanceTimersByTime(800)

    const item = getMenuItem()
    expect(item?.textContent).toBe('objectTracker.menuUntrack')
    expect(item?.classList.contains(NATIVE_MENU_ITEM_DISABLED_CLASS)).toBe(false)
    expect(item?.getAttribute('aria-disabled')).toBe('false')
    expect(item?.tabIndex).toBe(0)

    menu.stop()
  })

  it('показывает неактивный пункт при достигнутом лимите', () => {
    const { menu } = createMenu({ canAdd: () => false })
    menu.start()

    clickMoreIcon()
    vi.advanceTimersByTime(800)

    const item = getMenuItem()
    expect(item?.textContent).toBe('objectTracker.menuLimit')
    expect(item?.classList.contains(NATIVE_MENU_ITEM_DISABLED_CLASS)).toBe(true)

    menu.stop()
  })

  it('добавляет объект по клику и закрывает меню', async () => {
    const { menu, onAdd, tracked } = createMenu()
    menu.start()

    clickMoreIcon()
    vi.advanceTimersByTime(800)
    expect(isPopupVisible()).toBe(true)

    getMenuItem()?.click()
    await flushPromises()

    expect(onAdd).toHaveBeenCalledWith(OBJECT_ID, OBJECT_TITLE)
    expect(tracked.has(OBJECT_ID)).toBe(true)
    // Меню закрывается: после открытия пункт предлагает снять наблюдение.
    clickMoreIcon()
    vi.advanceTimersByTime(800)
    expect(getMenuItem()?.textContent).toBe('objectTracker.menuUntrack')
    expect(getMenuItem()?.classList.contains(NATIVE_MENU_ITEM_DISABLED_CLASS)).toBe(false)

    menu.stop()
  })

  it('закрывает меню кликом по странице после добавления', async () => {
    const { menu } = createMenu()
    menu.start()

    clickMoreIcon()
    vi.advanceTimersByTime(800)

    const closeSpy = vi.fn()
    document.body.addEventListener('click', (event) => {
      if (event.target === document.body) closeSpy()
    })

    getMenuItem()?.click()
    await flushPromises()

    expect(closeSpy).toHaveBeenCalledTimes(1)

    menu.stop()
  })

  it('убирает объект из наблюдения пунктом «Не отслеживать»', async () => {
    const { menu, onAdd, onRemove, tracked } = createMenu()
    menu.start()

    clickMoreIcon()
    vi.advanceTimersByTime(800)
    getMenuItem()?.click()
    await flushPromises()
    expect(tracked.has(OBJECT_ID)).toBe(true)

    // Открываем меню снова: объект уже в «Мои объекты».
    clickMoreIcon()
    vi.advanceTimersByTime(800)
    expect(getMenuItem()?.textContent).toBe('objectTracker.menuUntrack')

    getMenuItem()?.click()
    await flushPromises()

    expect(onRemove).toHaveBeenCalledWith(OBJECT_ID)
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(tracked.has(OBJECT_ID)).toBe(false)
    clickMoreIcon()
    vi.advanceTimersByTime(800)
    expect(getMenuItem()?.textContent).toBe('objectTracker.menuTrack')

    menu.stop()
  })

  it('показывает сообщение об ошибке снятия с наблюдения', async () => {
    const { menu } = createMenu({
      isTracked: () => true,
      onRemove: vi.fn(async () => ({ ok: false, error: 'FETCH_FAILED' })),
    })
    menu.start()

    clickMoreIcon()
    vi.advanceTimersByTime(800)

    getMenuItem()?.click()
    await flushPromises()

    expect(document.getElementById(TRACKER_TOAST_ID)?.textContent).toBe(
      'objectTracker.errorUntrack',
    )

    menu.stop()
  })

  it('не добавляет объект повторно, если он уже наблюдается', async () => {
    const { menu, onAdd, onRemove } = createMenu({ isTracked: () => true })
    menu.start()

    clickMoreIcon()
    vi.advanceTimersByTime(800)

    getMenuItem()?.click()
    await flushPromises()

    expect(onAdd).not.toHaveBeenCalled()
    expect(onRemove).toHaveBeenCalledWith(OBJECT_ID)

    menu.stop()
  })

  it('показывает сообщение об ошибке добавления', async () => {
    const { menu } = createMenu({ onAdd: vi.fn(async () => ({ ok: false, error: 'DUPLICATE' })) })
    menu.start()

    clickMoreIcon()
    vi.advanceTimersByTime(800)

    getMenuItem()?.click()
    await flushPromises()

    expect(document.getElementById(TRACKER_TOAST_ID)?.textContent).toBe(
      'objectTracker.errorDuplicate',
    )

    menu.stop()
  })

  it('не вставляет пункт, если в URL нет объекта', () => {
    window.location.hash = '#!/?z=14&ll=39.18%2C44.96'
    const { menu } = createMenu()
    menu.start()

    clickMoreIcon()
    vi.advanceTimersByTime(800)

    expect(getMenuItem()).toBeNull()

    menu.stop()
  })

  it('убирает пункт при выключении функции', () => {
    const { menu } = createMenu()
    menu.start()

    clickMoreIcon()
    vi.advanceTimersByTime(800)
    expect(getMenuItem()).not.toBeNull()

    menu.stop()
    expect(getMenuItem()).toBeNull()
  })

  it('вставляет пункт, когда меню открылось без клика по иконке', async () => {
    const popup = document.querySelector<HTMLElement>('.nk-portal .nk-popup')
    popup?.classList.remove('nk-popup_visible')
    buildPage({ menuVisible: false })

    const { menu } = createMenu()
    menu.start()

    // Меню открывает сам редактор: наш обработчик клика не участвует.
    document.querySelector<HTMLElement>('.nk-portal .nk-popup')?.classList.add('nk-popup_visible')
    await vi.advanceTimersByTimeAsync(100)

    expect(getMenuItem()).not.toBeNull()

    menu.stop()
  })

  it('возвращает пункт после перерисовки содержимого меню', async () => {
    const { menu } = createMenu()
    menu.start()

    clickMoreIcon()
    await vi.advanceTimersByTimeAsync(100)
    expect(getMenuItem()).not.toBeNull()

    // React пересобрал группу пунктов и потерял наш узел.
    const group = document.querySelector<HTMLElement>('.nk-menu__group')
    if (group) {
      group.innerHTML =
        '<div class="nk-menu-item nk-menu-item_theme_islands nk-menu-item_size_m">Удалить</div>' +
        '<div class="nk-menu-item nk-menu-item_theme_islands nk-menu-item_size_m">Копировать</div>' +
        '<div class="nk-menu-item nk-menu-item_theme_islands nk-menu-item_size_m">Поделиться</div>'
    }
    await vi.advanceTimersByTimeAsync(100)

    expect(getMenuItem()).not.toBeNull()

    menu.stop()
  })

  it('перестаёт следить за меню после остановки', async () => {
    const { menu } = createMenu()
    menu.start()
    menu.stop()

    document
      .querySelector<HTMLElement>('.nk-portal .nk-popup')
      ?.classList.remove('nk-popup_visible')
    await vi.advanceTimersByTimeAsync(50)
    document.querySelector<HTMLElement>('.nk-portal .nk-popup')?.classList.add('nk-popup_visible')
    await vi.advanceTimersByTimeAsync(200)

    expect(getMenuItem()).toBeNull()
  })

  it('вставляет пункт в меню АТД без «Копировать» (как в редакторе)', async () => {
    // Реальная разметка АТД: «Удалить», «Поделиться», «Сообщить об ошибке»
    // (с неразрывным пробелом) — пункта «Копировать» нет.
    setObjectMenuItems(['Удалить', 'Поделиться', 'Сообщить об\u00a0ошибке'])

    const { menu } = createMenu()
    menu.start()

    clickMoreIcon()
    await vi.advanceTimersByTimeAsync(100)

    expect(getMenuItem()).not.toBeNull()

    menu.stop()
  })

  it('вставляет пункт в меню с непривычным набором пунктов после клика по «Ещё»', async () => {
    setObjectMenuItems(['Удалить', 'История объекта', 'Свойства'])

    const { menu } = createMenu()
    menu.start()

    clickMoreIcon()
    await vi.advanceTimersByTimeAsync(100)

    expect(getMenuItem()).not.toBeNull()

    menu.stop()
  })

  it('не трогает меню справки, открытое без клика по «Ещё»', async () => {
    const { menu } = createMenu()
    menu.start()

    const helpPopup = document.querySelectorAll<HTMLElement>('.nk-portal .nk-popup')[1]
    helpPopup?.classList.add('nk-popup_visible')
    await vi.advanceTimersByTimeAsync(200)

    const helpGroup = document.querySelectorAll<HTMLElement>('.nk-menu__group')[1]
    expect(helpGroup?.querySelector(`.${NATIVE_MENU_ITEM_CLASS}`)).toBeNull()

    menu.stop()
  })

  it('не считает иконку разворота списка атрибутов кнопкой «Ещё»', async () => {
    // В карточке две иконки `nk-icon_id_more`: шапка и разворот списка.
    buildPage({ menuVisible: false })
    const listIcon = document.createElement('span')
    listIcon.className =
      'nk-icon nk-icon_id_more nk-icon_align_auto nk-icon_interactive nk-labeled-list-layout__expand-control'
    document.querySelector('.nk-geoobject-viewer-view')?.appendChild(listIcon)

    const { menu } = createMenu()
    menu.start()

    listIcon.click()
    await vi.advanceTimersByTimeAsync(200)

    expect(getMenuItem()).toBeNull()

    menu.stop()
  })
})
