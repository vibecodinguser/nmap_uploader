import { browser } from 'wxt/browser'
import { getMapLocationFromUrl } from '@/lib/go_to_link'
import { wgs84ToMercator } from '@/lib/nspd/coordinates'
import { parseStaticSvg } from '@/lib/parse_static_svg'

export const NSPD_BUTTON_ID = 'nspdButton'
export const NSPD_BUTTON_ENABLED_STORAGE_KEY = 'nspd_button_enabled'

/** Иконка кадастрового участка (НСПД). */
export const NSPD_BUTTON_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 3v15M15 6v15" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 10h4v4h-4z" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="1.5"/></svg>'

const NSPD_BUTTON_CLASS =
  'nmap-uploader-goto-btn nmap-uploader-nspd-btn nk-button nk-button_type_link nk-button_theme_air nk-button_size_xl nk-button_view_dark nk-map-region-view__button nk-map-region-view__button_id_goto'

export const createNspdButton = (ariaLabel = ''): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = NSPD_BUTTON_ID
  button.setAttribute('aria-expanded', 'false')
  if (ariaLabel) {
    button.setAttribute('aria-label', ariaLabel)
  }
  button.className = NSPD_BUTTON_CLASS

  const iconHost = document.createElement('span')
  iconHost.className = 'nk-icon nk-icon_align_auto nmap-uploader-goto-icon'
  iconHost.appendChild(parseStaticSvg(NSPD_BUTTON_ICON_SVG))
  button.appendChild(iconHost)
  return button
}

/** Формирует URL перехода на nspd.gov.ru с текущими координатами и приближением. */
export const buildNspdMapUrl = (href: string): string | null => {
  const location = getMapLocationFromUrl(href)
  if (!location) return null

  const [coordinateX, coordinateY] = wgs84ToMercator(location.longitude, location.latitude)
  const zoom = location.zoom

  const params = new URLSearchParams({
    thematic: 'PKK',
    coordinate_x: coordinateX.toFixed(7),
    coordinate_y: coordinateY.toFixed(7),
    zoom: String(zoom),
    theme_id: '1',
    baseLayerId: '235',
    is_copy_url: 'true',
    active_layers: '875831',
  })

  return `https://nspd.gov.ru/map?${params.toString()}`
}

export const getStoredNspdButtonEnabled = async (): Promise<boolean> => {
  const stored = await browser.storage.local.get(NSPD_BUTTON_ENABLED_STORAGE_KEY)
  const value = stored[NSPD_BUTTON_ENABLED_STORAGE_KEY]
  return value === undefined ? false : Boolean(value)
}

export const setStoredNspdButtonEnabled = async (enabled: boolean): Promise<void> => {
  await browser.storage.local.set({ [NSPD_BUTTON_ENABLED_STORAGE_KEY]: enabled })
}
