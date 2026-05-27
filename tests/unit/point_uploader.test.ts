import { describe, expect, it } from 'vitest'
import {
  areCoordinatesValid,
  createPointIndex,
  isValidTargetDate,
  processMultipointContent,
} from '@/lib/point_uploader'

describe('createPointIndex', () => {
  it('создаёт точку с координатами [lon, lat]', () => {
    const result = createPointIndex({
      latitude: 55.7558,
      longitude: 37.6176,
      description: 'Кремль',
    })

    const point = Object.values(result.points)[0]
    expect(point.coords).toEqual([37.6176, 55.7558])
    expect(point.desc).toBe('Кремль')
    expect(Object.keys(result.paths)).toHaveLength(0)
  })

  it('обрезает описание до 150 символов', () => {
    const result = createPointIndex({
      latitude: 55,
      longitude: 37,
      description: 'x'.repeat(200),
    })

    const point = Object.values(result.points)[0]
    expect(point.desc).toHaveLength(150)
  })
})

describe('processMultipointContent', () => {
  it('парсит строки с кавычками и без', () => {
    const content = ['"Моя точка", 55.123456, 37.123456;', 'Точка 2, 56.1, 38.2'].join('\n')

    const result = processMultipointContent(content)
    const points = Object.values(result.points)

    expect(points).toHaveLength(2)
    expect(points[0]?.desc).toBe('Моя точка')
    expect(points[0]?.coords).toEqual([37.123456, 55.123456])
    expect(points[1]?.desc).toBe('Точка 2')
  })

  it('пропускает строки с некорректными координатами', () => {
    const result = processMultipointContent('"Bad", 999, 37.1')
    expect(Object.keys(result.points)).toHaveLength(0)
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
