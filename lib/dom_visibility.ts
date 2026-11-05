/**
 * Общие проверки DOM-видимости.
 *
 * Панели редактора при закрытии не удаляются, а прячутся. Если считать такой узел
 * «текущим», монтирование уходит в скрытую копию, и интерфейс пропадает до
 * перезагрузки страницы.
 */

/**
 * Проверяет, что элемент реально виден пользователю.
 *
 * Идём по предкам и смотрим `hidden` и `display: none`. Проверка намеренно не по
 * геометрии: `offsetParent` и `getClientRects` зависят от layout, которого может
 * не быть в тестовом окружении.
 */
export const isElementVisible = (element: HTMLElement | null): boolean => {
  if (!element?.isConnected) {
    return false
  }

  let current: HTMLElement | null = element
  while (current && current !== document.documentElement) {
    if (current.hidden) {
      return false
    }

    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      const style = window.getComputedStyle(current)
      if (style.display === 'none') {
        return false
      }
    }

    current = current.parentElement
  }

  return true
}

/** Возвращает первый видимый элемент, иначе первый непустой. */
export const pickVisibleFirst = (
  candidates: readonly (HTMLElement | null)[],
): HTMLElement | null => {
  const list = candidates.filter((item): item is HTMLElement => item !== null)
  return list.find(isElementVisible) ?? list[0] ?? null
}
