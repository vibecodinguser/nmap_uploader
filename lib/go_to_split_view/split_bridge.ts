/**
 * Утилиты для кнопки переключения и отправки сообщений в iframe Nakarte.
 */
import { NAKARTE_ORIGIN } from '@/lib/extension_origins'
import { getMapLocationFromUrl, type MapLocation } from '@/lib/go_to_link'
import {
  NAKARTE_SYNC_MSG_SOURCE,
  NMAP_UPLOADER_MSG_SOURCE,
  normalizeMapLocation,
  type SplitLocationMessage,
} from '@/lib/go_to_map_sync'
import { GO_TO_SPLIT_BUTTON_ID } from '@/lib/go_to_split_button'
import { GO_TO_SPLIT_BUTTON_ACTIVE_CLASS } from '@/lib/go_to_styles'

export const getSplitButton = (): HTMLButtonElement | null =>
  document.getElementById(GO_TO_SPLIT_BUTTON_ID) as HTMLButtonElement | null

export const updateSplitButtonState = (isOpen: boolean): void => {
  const button = getSplitButton()
  if (!button) return

  button.classList.toggle(GO_TO_SPLIT_BUTTON_ACTIVE_CLASS, isOpen)
  button.setAttribute('aria-pressed', String(isOpen))
}

export const postLocationToIframe = (
  iframe: HTMLIFrameElement | null,
  location: MapLocation,
): void => {
  const normalized = normalizeMapLocation(location)
  iframe?.contentWindow?.postMessage(
    {
      source: NMAP_UPLOADER_MSG_SOURCE,
      type: 'set_location',
      location: normalized,
    },
    NAKARTE_ORIGIN,
  )
}

export const wrapHistoryMethod = (
  method: 'pushState' | 'replaceState',
  onChange: () => void,
): (() => void) => {
  const original = history[method].bind(history) as History['pushState']

  history[method] = ((...args: Parameters<History['pushState']>) => {
    original(...args)
    onChange()
  }) as History['pushState']

  return () => {
    history[method] = original
  }
}

export const readNmapsLocation = (): MapLocation | null =>
  getMapLocationFromUrl(window.location.href)

export type { SplitLocationMessage }
export { NAKARTE_SYNC_MSG_SOURCE }
