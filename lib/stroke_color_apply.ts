import { isMapTabUrl } from '@/lib/map_tab'
import { applyStrokeColorViaWindow, ensureStrokeRecolorEngine } from '@/lib/stroke_recolor_engine'

export const isMapPageContext = (): boolean =>
  typeof window !== 'undefined' && isMapTabUrl(window.location.href)

/** Немедленно применяет цвет контура на текущей вкладке карты. */
export const applyStrokeColorOnMapPage = (color: string): void => {
  if (!isMapPageContext()) return

  ensureStrokeRecolorEngine()
  applyStrokeColorViaWindow(color)
}
