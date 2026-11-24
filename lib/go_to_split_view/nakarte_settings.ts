import { browser } from 'wxt/browser'
import { getNakarteSettingsFromHash } from '@/lib/go_to_map_sync'

export const NAKARTE_SPLIT_VIEW_SETTINGS_STORAGE_KEY = 'nakarte_split_view_settings'

/** Читает сохранённые настройки Nakarte (слои, треки, метки) без положения карты. */
export const getStoredNakarteViewSettings = async (): Promise<string> => {
  try {
    const stored = await browser.storage.local.get(NAKARTE_SPLIT_VIEW_SETTINGS_STORAGE_KEY)
    const value = stored[NAKARTE_SPLIT_VIEW_SETTINGS_STORAGE_KEY]
    return typeof value === 'string' ? getNakarteSettingsFromHash(value) : ''
  } catch (error) {
    console.warn('[yamapper] nakarte settings read failed:', error)
    return ''
  }
}

/** Сохраняет настройки Nakarte из hash, отбрасывая положение карты. */
export const saveNakarteViewSettings = async (hash: string): Promise<void> => {
  const settings = getNakarteSettingsFromHash(hash)
  try {
    await browser.storage.local.set({ [NAKARTE_SPLIT_VIEW_SETTINGS_STORAGE_KEY]: settings })
  } catch (error) {
    console.warn('[yamapper] nakarte settings save failed:', error)
  }
}
