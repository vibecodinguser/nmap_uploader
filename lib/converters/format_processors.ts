import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import type { ProcessResult } from '@/lib/nmap_index'
import type { ConverterInput } from './result_merger'
import {
  tryProcessZipGeoJson,
  tryProcessZipGpx,
  tryProcessZipKml,
  tryProcessZipShapefile,
  tryProcessZipTopoJson,
  tryProcessZipWkt,
} from './zip_format_handlers'
import { buildZipSample, listZipEntries, loadZipFromBuffer, type ZipContext } from './zip_handler'

export * from './individual_format_processors'
export * from './result_merger'
export * from './zip_format_handlers'

const zipEntryHandlers: Array<(context: ZipContext) => Promise<ProcessResult | undefined>> = [
  tryProcessZipShapefile,
  tryProcessZipGeoJson,
  tryProcessZipKml,
  tryProcessZipGpx,
  tryProcessZipTopoJson,
  tryProcessZipWkt,
]

const processZipEntries = async (context: ZipContext): Promise<ProcessResult> => {
  let result: ProcessResult | undefined

  for (const handler of zipEntryHandlers) {
    if (result === undefined) {
      result = await handler(context)
    }
  }

  if (result === undefined) {
    const sample = buildZipSample(context.entries)
    throw new ProcessingError(
      ERR_SHAPEFILE,
      `ZIP не содержит поддерживаемых файлов (.shp, .geojson, .kml, .gpx, .topojson, .wkt). Найдено: ${sample}`,
    )
  }

  return result
}

export const processZip = async ({ buffer, fileDesc }: ConverterInput): Promise<ProcessResult> => {
  const zip = await loadZipFromBuffer(buffer)
  const entries = listZipEntries(zip)

  if (entries.length === 0) {
    throw new ProcessingError(ERR_SHAPEFILE, 'ZIP-архив пуст')
  }

  return processZipEntries({ zip, buffer, fileDesc, entries })
}
