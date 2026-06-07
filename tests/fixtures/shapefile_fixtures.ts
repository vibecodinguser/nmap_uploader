import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import JSZip from 'jszip'

const fixturesDir = resolve(import.meta.dirname)

/** Читает бинарную фикстуру из tests/fixtures. */
export const readShapefileFixture = (name: string): ArrayBuffer => {
  const bytes = readFileSync(resolve(fixturesDir, name))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

/** Собирает ZIP в памяти для негативных сценариев. */
export const createZipBuffer = async (
  entries: Record<string, string | Uint8Array>,
): Promise<ArrayBuffer> => {
  const zip = new JSZip()
  for (const [name, content] of Object.entries(entries)) {
    zip.file(name, content)
  }
  return zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' })
}
