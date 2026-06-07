import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import {
  GPX_VERSION,
  getGpxElementsByLocalName,
  isValidGpxLatitude,
  isValidGpxLongitude,
  parseGpxCoordinate,
  validateGpxDocument,
  validateGpxText,
} from '@/lib/gpx/gpx_spec'
import { readGpxFixture } from '../fixtures/gpx_fixtures'

const fixturesDir = resolve(import.meta.dirname, '../fixtures')

const expectGpxError = (run: () => void, messageIncludes: string): void => {
  try {
    run()
    expect.fail('Ожидалась ProcessingError')
  } catch (error) {
    expect(error).toBeInstanceOf(ProcessingError)
    expect((error as ProcessingError).code).toBe(ERR_SHAPEFILE)
    expect((error as ProcessingError).message).toContain(messageIncludes)
  }
}

describe('GPX 1.1 spec: типы координат', () => {
  it('latitudeType: [-90, 90]', () => {
    expect(isValidGpxLatitude(-90)).toBe(true)
    expect(isValidGpxLatitude(90)).toBe(true)
    expect(isValidGpxLatitude(-90.1)).toBe(false)
    expect(isValidGpxLatitude(90.1)).toBe(false)
  })

  it('longitudeType: [-180, 180)', () => {
    expect(isValidGpxLongitude(-180)).toBe(true)
    expect(isValidGpxLongitude(179.999)).toBe(true)
    expect(isValidGpxLongitude(180)).toBe(false)
    expect(isValidGpxLongitude(-180.1)).toBe(false)
  })

  it('parseGpxCoordinate отклоняет lon=180', () => {
    expectGpxError(
      () => parseGpxCoordinate({ raw: '180', kind: 'lon', context: '<wpt>' }),
      'вне диапазона [-180, 180)',
    )
  })
})

describe('GPX 1.1 spec: корневой элемент gpx', () => {
  it('требует version="1.1" и creator', () => {
    const doc = validateGpxText(readGpxFixture('point.gpx'))
    const root = doc.documentElement

    expect(root.getAttribute('version')).toBe(GPX_VERSION)
    expect(root.getAttribute('creator')).toBe('nmap_uploader_test')
  })

  it('отклоняет отсутствие creator', () => {
    const broken = readGpxFixture('point.gpx').replace('creator="nmap_uploader_test"', '')
    expectGpxError(() => validateGpxText(broken), 'creator обязателен')
  })

  it('отклоняет version 1.0', () => {
    const broken = readGpxFixture('point.gpx').replace('version="1.1"', 'version="1.0"')
    expectGpxError(() => validateGpxText(broken), `Версия GPX должна быть ${GPX_VERSION}`)
  })

  it('отклоняет файл только с metadata', () => {
    expectGpxError(
      () => validateGpxText(readGpxFixture('metadata_only.gpx')),
      'не содержит waypoints',
    )
  })
})

describe('GPX 1.1 spec: wpt/rtept/trkpt', () => {
  it('валидирует waypoint с namespace', () => {
    const doc = validateGpxText(readGpxFixture('point.gpx'))
    const waypoints = getGpxElementsByLocalName(doc.documentElement, 'wpt')
    expect(waypoints).toHaveLength(1)
    expect(waypoints[0]?.getAttribute('lat')).toBe('55.7558')
    expect(waypoints[0]?.getAttribute('lon')).toBe('37.6176')
  })

  it('валидирует track points', () => {
    expect(() => validateGpxText(readGpxFixture('track.gpx'))).not.toThrow()
    const doc = validateGpxText(readGpxFixture('track.gpx'))
    expect(getGpxElementsByLocalName(doc.documentElement, 'trkpt')).toHaveLength(3)
  })

  it('валидирует route points', () => {
    expect(() => validateGpxText(readGpxFixture('route.gpx'))).not.toThrow()
  })

  it('отклоняет wpt без lat', () => {
    const broken = readGpxFixture('point.gpx').replace('lat="55.7558"', '')
    expectGpxError(() => validateGpxText(broken), 'отсутствует обязательный атрибут lat')
  })

  it('отклоняет недопустимый fix', () => {
    const broken = readGpxFixture('point.gpx').replace(
      '<wpt lat="55.7558" lon="37.6176">',
      '<wpt lat="55.7558" lon="37.6176" fix="invalid">',
    )
    expectGpxError(() => validateGpxText(broken), 'fix="invalid" недопустим')
  })
})

describe('GPX 1.1 spec: bounds', () => {
  it('валидирует bounds в metadata', () => {
    const withBounds = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <bounds minlat="55.0" minlon="37.0" maxlat="56.0" maxlon="38.0"/>
  </metadata>
  <wpt lat="55.5" lon="37.5"/>
</gpx>`
    expect(() => validateGpxText(withBounds)).not.toThrow()
  })

  it('отклоняет bounds с lon=180', () => {
    const broken = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <bounds minlat="55.0" minlon="37.0" maxlat="56.0" maxlon="180"/>
  </metadata>
  <wpt lat="55.5" lon="37.5"/>
</gpx>`
    expectGpxError(() => validateGpxText(broken), 'вне диапазона [-180, 180)')
  })
})

describe('GPX 1.1 spec: все фикстуры', () => {
  const compliant = ['point.gpx', 'track.gpx', 'route.gpx'] as const

  it.each(compliant)('%s соответствует GPX 1.1', (name) => {
    const doc = new DOMParser().parseFromString(
      readFileSync(resolve(fixturesDir, name), 'utf-8'),
      'text/xml',
    )
    expect(() => validateGpxDocument(doc)).not.toThrow()
  })
})
