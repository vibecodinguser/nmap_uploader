import { describe, expect, it } from 'vitest'
import { ERR_SHAPEFILE, ProcessingError } from '@/lib/errors'
import {
  parseAndValidateTopoJsonText,
  resolveTopoJsonArcIndex,
  TOPOJSON_GEOMETRY_TYPES,
  validateTopoJsonArc,
  validateTopoJsonBbox,
  validateTopoJsonPosition,
  validateTopoJsonTopology,
  validateTopoJsonTransform,
} from '@/lib/topojson/topojson_spec'
import { readTopoJsonFixture } from '../fixtures/topojson_fixtures'

const expectTopoJsonError = (run: () => void, messageIncludes: string): void => {
  try {
    run()
    expect.fail('Ожидалась ProcessingError')
  } catch (error) {
    expect(error).toBeInstanceOf(ProcessingError)
    expect((error as ProcessingError).code).toBe(ERR_SHAPEFILE)
    expect((error as ProcessingError).message).toContain(messageIncludes)
  }
}

describe('TopoJSON specification: Topology (§2.1)', () => {
  it('содержит 7 типов геометрии', () => {
    expect(TOPOJSON_GEOMETRY_TYPES.size).toBe(7)
    expect(TOPOJSON_GEOMETRY_TYPES.has('Point')).toBe(true)
    expect(TOPOJSON_GEOMETRY_TYPES.has('GeometryCollection')).toBe(true)
  })

  it('example.topojson и quantized.topojson проходят валидацию', () => {
    expect(() =>
      parseAndValidateTopoJsonText(readTopoJsonFixture('example.topojson')),
    ).not.toThrow()
    expect(() =>
      parseAndValidateTopoJsonText(readTopoJsonFixture('quantized.topojson')),
    ).not.toThrow()
  })

  it('отклоняет type в нижнем регистре', () => {
    expectTopoJsonError(
      () => parseAndValidateTopoJsonText(readTopoJsonFixture('invalid_topo_type.topojson')),
      '"Topology"',
    )
  })

  it('отклоняет пустой objects', () => {
    expectTopoJsonError(
      () => parseAndValidateTopoJsonText(readTopoJsonFixture('empty_objects.topojson')),
      'objects',
    )
  })

  it('требует член arcs', () => {
    expectTopoJsonError(
      () => validateTopoJsonTopology(JSON.parse(readTopoJsonFixture('missing_arcs.topojson'))),
      'arcs',
    )
  })
})

describe('TopoJSON specification: Position и arcs (§2.1.1–2.1.3)', () => {
  it('принимает position с 2+ элементами', () => {
    expect(() => validateTopoJsonPosition([37.6, 55.75], 'test', false)).not.toThrow()
    expect(() => validateTopoJsonPosition([37.6, 55.75, 100], 'test', false)).not.toThrow()
  })

  it('отклоняет position с одним элементом', () => {
    expectTopoJsonError(() => validateTopoJsonPosition([37.6], 'test', false), 'минимум 2 элемента')
  })

  it('отклоняет arc с одной позицией', () => {
    expectTopoJsonError(
      () => validateTopoJsonArc([[37.6, 55.75]], 'arc', false),
      'минимум 2 позиции',
    )
  })

  it('квантованные позиции должны быть целыми', () => {
    expect(() => validateTopoJsonPosition([4000, 5000], 'test', true)).not.toThrow()
    expectTopoJsonError(
      () => validateTopoJsonPosition([4000.5, 5000], 'test', true),
      'целым числом',
    )
  })
})

describe('TopoJSON specification: transform (§2.1.2)', () => {
  it('требует scale и translate длиной 2', () => {
    const transform = validateTopoJsonTransform({
      scale: [0.001, 0.001],
      translate: [100, 0],
    })
    expect(transform.scale).toEqual([0.001, 0.001])
    expect(transform.translate).toEqual([100, 0])
  })

  it('отклоняет transform без translate', () => {
    expectTopoJsonError(() => validateTopoJsonTransform({ scale: [1, 1] }), 'translate')
  })
})

describe('TopoJSON specification: arc indexes (§2.1.4)', () => {
  it("разрешает отрицательные индексы через ones' complement", () => {
    expect(resolveTopoJsonArcIndex(-1)).toBe(0)
    expect(resolveTopoJsonArcIndex(-2)).toBe(1)
    expect(resolveTopoJsonArcIndex(0)).toBe(0)
  })

  it('отклоняет arc index вне диапазона', () => {
    expectTopoJsonError(
      () => parseAndValidateTopoJsonText(readTopoJsonFixture('invalid_arc_index.topojson')),
      'вне диапазона',
    )
  })
})

describe('TopoJSON specification: bbox (§3)', () => {
  it('принимает bbox из 4 и 6 чисел', () => {
    expect(() => validateTopoJsonBbox([100, 0, 105, 1], 'bbox')).not.toThrow()
    expect(() => validateTopoJsonBbox([100, 0, -100, 105, 1, 0], 'bbox')).not.toThrow()
  })

  it('отклоняет bbox неправильной длины', () => {
    expectTopoJsonError(() => validateTopoJsonBbox([0, 0, 1], 'bbox'), '4 или 6 чисел')
  })
})

describe('TopoJSON specification: конвертируемая геометрия', () => {
  it('отклоняет GeometryCollection без геометрий', () => {
    expectTopoJsonError(
      () => parseAndValidateTopoJsonText(readTopoJsonFixture('empty_geometries.topojson')),
      'не содержит геометрии',
    )
  })
})
