import { resetCanvasPointCounter } from './canvas_patch'
import { resetSystemRemainingCache } from './system_banner'

/**
 * Проверяет, является ли кнопка действием Undo (отмена последней операции на тулбаре карты).
 */
export const isUndoToolbarAction = (target: HTMLElement | null): boolean => {
  if (!target) return false
  const buttonEl = (target.closest('button, .nk-button, [role="button"]') || target) as HTMLElement

  const inToolbar = Boolean(buttonEl.closest('[class*="on-map-toolbar"], .nk-on-map-toolbar'))
  if (!inToolbar) return false

  const classNames = `${buttonEl.className} ${target.className}`.toLowerCase()
  const title = (buttonEl.getAttribute('title') || target.getAttribute('title') || '').toLowerCase()
  const ariaLabel = (
    buttonEl.getAttribute('aria-label') ||
    target.getAttribute('aria-label') ||
    ''
  ).toLowerCase()

  return (
    classNames.includes('undo') ||
    classNames.includes('nk-icon_id_undo') ||
    title.includes('отменить') ||
    title.includes('undo') ||
    ariaLabel.includes('отменить') ||
    ariaLabel.includes('undo')
  )
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

  const text = (buttonEl.textContent || target.textContent || '').trim().toLowerCase()
  const title = (buttonEl.getAttribute('title') || target.getAttribute('title') || '').toLowerCase()
  const ariaLabel = (
    buttonEl.getAttribute('aria-label') ||
    target.getAttribute('aria-label') ||
    ''
  ).toLowerCase()
  const classNames = `${buttonEl.className} ${target.className}`.toLowerCase()

  // Действия инструментов модификации геометрии не должны сбрасывать счетчик
  const isGeometryToolAction =
    text.includes('скруглить') ||
    text.includes('выпрямить') ||
    text.includes('сгладить') ||
    text.includes('упростить') ||
    text.includes('разредить') ||
    text.includes('round') ||
    text.includes('smooth') ||
    text.includes('straighten') ||
    title.includes('скруглить') ||
    title.includes('выпрямить') ||
    title.includes('сгладить') ||
    title.includes('упростить') ||
    title.includes('разредить') ||
    title.includes('round') ||
    title.includes('smooth') ||
    title.includes('straighten') ||
    ariaLabel.includes('скруглить') ||
    ariaLabel.includes('выпрямить') ||
    ariaLabel.includes('сгладить') ||
    ariaLabel.includes('упростить') ||
    ariaLabel.includes('разредить') ||
    ariaLabel.includes('round') ||
    ariaLabel.includes('smooth') ||
    ariaLabel.includes('straighten') ||
    classNames.includes('round') ||
    classNames.includes('smooth')

  if (isGeometryToolAction) {
    return false
  }

  const isSaveOrCompleteAction =
    text.includes('сохранить') ||
    text.includes('отменить') ||
    text.includes('готово') ||
    text.includes('завершить') ||
    title.includes('сохранить') ||
    title.includes('отменить') ||
    title.includes('готово') ||
    title.includes('завершить') ||
    text.includes('save') ||
    text.includes('cancel') ||
    text.includes('done') ||
    text.includes('finish')

  const isRedrawAction =
    text.includes('перерисовать') ||
    text.includes('redraw') ||
    title.includes('перерисовать') ||
    title.includes('redraw') ||
    ariaLabel.includes('перерисовать') ||
    ariaLabel.includes('redraw') ||
    classNames.includes('redraw') ||
    classNames.includes('перерисов') ||
    Boolean(
      buttonEl.querySelector?.(
        '[class*="redraw" i], [class*="перерисов" i], [title*="перерисов" i]',
      ),
    )

  return isRedrawAction || isSaveOrCompleteAction
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
    if (e.key === 'Enter' || e.key === 'Escape') {
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
