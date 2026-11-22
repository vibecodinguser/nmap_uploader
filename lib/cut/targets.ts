/**
 * Цели разреза: какие категории Народной карты инструмент умеет резать.
 *
 * Все цели устроены одинаково — контейнер объекта, контур и линейные части:
 *
 * ```
 * vegetation → vegetation_fc → vegetation_el   (части открытые)
 * hydro      → hydro_fc      → hydro_fc_el     (часть — замкнутое кольцо)
 *              hydro_ln      → hydro_ln_el     (участок русла)
 * ```
 *
 * Разрез — операция над линией, поэтому цель описывает только категории и
 * подпись кнопки; геометрия и режим у всех общие.
 */

import type { MessageKey } from '@/lib/i18n'

export type CutTargetId = 'vegetation' | 'hydro'

export type CutTarget = {
  id: CutTargetId
  /** Категории объекта и контейнеров: по ним узнаём цель в редакторе. */
  containerCategories: ReadonlySet<string>
  /** Категории линейных частей: только их имеет смысл резать. */
  lineCategories: ReadonlySet<string>
  /** id кнопки в тулбаре: у каждой цели своя. */
  buttonId: string
  /** Ключ подписи кнопки в `lib/i18n`. */
  labelKey: MessageKey
}

export const VEGETATION_TARGET: CutTarget = {
  id: 'vegetation',
  containerCategories: new Set(['vegetation', 'vegetation_fc']),
  lineCategories: new Set(['vegetation_fc', 'vegetation_el']),
  buttonId: 'nmap-vegetation-cut-button',
  labelKey: 'cut.vegetationButton',
}

export const HYDRO_TARGET: CutTarget = {
  id: 'hydro',
  containerCategories: new Set(['hydro', 'hydro_fc', 'hydro_ln']),
  lineCategories: new Set(['hydro_fc_el', 'hydro_ln_el']),
  buttonId: 'nmap-hydro-cut-button',
  labelKey: 'cut.hydroButton',
}

export const CUT_TARGETS: readonly CutTarget[] = [VEGETATION_TARGET, HYDRO_TARGET]

/** Открытый объект относится к одной из целей разреза. */
export const isCutTargetCategory = (categoryId: string | null | undefined): boolean =>
  resolveCutTarget(categoryId) !== null

/** Категория, у которой геометрия — линия (контур или его часть). */
export const isCutTargetLineCategory = (categoryId: string | null | undefined): boolean =>
  CUT_TARGETS.some((target) => isLineCategory(target, categoryId))

export const isLineCategory = (target: CutTarget, categoryId: string | null | undefined): boolean =>
  typeof categoryId === 'string' && target.lineCategories.has(categoryId)

/** Находит цель по категории объекта или его части. */
export const resolveCutTarget = (categoryId: string | null | undefined): CutTarget | null => {
  if (typeof categoryId !== 'string' || !categoryId) return null
  for (const target of CUT_TARGETS) {
    if (target.containerCategories.has(categoryId) || target.lineCategories.has(categoryId)) {
      return target
    }
  }
  return null
}
