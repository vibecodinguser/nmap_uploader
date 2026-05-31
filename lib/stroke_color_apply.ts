import { applyStrokeColorViaWindow, ensureStrokeRecolorEngine } from '@/lib/stroke_recolor_engine'

const MAP_PAGE_PREFIX = 'https://n.maps.yandex.ru'

export const isMapPageContext = (): boolean =>
  typeof window !== 'undefined' && window.location.href.startsWith(MAP_PAGE_PREFIX)

/** Немедленно применяет цвет контура на текущей вкладке карты. */
export const applyStrokeColorOnMapPage = (color: string): void => {
  if (!isMapPageContext()) return

  ensureStrokeRecolorEngine()
  applyStrokeColorViaWindow(color)
}
