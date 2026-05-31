import { browser } from 'wxt/browser'
import {
  getEffectiveStrokeColor,
  STROKE_COLOR_STORAGE_KEY,
  toStrokeColorInputValue,
} from '@/lib/stroke_color'

export const getStoredStrokeColorRaw = async (): Promise<string> => {
  const stored = await browser.storage.local.get(STROKE_COLOR_STORAGE_KEY)
  const value = stored[STROKE_COLOR_STORAGE_KEY]
  return typeof value === 'string' ? toStrokeColorInputValue(value) : ''
}

export const setStoredStrokeColorRaw = async (raw: string): Promise<string> => {
  const normalizedRaw = toStrokeColorInputValue(raw)
  await browser.storage.local.set({ [STROKE_COLOR_STORAGE_KEY]: normalizedRaw })
  return getEffectiveStrokeColor(normalizedRaw)
}
