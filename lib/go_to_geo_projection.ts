import type { MapLocation } from '@/lib/go_to_link';

const TILE_SIZE = 256;

export type MapViewPixels = {
  width: number;
  height: number;
};

export const lngToPixelX = (lng: number, zoom: number): number =>
  ((lng + 180) / 360) * TILE_SIZE * 2 ** zoom;

export const latToPixelY = (lat: number, zoom: number): number => {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
  return y * TILE_SIZE * 2 ** zoom;
};

export const pixelToLng = (x: number, zoom: number): number =>
  (x / (TILE_SIZE * 2 ** zoom)) * 360 - 180;

export const pixelToLat = (y: number, zoom: number): number => {
  const n = Math.PI - (2 * Math.PI * y) / (TILE_SIZE * 2 ** zoom);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

/** Переводит позицию курсора в географические координаты относительно центра вида. */
export const mouseToLatLng = (
  localX: number,
  localY: number,
  view: MapLocation,
  panel: MapViewPixels,
): MapLocation => {
  const centerX = lngToPixelX(view.longitude, view.zoom);
  const centerY = latToPixelY(view.latitude, view.zoom);
  const worldX = centerX + (localX - panel.width / 2);
  const worldY = centerY + (localY - panel.height / 2);

  return {
    longitude: pixelToLng(worldX, view.zoom),
    latitude: pixelToLat(worldY, view.zoom),
    zoom: view.zoom,
  };
};

/** Переводит географические координаты в локальные пиксели панели карты. */
export const latLngToPanelPixel = (
  location: MapLocation,
  view: MapLocation,
  panel: MapViewPixels,
): { x: number; y: number } | null => {
  let result: { x: number; y: number } | null = null;
  if (Number.isFinite(location.longitude) && Number.isFinite(location.latitude)) {
    const centerX = lngToPixelX(view.longitude, view.zoom);
    const centerY = latToPixelY(view.latitude, view.zoom);
    const pointX = lngToPixelX(location.longitude, view.zoom);
    const pointY = latToPixelY(location.latitude, view.zoom);

    result = {
      x: panel.width / 2 + (pointX - centerX),
      y: panel.height / 2 + (pointY - centerY),
    };
  }
  return result;
};
