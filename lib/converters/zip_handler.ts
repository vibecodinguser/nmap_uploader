import JSZip from 'jszip'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'

export type ZipContext = {
  buffer: ArrayBuffer
  fileDesc: string
  zip: JSZip
  entries: string[]
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export const loadZipFromBuffer = async (buffer: ArrayBuffer): Promise<JSZip> => {
  try {
    return await JSZip.loadAsync(buffer)
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    throw new ProcessingError(ERR_SHAPEFILE, `Ошибка чтения ZIP-файла: ${errorMessage}`)
  }
}

export const rethrowZipProcessingError = (error: unknown, prefix: string): never => {
  if (error instanceof ProcessingError) {
    throw error
  }
  const errorMessage = getErrorMessage(error)
  throw new ProcessingError(ERR_SHAPEFILE, `${prefix}: ${errorMessage}`)
}

export const findZipEntry = (entries: string[], pattern: RegExp): string | undefined => {
  let matchedEntry: string | undefined

  for (const name of entries) {
    if (matchedEntry === undefined) {
      const lowerName = name.toLowerCase()
      if (pattern.test(lowerName)) {
        matchedEntry = name
      }
    }
  }

  return matchedEntry
}

export const listZipEntries = (zip: JSZip): string[] => {
  const fileNames = Object.keys(zip.files)
  const entries: string[] = []

  for (const name of fileNames) {
    if (!zip.files[name]?.dir) {
      entries.push(name)
    }
  }

  return entries
}

export const readZipEntryText = async (zip: JSZip, entryName: string): Promise<string> => {
  const zipEntry = zip.file(entryName)
  let text = ''

  if (zipEntry) {
    text = await zipEntry.async('text')
  }

  return text
}

export const textToArrayBuffer = (text: string): ArrayBuffer => {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(text)
  return encoded.buffer
}

export const findGeoJsonZipEntry = (entries: string[]): string | undefined => {
  let geoJsonName = findZipEntry(entries, /\.geojson$/)

  if (geoJsonName === undefined) {
    geoJsonName = findZipEntry(entries, /(^|\/)data\.json$/)
  }

  if (geoJsonName === undefined) {
    for (const name of entries) {
      if (geoJsonName === undefined) {
        const lowerName = name.toLowerCase()
        if (lowerName.endsWith('.json')) {
          geoJsonName = name
        }
      }
    }
  }

  return geoJsonName
}

export const buildZipSample = (entries: string[]): string => {
  const sampleNames: string[] = []
  const limit = Math.min(entries.length, 6)

  for (let index = 0; index < limit; index += 1) {
    const entry = entries[index]
    const parts = entry.split('/')
    const baseName = parts.pop() ?? entry
    sampleNames.push(baseName)
  }

  return sampleNames.join(', ')
}
