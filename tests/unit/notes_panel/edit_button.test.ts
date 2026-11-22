// @vitest-environment happy-dom

/**
 * Кнопка «Редактировать» в нижних контролах карты.
 *
 * Регрессия: после закрытия панели кнопка оставалась в разметке как пустой
 * блок `#nmap-notes-edit-button-wrapper` и выглядела артефактом.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BOTTOM_CONTROLS_SELECTOR,
  createNotesEditButton,
  ensureNotesEditButton,
  findBottomControls,
  NOTES_EDIT_BUTTON_ID,
  NOTES_EDIT_BUTTON_WRAPPER_ID,
  removeNotesEditButton,
} from '@/lib/notes_panel/edit_button'

const mountControls = (): HTMLElement => {
  const controls = document.createElement('div')
  controls.className = BOTTOM_CONTROLS_SELECTOR.slice(1)
  document.body.appendChild(controls)
  return controls
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('кнопка «Редактировать»', () => {
  it('вставляется в нижние контролы карты', () => {
    const controls = mountControls()

    ensureNotesEditButton({ label: 'Редактировать', onClick: vi.fn() })

    expect(findBottomControls()).toBe(controls)
    expect(controls.querySelector(`#${NOTES_EDIT_BUTTON_WRAPPER_ID}`)).not.toBeNull()
    expect(controls.querySelector(`#${NOTES_EDIT_BUTTON_ID}`)).not.toBeNull()
  })

  it('вызывает обработчик по клику', () => {
    mountControls()
    const onClick = vi.fn()

    ensureNotesEditButton({ label: 'Редактировать', onClick })
    document.getElementById(NOTES_EDIT_BUTTON_ID)?.click()

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('обновляет подпись без пересоздания кнопки', () => {
    mountControls()
    ensureNotesEditButton({ label: 'Редактировать', onClick: vi.fn() })
    const first = document.getElementById(NOTES_EDIT_BUTTON_ID)

    ensureNotesEditButton({ label: 'Edit', onClick: vi.fn() })

    expect(document.getElementById(NOTES_EDIT_BUTTON_ID)).toBe(first)
    expect(first?.textContent).toContain('Edit')
  })

  it('removeNotesEditButton убирает кнопку из разметки целиком', () => {
    mountControls()
    ensureNotesEditButton({ label: 'Редактировать', onClick: vi.fn() })

    removeNotesEditButton()

    expect(document.getElementById(NOTES_EDIT_BUTTON_ID)).toBeNull()
    expect(document.getElementById(NOTES_EDIT_BUTTON_WRAPPER_ID)).toBeNull()
  })

  it('удаление идемпотентно', () => {
    mountControls()
    ensureNotesEditButton({ label: 'Редактировать', onClick: vi.fn() })

    expect(() => {
      removeNotesEditButton()
      removeNotesEditButton()
    }).not.toThrow()
  })

  it('без нижних контролов ничего не создаёт', () => {
    ensureNotesEditButton({ label: 'Редактировать', onClick: vi.fn() })

    expect(document.getElementById(NOTES_EDIT_BUTTON_WRAPPER_ID)).toBeNull()
  })

  /*
   * Регрессия: кнопка собиралась на `nk-button_size_m` (28 px) и выпадала из
   * ряда нижних контролов, где соседи — `nk-button_size_xl` высотой 38 px.
   */
  it('использует размер и вид соседних кнопок нижнего ряда', () => {
    const button = createNotesEditButton({ label: 'Редактировать', onClick: vi.fn() })

    expect(button.classList.contains('nk-button_size_xl')).toBe(true)
    expect(button.classList.contains('nk-button_view_dark')).toBe(true)
    expect(button.classList.contains('nk-button_size_m')).toBe(false)
  })
})
