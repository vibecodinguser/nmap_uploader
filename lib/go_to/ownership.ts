/**
 * Принадлежность DOM-узлов go-to UI нашему расширению.
 *
 * Похожее расширение может создавать узлы с теми же id или классами. Поэтому
 * каждый собственный узел помечается атрибутом при создании, а поиск идёт
 * только по этому маркеру. Атрибут переживает перезапуск content script,
 * WeakSet даёт точную идентичность в пределах текущей сессии.
 */

export const NMAP_OWNED_ATTR = 'data-nmap-uploader-owned'

const ownedElements = new WeakSet<HTMLElement>()

const hasOwnedMarker = (element: Element): boolean =>
  element.getAttribute(NMAP_OWNED_ATTR) === 'true'

/** Помечает созданный нами узел и возвращает его же для цепочек. */
export const markNmapOwned = <T extends HTMLElement>(element: T): T => {
  element.setAttribute(NMAP_OWNED_ATTR, 'true')
  ownedElements.add(element)
  return element
}

/** true, если узел создан нашим расширением. */
export const isNmapOwned = (element: Element | null): element is HTMLElement => {
  if (!(element instanceof HTMLElement)) {
    return false
  }
  return ownedElements.has(element) || hasOwnedMarker(element)
}

/** Первый наш узел с заданным id; чужие узлы с тем же id игнорируются. */
export const getOwnedElementById = (id: string): HTMLElement | null => {
  for (const element of document.querySelectorAll<HTMLElement>(`[id="${id}"]`)) {
    if (isNmapOwned(element)) {
      return element
    }
  }
  return null
}

/** Все наши узлы с заданным id. */
export const queryOwnedElementsById = (id: string): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>(`[id="${id}"]`)).filter(isNmapOwned)

/** Удаляет только наши узлы с заданным id, не трогая чужие. */
export const removeOwnedElementsById = (id: string): void => {
  for (const element of queryOwnedElementsById(id)) {
    element.remove()
  }
}
