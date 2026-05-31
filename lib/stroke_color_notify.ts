import { browser } from 'wxt/browser'
import { applyStrokeColorOnMapPage, isMapPageContext } from '@/lib/stroke_color_apply'

type NotifyStrokeColorResult = {
  ok: boolean
}

/** Сохраняет цвет на вкладках карты через background и локально на текущей странице. */
export const notifyMapTabsAboutStrokeColor = async (
  color: string,
): Promise<NotifyStrokeColorResult> => {
  applyStrokeColorOnMapPage(color)

  try {
    const response = (await browser.runtime.sendMessage({
      action: 'applyStrokeColor',
      color,
    })) as { ok?: boolean } | undefined

    if (response?.ok !== false) {
      return { ok: true }
    }
  } catch (error: unknown) {
    console.warn('[nmap_uploader] applyStrokeColor notify failed:', error)
  }

  return { ok: isMapPageContext() }
}
