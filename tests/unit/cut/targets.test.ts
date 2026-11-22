/**
 * Цели разреза: какие категории редактор разрешает резать.
 *
 * От этой таблицы зависит, появится ли кнопка и какая именно: ошибка в
 * категориях либо спрячет инструмент, либо покажет кнопку растительности на
 * водоёме.
 */
import { describe, expect, it } from 'vitest'
import {
  CUT_TARGETS,
  HYDRO_TARGET,
  isCutTargetCategory,
  isCutTargetLineCategory,
  isLineCategory,
  resolveCutTarget,
  VEGETATION_TARGET,
} from '@/lib/cut/targets'

describe('цели разреза', () => {
  it('узнаёт растительность по контейнеру и по контуру', () => {
    expect(resolveCutTarget('vegetation')).toBe(VEGETATION_TARGET)
    expect(resolveCutTarget('vegetation_fc')).toBe(VEGETATION_TARGET)
  })

  it('узнаёт растительность по линейной части', () => {
    expect(resolveCutTarget('vegetation_el')).toBe(VEGETATION_TARGET)
  })

  it('узнаёт водоём по контейнеру, контуру и части', () => {
    expect(resolveCutTarget('hydro')).toBe(HYDRO_TARGET)
    expect(resolveCutTarget('hydro_fc')).toBe(HYDRO_TARGET)
    expect(resolveCutTarget('hydro_fc_el')).toBe(HYDRO_TARGET)
  })

  it('узнаёт водоток по контейнеру и участку русла', () => {
    expect(resolveCutTarget('hydro_ln')).toBe(HYDRO_TARGET)
    expect(resolveCutTarget('hydro_ln_el')).toBe(HYDRO_TARGET)
  })

  it('не считает целью чужие категории', () => {
    expect(resolveCutTarget('bld')).toBeNull()
    expect(resolveCutTarget('rd_el')).toBeNull()
    expect(resolveCutTarget('')).toBeNull()
    expect(resolveCutTarget(null)).toBeNull()
    expect(resolveCutTarget(undefined)).toBeNull()
  })

  it('отличает линейные части от контейнеров', () => {
    expect(isCutTargetLineCategory('vegetation_el')).toBe(true)
    expect(isCutTargetLineCategory('hydro_fc_el')).toBe(true)
    expect(isCutTargetLineCategory('hydro_ln_el')).toBe(true)

    // Контейнеры целью являются, но резать в них нечего.
    expect(isCutTargetLineCategory('vegetation')).toBe(false)
    expect(isCutTargetLineCategory('hydro')).toBe(false)
    expect(isCutTargetLineCategory('bld')).toBe(false)
  })

  it('проверяет линейность в рамках конкретной цели', () => {
    expect(isLineCategory(VEGETATION_TARGET, 'vegetation_el')).toBe(true)
    expect(isLineCategory(VEGETATION_TARGET, 'hydro_fc_el')).toBe(false)
    expect(isLineCategory(HYDRO_TARGET, 'hydro_fc_el')).toBe(true)
    expect(isLineCategory(HYDRO_TARGET, 'vegetation_el')).toBe(false)
  })

  it('определяет принадлежность к любой цели', () => {
    expect(isCutTargetCategory('vegetation_fc')).toBe(true)
    expect(isCutTargetCategory('hydro_fc_el')).toBe(true)
    expect(isCutTargetCategory('bld')).toBe(false)
    expect(isCutTargetCategory(null)).toBe(false)
  })

  it('у каждой цели своя кнопка и своя подпись', () => {
    const ids = CUT_TARGETS.map((target) => target.buttonId)
    const labels = CUT_TARGETS.map((target) => target.labelKey)

    expect(new Set(ids).size).toBe(CUT_TARGETS.length)
    expect(new Set(labels).size).toBe(CUT_TARGETS.length)
    expect(CUT_TARGETS).toEqual([VEGETATION_TARGET, HYDRO_TARGET])
  })
})
