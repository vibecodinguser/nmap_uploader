import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import JSZip from 'jszip'

const fixturesDir = resolve(import.meta.dirname)

export const readTopoJsonFixture = (name: string): string =>
  readFileSync(resolve(fixturesDir, name), 'utf-8')

export const readTopoJsonFixtureBuffer = (name: string): ArrayBuffer => {
  const bytes = readFileSync(resolve(fixturesDir, name))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

export const createTopoJsonZipBuffer = async (
  topoJsonName: string,
  content: string,
): Promise<ArrayBuffer> => {
  const zip = new JSZip()
  zip.file(topoJsonName, content)
  return zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' })
}
