import type { MapLocation } from '@/lib/go_to_link'

const TILE_SIZE = 256

export type MapViewPixels = {
  width: number
  height: number
}

export const lngToPixelX = (lng: number, zoom: number): number =>
  ((lng + 180) / 360) * TILE_SIZE * 2 ** zoom

export const pixelToLng = (x: number, zoom: number): number =>
  (x / (TILE_SIZE * 2 ** zoom)) * 360 - 180

const R = 6378137.0
const EQUATOR = 40075016.685578488

export const latToPixelY = (
  lat: number,
  zoom: number,
  projection: 'spherical' | 'elliptical' = 'spherical',
): number => {
  if (projection === 'elliptical') {
    const e = 0.0818191908426
    const latRad = (lat * Math.PI) / 180
    const sinLat = Math.sin(latRad)
    const y =
      R *
      Math.log(
        Math.tan(Math.PI / 4 + latRad / 2) * ((1 - e * sinLat) / (1 + e * sinLat)) ** (e / 2),
      )
    const worldSize = TILE_SIZE * 2 ** zoom
    const mpp = EQUATOR / worldSize
    return worldSize / 2 - y / mpp
  }

  const sinLat = Math.sin((lat * Math.PI) / 180)
  const y = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)
  return y * TILE_SIZE * 2 ** zoom
}

export const pixelToLat = (
  y: number,
  zoom: number,
  projection: 'spherical' | 'elliptical' = 'spherical',
): number => {
  if (projection === 'elliptical') {
    const e = 0.0818191908426
    const worldSize = TILE_SIZE * 2 ** zoom
    const mpp = EQUATOR / worldSize
    const mercatorY = (worldSize / 2 - y) * mpp

    const ts = Math.exp(-mercatorY / R)
    let phi = Math.PI / 2 - 2 * Math.atan(ts)
    let dphi = 1.0
    for (let i = 0; i < 15 && dphi > 1e-15; i++) {
      const con = e * Math.sin(phi)
      const newPhi = Math.PI / 2 - 2 * Math.atan(ts * ((1 - con) / (1 + con)) ** (e / 2))
      dphi = Math.abs(newPhi - phi)
      phi = newPhi
    }
    return (phi * 180) / Math.PI
  }

  const n = Math.PI - (2 * Math.PI * y) / (TILE_SIZE * 2 ** zoom)
  return (180 / Math.PI) * Math.atan(Math.sinh(n))
}

export const mouseToLatLng = (
  localX: number,
  localY: number,
  view: MapLocation,
  panel: MapViewPixels,
  projection: 'spherical' | 'elliptical' = 'spherical',
): MapLocation => {
  const centerX = lngToPixelX(view.longitude, view.zoom)
  const centerY = latToPixelY(view.latitude, view.zoom, projection)
  const worldX = centerX + (localX - panel.width / 2)
  const worldY = centerY + (localY - panel.height / 2)

  return {
    longitude: pixelToLng(worldX, view.zoom),
    latitude: pixelToLat(worldY, view.zoom, projection),
    zoom: view.zoom,
  }
}

export const latLngToPanelPixel = (
  location: MapLocation,
  view: MapLocation,
  panel: MapViewPixels,
  projection: 'spherical' | 'elliptical' = 'spherical',
): { x: number; y: number } | null => {
  let result: { x: number; y: number } | null = null
  if (Number.isFinite(location.longitude) && Number.isFinite(location.latitude)) {
    const centerX = lngToPixelX(view.longitude, view.zoom)
    const centerY = latToPixelY(view.latitude, view.zoom, projection)
    const pointX = lngToPixelX(location.longitude, view.zoom)
    const pointY = latToPixelY(location.latitude, view.zoom, projection)

    result = {
      x: panel.width / 2 + (pointX - centerX),
      y: panel.height / 2 + (pointY - centerY),
    }
  }
  return result
}
