import JSZip from 'jszip'

const FILE_CODE = 9994
const VERSION = 1000
const HEADER_BYTES = 100

type Position = readonly [number, number]

type ShapeRecord =
  | { type: 0; name?: string }
  | { type: 1; point: Position; name?: string }
  | { type: 3 | 5; parts: readonly (readonly Position[])[]; name?: string }
  | { type: 8; points: readonly Position[]; name?: string }

type ShapefileFixture = {
  basename: string
  shapeType: 1 | 3 | 5 | 8
  records: readonly ShapeRecord[]
}

const FIXTURES: Record<string, ShapefileFixture> = {
  'point_shapefile.zip': {
    basename: 'point',
    shapeType: 1,
    records: [{ type: 1, point: [37.6176, 55.7558], name: 'Kreml' }],
  },
  'line_shapefile.zip': {
    basename: 'line',
    shapeType: 3,
    records: [
      {
        type: 3,
        parts: [
          [
            [37.6, 55.75],
            [37.7, 55.8],
          ],
        ],
      },
    ],
  },
  'poly_shapefile.zip': {
    basename: 'poly',
    shapeType: 5,
    records: [
      {
        type: 5,
        parts: [
          [
            [37.6, 55.75],
            [37.7, 55.75],
            [37.7, 55.8],
            [37.6, 55.75],
          ],
        ],
      },
    ],
  },
  'mpoint_shapefile.zip': {
    basename: 'mpoint',
    shapeType: 8,
    records: [
      {
        type: 8,
        points: [
          [37.6, 55.75],
          [37.7, 55.8],
          [37.8, 55.85],
        ],
      },
    ],
  },
  'mixed_shapefile.zip': {
    basename: 'mixed',
    shapeType: 1,
    records: [{ type: 0 }, { type: 1, point: [37.6176, 55.7558] }],
  },
  'pline2_shapefile.zip': {
    basename: 'pline2',
    shapeType: 3,
    records: [
      {
        type: 3,
        parts: [
          [
            [37.6, 55.75],
            [37.65, 55.78],
          ],
          [
            [37.7, 55.8],
            [37.8, 55.85],
          ],
        ],
      },
    ],
  },
  'empty_shapefile.zip': {
    basename: 'empty',
    shapeType: 1,
    records: [],
  },
}

const flattenRecordPoints = (record: ShapeRecord): Position[] => {
  if (record.type === 1) return [record.point]
  if (record.type === 3 || record.type === 5) return record.parts.flat()
  if (record.type === 8) return [...record.points]
  return []
}

const getBounds = (records: readonly ShapeRecord[]): [number, number, number, number] => {
  const points = records.flatMap(flattenRecordPoints)
  if (points.length === 0) return [0, 0, 0, 0]

  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

const writeHeader = (
  view: DataView,
  byteLength: number,
  shapeType: number,
  bounds: readonly number[],
): void => {
  view.setInt32(0, FILE_CODE, false)
  view.setInt32(24, byteLength / 2, false)
  view.setInt32(28, VERSION, true)
  view.setInt32(32, shapeType, true)
  for (let index = 0; index < bounds.length; index += 1) {
    view.setFloat64(36 + index * 8, bounds[index] ?? 0, true)
  }
}

const writeBounds = (view: DataView, offset: number, bounds: readonly number[]): number => {
  for (let index = 0; index < bounds.length; index += 1) {
    view.setFloat64(offset + index * 8, bounds[index] ?? 0, true)
  }
  return offset + 32
}

const writePoints = (view: DataView, offset: number, points: readonly Position[]): number => {
  let nextOffset = offset
  for (const [x, y] of points) {
    view.setFloat64(nextOffset, x, true)
    view.setFloat64(nextOffset + 8, y, true)
    nextOffset += 16
  }
  return nextOffset
}

const createRecordContent = (record: ShapeRecord): Uint8Array => {
  const points = flattenRecordPoints(record)
  const bounds = getBounds([record])
  let byteLength = 4
  if (record.type === 1) byteLength = 20
  if (record.type === 8) byteLength = 40 + points.length * 16
  if (record.type === 3 || record.type === 5) {
    byteLength = 44 + record.parts.length * 4 + points.length * 16
  }

  const bytes = new Uint8Array(byteLength)
  const view = new DataView(bytes.buffer)
  view.setInt32(0, record.type, true)

  if (record.type === 1) {
    writePoints(view, 4, points)
  } else if (record.type === 8) {
    const offset = writeBounds(view, 4, bounds)
    view.setInt32(offset, points.length, true)
    writePoints(view, offset + 4, points)
  } else if (record.type === 3 || record.type === 5) {
    let offset = writeBounds(view, 4, bounds)
    view.setInt32(offset, record.parts.length, true)
    view.setInt32(offset + 4, points.length, true)
    offset += 8
    let pointIndex = 0
    for (const part of record.parts) {
      view.setInt32(offset, pointIndex, true)
      offset += 4
      pointIndex += part.length
    }
    writePoints(view, offset, points)
  }

  return bytes
}

const createShpAndShx = (fixture: ShapefileFixture): { shp: Uint8Array; shx: Uint8Array } => {
  const contents = fixture.records.map(createRecordContent)
  const shpByteLength =
    HEADER_BYTES + contents.reduce((total, content) => total + 8 + content.byteLength, 0)
  const shxByteLength = HEADER_BYTES + contents.length * 8
  const bounds = getBounds(fixture.records)
  const shp = new Uint8Array(shpByteLength)
  const shx = new Uint8Array(shxByteLength)
  const shpView = new DataView(shp.buffer)
  const shxView = new DataView(shx.buffer)
  writeHeader(shpView, shpByteLength, fixture.shapeType, bounds)
  writeHeader(shxView, shxByteLength, fixture.shapeType, bounds)

  let shpOffset = HEADER_BYTES
  for (let index = 0; index < contents.length; index += 1) {
    const content = contents[index]
    if (!content) continue
    const contentLengthWords = content.byteLength / 2
    shpView.setInt32(shpOffset, index + 1, false)
    shpView.setInt32(shpOffset + 4, contentLengthWords, false)
    shp.set(content, shpOffset + 8)

    const shxOffset = HEADER_BYTES + index * 8
    shxView.setInt32(shxOffset, shpOffset / 2, false)
    shxView.setInt32(shxOffset + 4, contentLengthWords, false)
    shpOffset += 8 + content.byteLength
  }

  return { shp, shx }
}

const createDbf = (records: readonly ShapeRecord[]): Uint8Array => {
  const fieldLength = 32
  const headerLength = 65
  const recordLength = fieldLength + 1
  const bytes = new Uint8Array(headerLength + records.length * recordLength + 1)
  const view = new DataView(bytes.buffer)
  bytes[0] = 3
  bytes[1] = 126
  bytes[2] = 10
  bytes[3] = 11
  view.setUint32(4, records.length, true)
  view.setUint16(8, headerLength, true)
  view.setUint16(10, recordLength, true)
  bytes.set(new TextEncoder().encode('NAME'), 32)
  bytes[43] = 'C'.charCodeAt(0)
  bytes[48] = fieldLength
  bytes[64] = 0x0d

  for (let index = 0; index < records.length; index += 1) {
    const offset = headerLength + index * recordLength
    bytes[offset] = 0x20
    bytes.fill(0x20, offset + 1, offset + recordLength)
    const name = records[index]?.name ?? ''
    bytes.set(new TextEncoder().encode(name).subarray(0, fieldLength), offset + 1)
  }
  bytes[bytes.length - 1] = 0x1a
  return bytes
}

/** Детерминированно собирает бинарную shapefile-фикстуру без файлов в репозитории. */
export const createShapefileFixture = async (name: string): Promise<ArrayBuffer> => {
  const fixture = FIXTURES[name]
  if (!fixture) {
    throw new Error(`Неизвестная shapefile-фикстура: ${name}`)
  }

  const { shp, shx } = createShpAndShx(fixture)
  return createZipBuffer({
    [`${fixture.basename}.shp`]: shp,
    [`${fixture.basename}.shx`]: shx,
    [`${fixture.basename}.dbf`]: createDbf(fixture.records),
  })
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
