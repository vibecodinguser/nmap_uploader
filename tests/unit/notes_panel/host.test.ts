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
  NOTES_PANEL_HOST_ID,
  removeNotesPanelStyles,
} from '@/lib/notes_panel/host'
import { getURL } from '@/tests/setup/browser_mock'

beforeEach(() => {
  // happy-dom не умеет навигировать iframe по chrome-extension:// — подменяем
  // адрес на about:blank: тесту важен факт открытия, а не содержимое панели.
  getURL.mockReturnValue('about:blank')
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
})
