/**
 * Обработчики событий пользовательского ввода (клавиатура, мышь) для сброса счетчика точек.
 */
export const attachCounterResetListeners = (onReset: () => void): (() => void) => {
  if (typeof document === 'undefined') return () => {}

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      onReset()
    }
  }

  const onDblClick = () => {
    onReset()
  }

  const onMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return

    const isSidebar = target.closest('.nk-sidebar-view')
    const isButton = target.closest('button') || target.closest('.nk-button')
    const text = target.textContent?.toLowerCase() || ''
    const isSaveAction =
      text.includes('сохранить') || text.includes('отменить') || text.includes('готово')

    if (isSidebar || isButton || isSaveAction) {
      onReset()
    }
  }

  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('dblclick', onDblClick)
  document.addEventListener('mousedown', onMouseDown)

  return () => {
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('dblclick', onDblClick)
    document.removeEventListener('mousedown', onMouseDown)
  }
}
