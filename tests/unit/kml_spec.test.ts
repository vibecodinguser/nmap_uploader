import { describe, expect, it } from 'vitest'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import {
  KML_NAMESPACE,
  parseKmlCoordinateTuples,
  selectKmzMainKmlEntry,
  validateKmlDocument,
  validateKmlText,
} from '@/lib/kml/kml_spec'
import { parseXmlDocument } from '@/lib/xml/parse_xml'
import { createKmzBuffer, readKmlFixture } from '../fixtures/kml_fixtures'

const expectKmlError = (run: () => void, messageIncludes: string): void => {
  try {
    run()
    expect.fail('Ожидалась ProcessingError')
  } catch (error) {
    expect(error).toBeInstanceOf(ProcessingError)
    expect((error as ProcessingError).code).toBe(ERR_SHAPEFILE)
    expect((error as ProcessingError).message).toContain(messageIncludes)
  }
}

describe('OGC KML 12-007r2: корневой элемент', () => {
  it('требует <kml> с xmlns 2.2 и дочерним Document', () => {
    const doc = validateKmlText(readKmlFixture('point.kml'))
    const root = doc.documentElement

    expect(root.getAttribute('xmlns')).toBe(KML_NAMESPACE)
    expect(root.getAttribute('version')).toBe('2.2.0')
  })

  it('отклоняет KML без геометрии', () => {
    expectKmlError(
      () => validateKmlText(readKmlFixture('metadata_only.kml')),
      'не содержит геометрии',
    )
  })

  it('отклоняет неверный xmlns', () => {
    const broken = readKmlFixture('point.kml').replace(KML_NAMESPACE, 'http://example.com/kml/1.0')
    expectKmlError(() => validateKmlText(broken), 'Некорректный xmlns KML')
  })

  it('отклоняет пустой корневой kml без дочерних элементов', () => {
    const broken = `<?xml version="1.0"?><kml xmlns="${KML_NAMESPACE}"></kml>`
    expectKmlError(() => validateKmlText(broken), 'должен содержать Document')
  })
})

describe('OGC KML 12-007r2: coordinates', () => {
  it('парсит кортежи lon,lat[,alt] (§10.3)', () => {
    const tuples = parseKmlCoordinateTuples('37.6176,55.7558,0 -80,30,500000', '<coordinates>')
    expect(tuples).toEqual([
      [37.6176, 55.7558],
      [-80, 30],
    ])
  })

  it('отклоняет lon=180', () => {
    expectKmlError(
      () => parseKmlCoordinateTuples('180,55', '<coordinates>'),
      'вне диапазона [-180, 180)',
    )
  })

  it('отклоняет lat=95', () => {
    expectKmlError(
      () => parseKmlCoordinateTuples('37,95', '<coordinates>'),
      'вне диапазона [-90, 90]',
    )
  })

  it('line.kml и polygon.kml проходят валидацию', () => {
    expect(() => validateKmlText(readKmlFixture('line.kml'))).not.toThrow()
    expect(() => validateKmlText(readKmlFixture('polygon.kml'))).not.toThrow()
  })
})

describe('OGC KML 12-007r2: KMZ (Annex C)', () => {
  it('выбирает doc.kml на корневом уровне', () => {
    expect(selectKmzMainKmlEntry(['doc.kml', 'files/icon.png'])).toBe('doc.kml')
    expect(selectKmzMainKmlEntry(['nested/other.kml', 'doc.kml'])).toBe('doc.kml')
  })

  it('KMZ с doc.kml проходит readValidatedKmlFromBuffer', async () => {
    const { readValidatedKmlFromBuffer } = await import('@/lib/kml/kml_spec')
    const buffer = await createKmzBuffer('doc.kml', readKmlFixture('point.kml'))
    const text = await readValidatedKmlFromBuffer(buffer)
    expect(text).toContain('<Placemark>')
    expect(() => validateKmlDocument(parseXmlDocument(text))).not.toThrow()
  })
})
