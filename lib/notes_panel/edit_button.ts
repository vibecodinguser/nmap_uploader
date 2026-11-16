/**
 * Кнопка «Редактировать» в нижней панели карты.
 *
 * Появляется только когда заметка выбрана; открывает панель сразу на её
 * свойствах. Разметку кнопки держим здесь, чтобы перерисовка нативных
 * контролов карты не уносила её с собой.
 */
import { markNmapOwned } from '@/lib/go_to/ownership'
import { parseStaticSvg } from '@/lib/parse_static_svg'

export const NOTES_EDIT_BUTTON_ID = 'nmap-notes-edit-button'
export const NOTES_EDIT_BUTTON_WRAPPER_ID = 'nmap-notes-edit-button-wrapper'
export const BOTTOM_CONTROLS_SELECTOR = '.nk-map-bottom-controls-view'

export const NOTES_EDIT_BUTTON_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 6.5 17.5 10" stroke="currentColor" stroke-width="2"/></svg>'

const BUTTON_CLASS =
  'nk-button nk-button_theme_air nk-button_size_m nk-button_view_dark nmap-notes-edit-button'

export const findBottomControls = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(BOTTOM_CONTROLS_SELECTOR)

export const createNotesEditButton = ({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = NOTES_EDIT_BUTTON_ID
  button.className = BUTTON_CLASS
  button.setAttribute('aria-label', label)
  button.title = label

  const icon = document.createElement('span')
  icon.className = 'nmap-notes-edit-button__icon'
  icon.appendChild(parseStaticSvg(NOTES_EDIT_BUTTON_ICON_SVG))

  const text = document.createElement('span')
  text.className = 'nmap-notes-edit-button__text'
  text.textContent = label

  button.append(icon, text)
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })

  return markNmapOwned(button)
}

/**
 * Ставит кнопку в нижние контролы карты.
 *
 * Возвращает `true`, если кнопку пришлось переставить: нативные контролы
 * перерисовываются, и вызывающий код по этому признаку понимает, что пора
 * проверить разметку ещё раз.
 */
export const ensureNotesEditButton = ({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}): HTMLElement | null => {
  const controls = findBottomControls()
  if (!controls) return null

  let wrapper = controls.querySelector<HTMLElement>(`#${NOTES_EDIT_BUTTON_WRAPPER_ID}`)
  if (!wrapper) {
    wrapper = document.createElement('div')
    wrapper.id = NOTES_EDIT_BUTTON_WRAPPER_ID
    wrapper.className = 'nmap-notes-edit-button-wrapper'
    controls.appendChild(wrapper)
  }

  let button = wrapper.querySelector<HTMLButtonElement>(`#${NOTES_EDIT_BUTTON_ID}`)
  if (!button) {
    button = createNotesEditButton({ label, onClick })
    wrapper.appendChild(button)
  } else {
    const text = button.querySelector<HTMLElement>('.nmap-notes-edit-button__text')
    if (text && text.textContent !== label) text.textContent = label
  }

  return wrapper
}

/**
 * Убирает кнопку из нижних контролов.
 *
 * Прятать через `display: none` недостаточно: пустой блок остаётся в разметке
 * карты и виден как артефакт после закрытия панели или снятия выбора.
 */
export const removeNotesEditButton = (): void => {
  document.getElementById(NOTES_EDIT_BUTTON_WRAPPER_ID)?.remove()
}
