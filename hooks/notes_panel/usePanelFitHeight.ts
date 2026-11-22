import { useEffect } from 'react'
import { NOTES_PANEL_FIT_HEIGHT_MESSAGE } from '@/lib/notes_panel/host'

const postFitHeight = (height: number | null): void => {
  window.parent?.postMessage({ action: NOTES_PANEL_FIT_HEIGHT_MESSAGE, height }, '*')
}

/**
 * Высота панели, при которой карточка свойств видна целиком.
 *
 * Сетка карточки — собственная высота содержимого: она не растягивается на
 * контейнер, поэтому её нижняя кромка даёт настоящую высоту карточки даже
 * тогда, когда панель выше или ниже неё. К ней прибавляются внутренний отступ
 * снизу и шапка панели, которая живёт вне прокручиваемой области.
 */
const measurePropertiesHeight = (): number | null => {
  const head = document.querySelector<HTMLElement>('.notes-panel__head')
  const properties = document.querySelector<HTMLElement>('.notes-panel__properties')
  const grid = properties?.querySelector<HTMLElement>('.notes-panel__properties-grid')
  if (!head || !properties || !grid) return null

  const paddingBottom = Number.parseFloat(getComputedStyle(properties).paddingBottom) || 0
  const contentBottom = grid.getBoundingClientRect().bottom - properties.getBoundingClientRect().top

  return Math.ceil(head.getBoundingClientRect().height + contentBottom + paddingBottom)
}

/**
 * Просит хост подогнать высоту панели под карточку свойств.
 *
 * Без этого «Редактировать» открывала карточку в четверть экрана, и нижние
 * блоки (границы, иконки) оставались под прокруткой. На списке запрос
 * снимается: там своя высота, выбранная пользователем.
 *
 * Пересчёт идёт по изменению высоты сетки, а не окна: протяжка ручки меняет
 * высоту iframe, и реакция на `resize` возвращала бы панель обратно, споря с
 * пользователем.
 */
export const usePanelFitHeight = (mode: 'list' | 'properties', noteId: string | null): void => {
  useEffect(() => {
    if (mode !== 'properties' || !noteId) {
      postFitHeight(null)
      return
    }

    let frame = 0
    const post = (): void => {
      const height = measurePropertiesHeight()
      if (height !== null) postFitHeight(height)
    }

    post()

    const grid = document.querySelector<HTMLElement>('.notes-panel__properties-grid')
    if (!grid) return

    // Содержимое меняет высоту: появилась группа, выбран вид с узором,
    // пользователь потянул описание. Панель должна успевать за ним.
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(post)
    })
    observer.observe(grid)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [mode, noteId])
}
