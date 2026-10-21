import { type BinaryPayload, normalizeBinaryBuffer } from '@/lib/binary_buffer'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import { getFileExtension } from '@/lib/formats'
import type { ProcessResult } from '@/lib/nmap_index'
import {
  type ConverterInput,
  processGeoJsonFile,
  processGpx,
  processKml,
  processTopoJson,
  processWkt,
  processZip,
} from './format_processors'

export type { GeoConvertError, GeoConvertResult, ProcessGeoFileInput } from '@/lib/geo_converters'
export { processGeoFile } from '@/lib/geo_converters'
export * from './format_processors'
export { processGeoJsonData } from './geojson'
export * from './zip_handler'

type FileProcessor = (input: ConverterInput) => Promise<ProcessResult>

const extensionProcessors: Record<string, FileProcessor> = {
  zip: processZip,
  gpx: processGpx,
  kml: processKml,
  kmz: processKml,
  geojson: processGeoJsonFile,
  topojson: processTopoJson,
  wkt: processWkt,
}

export type UploadFileInput = {
  name: string
  buffer: ArrayBuffer | BinaryPayload
}

/** Универсальная точка входа: выбор обработчика по расширению. */
export const processFile = async ({ name, buffer }: UploadFileInput): Promise<ProcessResult> => {
  const normalizedBuffer = normalizeBinaryBuffer(buffer)
  const extension = getFileExtension(name)
  const nameParts = name.split('/')
  const fileDesc = nameParts.pop() ?? name
  const processor = extensionProcessors[extension]
  if (processor === undefined) {
    throw new ProcessingError(ERR_SHAPEFILE, `Неподдерживаемый тип файла: .${extension}`)
  }

  return processor({ buffer: normalizedBuffer, fileDesc })
}
