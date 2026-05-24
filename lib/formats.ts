/** Поддерживаемые расширения (как в nmaputils_website). */
export const ALLOWED_EXTENSIONS = new Set([
  'zip',
  'geojson',
  'gpx',
  'kml',
  'kmz',
  'topojson',
  'wkt',
])

export const ACCEPTED_FORMATS = '.zip,.gpx,.kml,.kmz,.geojson,.topojson,.wkt'

export const getFileExtension = (filename: string): string => {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex === -1) return ''
  return filename.slice(dotIndex + 1).toLowerCase()
}

export const isAllowedFile = (filename: string): boolean =>
  ALLOWED_EXTENSIONS.has(getFileExtension(filename))
