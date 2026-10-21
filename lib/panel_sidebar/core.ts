/**
 * Вычисляет приближенный zoom карты по bounding box с учетом боковой панели.
 */
export const calculateZoomFromBbox = (
  bbox: number[],
  windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1280,
  windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800,
  panelWidth = 425,
): number => {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const width = windowWidth - panelWidth - 40 // 40 margin
  const height = windowHeight - 80 // 80 margin

  let zoomX = 18
  let zoomY = 18

  if (width > 0 && height > 0) {
    const lonDiff = maxLon - minLon
    if (lonDiff > 0) {
      zoomX = Math.log2((width * 360) / (256 * lonDiff))
    }

    const latToMercatorY = (l: number) => {
      const rad = (l * Math.PI) / 180
      return Math.log(Math.tan(Math.PI / 4 + rad / 2))
    }
    const yDiff = Math.abs(latToMercatorY(maxLat) - latToMercatorY(minLat))
    if (yDiff > 0) {
      zoomY = Math.log2((height * 2 * Math.PI) / (256 * yDiff))
    }

    const rawZoom = Math.min(zoomX, zoomY, 18)
    return Math.max(Math.floor(rawZoom) - 1, 2)
  }
  return 18
}

/**
 * Парсит сообщение центрирования карты и возвращает координаты и зум.
 */
export interface CenterMapParams {
  latitude: number
  longitude: number
  zoom: number
}

export const parseCenterMapMessage = (
  message: Record<string, unknown>,
  windowWidth?: number,
  windowHeight?: number,
): CenterMapParams | null => {
  const lat = Number(message.latitude)
  const lon = Number(message.longitude)
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return null
  }

  let zoom = typeof message.zoom === 'number' ? message.zoom : 18

  if (Array.isArray(message.bbox) && message.bbox.length === 4) {
    zoom = calculateZoomFromBbox(message.bbox as number[], windowWidth, windowHeight)
  }

  return { latitude: lat, longitude: lon, zoom }
}
