import { resetCanvasPointCounter } from './canvas_patch'
import { resetSystemRemainingCache } from './system_banner'

const GEOMETRY_TOOL_KEYWORDS = [
  'скруглить',
  'выпрямить',
  'сгладить',
  'упростить',
  'разредить',
  'round',
  'smooth',
  'straighten',
] as const

const SAVE_OR_COMPLETE_KEYWORDS = [
  'сохран',
  'отмен',
  'готов',
  'заверш',
  'закрыт',
  'save',
  'cancel',
  'done',
  'finish',
  'close',
] as const

const REDRAW_KEYWORDS = ['перерисов', 'redraw'] as const

const UNDO_KEYWORDS = ['undo', 'nk-icon_id_undo', 'отменить'] as const

/**
 * Собирает всю текстовую информацию элемента (текст, title, aria-label, class) в нижнем регистре для быстрого поиска.
 */
const getElementSearchText = (buttonEl: HTMLElement, target: HTMLElement): string => {
  const text = buttonEl.textContent || target.textContent || ''
  const title = buttonEl.getAttribute('title') || target.getAttribute('title') || ''
  const ariaLabel = buttonEl.getAttribute('aria-label') || target.getAttribute('aria-label') || ''
  const classNames = `${buttonEl.className} ${target.className}`

  return `${text} ${title} ${ariaLabel} ${classNames}`.toLowerCase()
}

/**
 * Проверяет наличие хотя бы одного ключевого слова в строке.
 */
const matchesAnyKeyword = (text: string, keywords: readonly string[]): boolean =>
  keywords.some((keyword) => text.includes(keyword))

/**
 * Проверяет, является ли кнопка действием Undo (отмена последней операции на тулбаре карты).
 */
export const isUndoToolbarAction = (target: HTMLElement | null): boolean => {
  if (!target) return false
  const buttonEl = (target.closest('button, .nk-button, [role="button"]') || target) as HTMLElement

  const inToolbar = Boolean(buttonEl.closest('[class*="on-map-toolbar"], .nk-on-map-toolbar'))
  if (!inToolbar) return false

  const searchText = getElementSearchText(buttonEl, target)
  return matchesAnyKeyword(searchText, UNDO_KEYWORDS)
}

/**
 * Проверяет, является ли целевой элемент кнопкой сброса/перерисовки/завершения.
 */
export const isCounterResetTarget = (target: HTMLElement | null): boolean => {
  if (!target) return false

  const buttonEl = (target.closest('button, .nk-button, [role="button"]') || target) as HTMLElement

  if (isUndoToolbarAction(target)) {
    return false
  }

  const searchText = getElementSearchText(buttonEl, target)

  // Действия инструментов модификации геометрии не должны сбрасывать счетчик
  if (matchesAnyKeyword(searchText, GEOMETRY_TOOL_KEYWORDS)) {
    return false
  }

  if (matchesAnyKeyword(searchText, SAVE_OR_COMPLETE_KEYWORDS)) {
    return true
  }

  if (matchesAnyKeyword(searchText, REDRAW_KEYWORDS)) {
    return true
  }

  const inSidebar = Boolean(buttonEl.closest('.nk-sidebar-view, .nk-sidebar, [class*="sidebar"]'))
  if (
    inSidebar &&
    (searchText.includes('close') ||
      searchText.includes('cross') ||
      Boolean(
        buttonEl.querySelector(
          '[class*="close"], [class*="cross"], .nk-icon_id_close, .nk-icon_id_cross',
        ),
      ))
  ) {
    return true
  }

  return Boolean(
    buttonEl.querySelector?.('[class*="redraw" i], [class*="перерисов" i], [title*="перерисов" i]'),
  )
}

/**
 * Обработчики событий пользовательского ввода (клавиатура, мышь) для сброса счетчика точек.
 */
export const attachCounterResetListeners = (onReset: () => void): (() => void) => {
  if (typeof document === 'undefined') return () => {}

  const triggerReset = () => {
    onReset()
    resetCanvasPointCounter()
    if (typeof window !== 'undefined') {
      window.postMessage({ action: 'RESET_POINT_COUNTER' }, '*')
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (
      e.key === 'Enter' ||
      e.key === 'Escape' ||
      e.key === 'Esc' ||
      e.code === 'Escape' ||
      e.keyCode === 27
    ) {
      triggerReset()
      return
    }

    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я')
    ) {
      resetSystemRemainingCache()
    }
  }

  const handlePointerOrClick = (e: Event) => {
    const target = e.target as HTMLElement | null
    if (isCounterResetTarget(target)) {
      triggerReset()
      return
    }

    if (isUndoToolbarAction(target)) {
      resetSystemRemainingCache()
    }
  }

  // Используем capture phase, чтобы перехватить нажатия до вызова stopPropagation компонентами nmaps
  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('pointerdown', handlePointerOrClick, true)
  document.addEventListener('mousedown', handlePointerOrClick, true)
  document.addEventListener('click', handlePointerOrClick, true)

  return () => {
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('pointerdown', handlePointerOrClick, true)
    document.removeEventListener('mousedown', handlePointerOrClick, true)
    document.removeEventListener('click', handlePointerOrClick, true)
  }
}
