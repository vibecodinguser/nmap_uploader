/** Поддерживаемые расширения (как в nmaputils_website). */
export const ALLOWED_EXTENSIONS = new Set([
  'zip',
  'geojson',
  'gpx',
  'kml',
  'kmz',
  'topojson',
  'wkt',
]);

export const ACCEPTED_FORMATS = '.zip,.gpx,.kml,.kmz,.geojson,.topojson,.wkt';

export const getFileExtension = (filename: string): string => {
  const dotIndex = filename.lastIndexOf('.');
  let extension = '';
  if (dotIndex !== -1) {
    extension = filename.slice(dotIndex + 1);
    extension = extension.toLowerCase();
  }
  return extension;
};

export const isAllowedFile = (filename: string): boolean => {
  const extension = getFileExtension(filename);
  return ALLOWED_EXTENSIONS.has(extension);
};