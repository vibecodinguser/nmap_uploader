/**
 * Преобразование кликов по оверлею в географические координаты Народной карты.
 */
import { projectScreenClickToLatLon } from '@/lib/nmaps/projection'

export const getCoordsFromUrlClick = (
  clientX: number,
  clientY: number,
): [number, number] | null => {
  const hash = globalThis.location.hash
  const paramsStr = hash.split('?')[1]
  if (!paramsStr) return null
  const params = new URLSearchParams(paramsStr)
  const zStr = params.get('z')
  const llStr = params.get('ll')
  if (!zStr || !llStr) return null
  const z = Number.parseFloat(zStr)
  const [lon, lat] = llStr.split(',').map(Number.parseFloat)
  if (Number.isNaN(z) || Number.isNaN(lon) || Number.isNaN(lat)) return null

  let cx = globalThis.innerWidth / 2
  let cy = globalThis.innerHeight / 2

  const crosshair = document.querySelector(
    '.nk-map-crosshair, [class*="crosshair"], .ymaps-map-crosshair',
  )
  if (crosshair) {
    const rect = crosshair.getBoundingClientRect()
    cx = rect.left + rect.width / 2
    cy = rect.top + rect.height / 2
  } else {
    const mapContainer =
      document.querySelector('.nk-map') ||
      document.querySelector('.ymaps-map') ||
      document.querySelector('[class*="map"]')
    if (mapContainer) {
      const rect = mapContainer.getBoundingClientRect()
      cx = rect.left + rect.width / 2
      cy = rect.top + rect.height / 2
    }
  }

  const { lat: outLat, lon: outLon } = projectScreenClickToLatLon(
    clientX,
    clientY,
    cx,
    cy,
    lat,
    lon,
    z,
  )

  return [outLat, outLon]
}
