/**
 * Чистая математика меркаторских проекций для Народной карты Яндекса.
 */
export const R_EARTH = 6378137
export const E_ECCENTRICITY = 0
export const EQUATOR_CIRCUMFERENCE = 40075016.685578488

export type MercatorPoint = {
  x: number
  y: number
}

export type LatLon = {
  lat: number
  lon: number
}

export const latLonToMercator = (lat: number, lon: number): MercatorPoint => {
  const lonRad = (lon * Math.PI) / 180
  const latRad = (lat * Math.PI) / 180
  const sinLat = Math.sin(latRad)
  const x = R_EARTH * lonRad
  const y =
    R_EARTH *
    Math.log(
      Math.tan(Math.PI / 4 + latRad / 2) *
        ((1 - E_ECCENTRICITY * sinLat) / (1 + E_ECCENTRICITY * sinLat)) ** (E_ECCENTRICITY / 2),
    )
  return { x, y }
}

export const mercatorToLatLon = (x: number, y: number): LatLon => {
  const lon = (x * 180) / (R_EARTH * Math.PI)
  const ts = Math.exp(-y / R_EARTH)
  let phi = Math.PI / 2 - 2 * Math.atan(ts)
  let dphi = 1
  for (let i = 0; i < 15 && dphi > 1e-15; i++) {
    const con = E_ECCENTRICITY * Math.sin(phi)
    const newPhi = Math.PI / 2 - 2 * Math.atan(ts * ((1 - con) / (1 + con)) ** (E_ECCENTRICITY / 2))
    dphi = Math.abs(newPhi - phi)
    phi = newPhi
  }
  const lat = (phi * 180) / Math.PI
  return { lat, lon }
}

export const calculateMetersPerPixel = (zoom: number): number => {
  const worldSize = 256 * 2 ** zoom
  return EQUATOR_CIRCUMFERENCE / worldSize
}

export const projectScreenClickToLatLon = (
  clickX: number,
  clickY: number,
  centerX: number,
  centerY: number,
  centerLat: number,
  centerLon: number,
  zoom: number,
): LatLon => {
  const mpp = calculateMetersPerPixel(zoom)
  const centerMerc = latLonToMercator(centerLat, centerLon)

  const dxPx = clickX - centerX
  const dyPx = clickY - centerY

  const targetX = centerMerc.x + dxPx * mpp
  const targetY = centerMerc.y - dyPx * mpp

  return mercatorToLatLon(targetX, targetY)
}

export const isValidMapView = (center: unknown, zoom: unknown): center is [number, number] => {
  if (!Array.isArray(center) || center.length < 2) return false
  return Number.isFinite(center[0]) && Number.isFinite(center[1]) && Number.isFinite(zoom)
}
