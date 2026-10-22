import { FEEDS_FILTER_POPUP_ID, FEEDS_FILTER_SELECT_ID } from './constants'

/**
 * Проверяет, является ли кандидат допустимым целевым селектом Народной карты,
 * рядом с которым можно разместить дропдаун фильтра статусов.
 */
export const isValidTargetSelect = (
  candidate: Element | null,
  dropdownElement?: HTMLElement | null,
): candidate is HTMLElement => {
  if (!candidate || !(candidate instanceof HTMLElement)) {
    return false
  }

  // Не может быть собственным элементом фильтра или его попапом
  if (candidate.id === FEEDS_FILTER_SELECT_ID || candidate.id === FEEDS_FILTER_POPUP_ID) {
    return false
  }

  // Не может быть частью/потомком нашего фильтра статусов
  if (
    candidate.closest(
      `#${FEEDS_FILTER_SELECT_ID}, #${FEEDS_FILTER_POPUP_ID}, .nmap-feeds-status-select, .nmap-feeds-status-popup`,
    )
  ) {
    return false
  }

  // Не может быть тем же элементом, предком или потомком переданного dropdownElement
  if (
    dropdownElement &&
    (dropdownElement === candidate ||
      dropdownElement.contains(candidate) ||
      candidate.contains(dropdownElement))
  ) {
    return false
  }

  // Не должен находиться внутри тулбара редактора, панели пользователя или кнопок управления
  if (
    candidate.closest(
      '.nk-user-feeds-control-view, .nk-toolbar-view, [class*="toolbar-view"], [class*="user-bar-view"], button:not(.nk-select), [class*="control-view"]:not([class*="feed"])',
    )
  ) {
    return false
  }

  // Исключаем внутренние элементы БЭМ
  if (
    candidate.classList.contains('nk-select__button') ||
    candidate.classList.contains('nk-select__text') ||
    candidate.classList.contains('nk-select__tick') ||
    candidate.classList.contains('nk-select__menu')
  ) {
    return false
  }

  const classList = Array.from(candidate.classList)
  const isSelect =
    classList.some(
      (cls) => cls === 'nk-select' || cls.startsWith('nk-select_') || cls.includes('select'),
    ) && !classList.some((cls) => cls.startsWith('nk-select__'))

  return isSelect
}

/**
 * Проверяет, выбран ли в целевом селекте режим "Правки".
 */
export const isEditsModeSelected = (targetSelect?: HTMLElement | null): boolean => {
  if (!targetSelect || !(targetSelect instanceof HTMLElement)) {
    return false
  }

  if (
    targetSelect.id === FEEDS_FILTER_SELECT_ID ||
    targetSelect.classList.contains('nmap-feeds-status-select') ||
    targetSelect.closest(`#${FEEDS_FILTER_SELECT_ID}`)
  ) {
    return false
  }

  const textElement =
    targetSelect.querySelector<HTMLElement>('.nk-button__text, .nk-select__text') ||
    targetSelect.querySelector<HTMLElement>('button') ||
    targetSelect

  const rawText = (textElement.textContent || '').trim().toLowerCase()
  if (!rawText) {
    return false
  }

  return rawText.includes('правк') || rawText.includes('edit')
}
