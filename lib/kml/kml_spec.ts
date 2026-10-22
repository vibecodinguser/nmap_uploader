import JSZip from 'jszip'
import { getErrorMessage, toProcessingError } from './kml_coords'
import { validateKmlText } from './kml_document_validator'

export * from './kml_coords'
export * from './kml_document_validator'

const listZipEntries = (zip: JSZip): string[] => {
  const fileNames = Object.keys(zip.files)
  const entries: string[] = []

  for (const name of fileNames) {
    const file = zip.files[name]
    if (file && !file.dir) {
      entries.push(name)
    }
  }

  return entries
}

const normalizeKmzEntryName = (name: string): string => name.replace(/\\/g, '/')

const isKmlEntryName = (name: string): boolean => {
  return name.toLowerCase().endsWith('.kml')
}

const normalizeKmzEntries = (entries: string[]): string[] => {
  const normalized: string[] = []

  for (const name of entries) {
    if (!name.startsWith('__MACOSX/')) {
      normalized.push(normalizeKmzEntryName(name))
    }
  }

  return normalized
}

const findMainKmlInNormalizedEntries = (normalized: string[]): string | undefined => {
  let rootKml: string | undefined
  let anyKml: string | undefined

  for (const name of normalized) {
    if (isKmlEntryName(name)) {
      if (anyKml === undefined) {
        anyKml = name
      }
      if (!name.includes('/') && rootKml === undefined) {
        rootKml = name
      }
    }
  }

  return rootKml ?? anyKml
}

/** Выбирает главный KML в KMZ: сначала на корневом уровне (§Annex C). */
export const selectKmzMainKmlEntry = (entries: string[]): string | undefined => {
  const normalized = normalizeKmzEntries(entries)
  return findMainKmlInNormalizedEntries(normalized)
}

/** Читает и валидирует KML или KMZ (OGC 12-007r2, Annex C). */
export const readValidatedKmlFromBuffer = async (buffer: ArrayBuffer): Promise<string> => {
  let isZip = false
  if (buffer.byteLength >= 4) {
    const view = new DataView(buffer)
    isZip = view.getUint32(0, false) === 0x504b0304
  }

  let result = ''

  if (isZip) {
    let zip: JSZip
    try {
      zip = await JSZip.loadAsync(buffer)
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      throw toProcessingError(`Ошибка чтения KMZ (ZIP): ${errorMessage}`)
    }

    const entries = listZipEntries(zip)
    if (entries.length === 0) {
      throw toProcessingError('KMZ-архив пуст')
    }

    const kmlName = selectKmzMainKmlEntry(entries)
    if (kmlName) {
      const zipEntry = zip.file(kmlName)
      if (zipEntry) {
        result = await zipEntry.async('text')
      }
      const trimmedResult = result.trim()
      if (trimmedResult) {
        validateKmlText(result)
      } else {
        throw toProcessingError(`KML-файл "${kmlName}" в KMZ пуст`)
      }
    } else {
      throw toProcessingError('В KMZ-архиве отсутствует KML-файл')
    }
  } else {
    const decoder = new TextDecoder('utf-8')
    result = decoder.decode(buffer)
    validateKmlText(result)
  }

  return result
}
