import { describe, expect, it } from 'vitest'
import {
  areCoordinatesValid,
  createGeometryIndex,
  isValidTargetDate,
} from '@/lib/point_uploader'

describe('createGeometryIndex', () => {
  it('создаёт точку с координатами [lon, lat]', () => {
    const result = createGeometryIndex({
      coords: [[37.6176, 55.7558]],
      geomType: 'Point',
      description: 'Кремль',
    })

    const point = Object.values(result.points)[0]
    expect(point.coords).toEqual([37.6176, 55.7558])
    expect(point.desc).toBe('Кремль')
    expect(Object.keys(result.paths)).toHaveLength(0)
  })

  it('обрезает описание до 150 символов', () => {
    const result = createGeometryIndex({
      coords: [[37, 55]],
      geomType: 'Point',
      description: 'x'.repeat(200),
    })

    const point = Object.values(result.points)[0]
    expect(point.desc).toHaveLength(150)
  })
})


describe('areCoordinatesValid', () => {
  it('принимает допустимые координаты', () => {
    expect(areCoordinatesValid({ latitude: 55.7, longitude: 37.6 })).toBe(true)
  })

  it('отклоняет выход за диапазон', () => {
    expect(areCoordinatesValid({ latitude: 91, longitude: 37.6 })).toBe(false)
    expect(areCoordinatesValid({ latitude: 55.7, longitude: -181 })).toBe(false)
  })
})

describe('isValidTargetDate', () => {
  it('принимает корректную дату', () => {
    expect(isValidTargetDate('2026-05-27')).toBe(true)
  })

  it('отклоняет некорректный формат', () => {
    expect(isValidTargetDate('27.05.2026')).toBe(false)
    expect(isValidTargetDate('2026-13-01')).toBe(false)
  })
})
