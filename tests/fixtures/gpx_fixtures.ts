import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import JSZip from 'jszip'

const fixturesDir = resolve(import.meta.dirname)

/** Читает GPX-фикстуру как UTF-8 текст. */
export const readGpxFixture = (name: string): string =>
  readFileSync(resolve(fixturesDir, name), 'utf-8')

/** Читает GPX-фикстуру как ArrayBuffer. */
export const readGpxFixtureBuffer = (name: string): ArrayBuffer => {
  const bytes = readFileSync(resolve(fixturesDir, name))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

/** Упаковывает GPX в ZIP для тестов загрузки. */
export const createGpxZipBuffer = async (
  gpxName: string,
  content: string,
): Promise<ArrayBuffer> => {
  const zip = new JSZip()
  zip.file(gpxName, content)
  return zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' })
}
