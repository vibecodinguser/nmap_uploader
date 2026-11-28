// @vitest-environment happy-dom

/**
 * Хост панели сообщает о закрытии.
 *
 * На этом сигнале держится уборка кнопки «Редактировать»: без него выбор
 * заметки и кнопка оставались после закрытия панели.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNotesPanelHost,
  NOTES_PANEL_FIT_HEIGHT_MESSAGE,
  NOTES_PANEL_FRAME_ID,
  NOTES_PANEL_HANDLE_ID,
  NOTES_PANEL_HOST_ID,
  NOTES_PANEL_SHOW_NOTE_MESSAGE,
  removeNotesPanelStyles,
} from '@/lib/notes_panel/host'
import { getURL } from '@/tests/setup/browser_mock'

/** Панель узнаёт высоту под содержимое сообщением из iframe — как в жизни. */
const requestFitHeight = (height: number | null): void => {
  const frame = document.getElementById(NOTES_PANEL_FRAME_ID) as HTMLIFrameElement | null
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { action: NOTES_PANEL_FIT_HEIGHT_MESSAGE, height },
      source: frame?.contentWindow ?? null,
    }),
  )
}

const panelHeight = (): number =>
  Number.parseInt(document.getElementById(NOTES_PANEL_HOST_ID)?.style.height ?? '', 10)

beforeEach(() => {
  // happy-dom не умеет навигировать iframe по chrome-extension:// — подменяем
  // адрес на about:blank: тесту важен факт открытия, а не содержимое панели.
  getURL.mockReturnValue('about:blank')
  window.innerHeight = 1000
})

afterEach(() => {
  document.body.innerHTML = ''
  removeNotesPanelStyles()
})

describe('хост панели заметок', () => {
  it('сообщает об открытии и закрытии', () => {
    const onVisibilityChange = vi.fn()
    const host = createNotesPanelHost({ onVisibilityChange })

    host.open()
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true)
    expect(document.getElementById(NOTES_PANEL_HOST_ID)?.dataset.open).toBe('true')

    host.close()
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false)
    expect(document.getElementById(NOTES_PANEL_HOST_ID)?.dataset.open).toBe('false')
  })

  it('не сообщает о закрытии дважды', () => {
    const onVisibilityChange = vi.fn()
    const host = createNotesPanelHost({ onVisibilityChange })

    host.open()
    host.close()
    host.close()

    expect(onVisibilityChange).toHaveBeenCalledTimes(2)
  })

  it('toggle закрывает открытую панель', () => {
    const onVisibilityChange = vi.fn()
    const host = createNotesPanelHost({ onVisibilityChange })

    host.toggle()
    host.toggle()

    expect(host.isOpen()).toBe(false)
    expect(onVisibilityChange.mock.calls).toEqual([[true], [false]])
  })

  /*
   * Карточка свойств выше четверти экрана: если не подогнать высоту, нижние
   * блоки остаются под прокруткой и «все блоки видны» не выполняется.
   */
  it('подгоняет высоту под содержимое карточки', () => {
    const host = createNotesPanelHost()
    host.open()

    requestFitHeight(560)

    expect(panelHeight()).toBe(560)
  })

  it('возвращает пользовательскую высоту, когда подгонка снята', () => {
    const host = createNotesPanelHost()
    host.open()
    requestFitHeight(560)

    requestFitHeight(null)

    expect(panelHeight()).toBe(250)
  })

  it('не поднимает панель выше экрана', () => {
    const host = createNotesPanelHost()
    host.open()

    requestFitHeight(5000)

    expect(panelHeight()).toBe(1000)
  })

  it('прибавляет к высоте карточки ручку панели', () => {
    const host = createNotesPanelHost()
    host.open()

    const handle = document.getElementById(NOTES_PANEL_HANDLE_ID)
    if (!handle) throw new Error('ручка не найдена')
    handle.style.marginTop = '-4px'
    Object.defineProperty(handle, 'offsetHeight', { value: 8, configurable: true })

    requestFitHeight(560)

    expect(panelHeight()).toBe(564)
  })

  /*
   * Регрессия: панель, открытая кнопкой «Редактировать» с нуля, показывала
   * список. Сообщение уходило в iframe до загрузки документа и терялось.
   */
  it('повторяет просьбу показать заметку после загрузки iframe', () => {
    const host = createNotesPanelHost()

    host.showNote('note-1')

    const frame = document.getElementById(NOTES_PANEL_FRAME_ID) as HTMLIFrameElement
    const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage')
    frame.dispatchEvent(new Event('load'))

    expect(postMessage).toHaveBeenCalledWith(
      { action: NOTES_PANEL_SHOW_NOTE_MESSAGE, noteId: 'note-1' },
      '*',
    )
  })

  /*
   * Перезагрузка расширения выбивает страницу панели из документа, а контейнер
   * с ручкой остаётся. Раньше хост считал панель собранной и открывал пустую
   * белую полосу: ни списка, ни шапки.
   */
  it('пересобирает панель, если iframe выбит из документа', () => {
    const host = createNotesPanelHost()
    host.open()

    const frame = document.getElementById(NOTES_PANEL_FRAME_ID)
    if (!frame) throw new Error('iframe не найден')
    frame.remove()

    host.close()
    host.open()

    expect(document.getElementById(NOTES_PANEL_FRAME_ID)).not.toBeNull()
    expect(document.getElementById(NOTES_PANEL_HOST_ID)?.childElementCount).toBe(2)
  })

  it('считает полуразобранную панель закрытой', () => {
    const host = createNotesPanelHost()
    host.open()

    document.getElementById(NOTES_PANEL_FRAME_ID)?.remove()

    expect(host.isOpen()).toBe(false)

    host.toggle()
    expect(host.isOpen()).toBe(true)
  })

  it('протяжка ручки оставляет текущую высоту карточки', () => {
    const host = createNotesPanelHost()
    host.open()
    requestFitHeight(560)

    const handle = document.getElementById(NOTES_PANEL_HANDLE_ID)
    if (!handle) throw new Error('ручка не найдена')
    // Панель в happy-dom без размеров: клик по ручке без движения не должен
    // возвращать её к четверти экрана.
    Object.defineProperty(document.getElementById(NOTES_PANEL_HOST_ID), 'getBoundingClientRect', {
      value: () => ({ top: 0, bottom: 560, height: 560, left: 0, right: 0, width: 0 }),
      configurable: true,
    })
    handle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientY: 500 }))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: 500 }))

    expect(panelHeight()).toBe(560)
  })
})
