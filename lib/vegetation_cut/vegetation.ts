/**
 * Категории растительности Народной карты.
 *
 * Объект растительности устроен как контейнер `vegetation` с контуром
 * `vegetation_fc`, внутри которого лежат части `vegetation_el` — открытые
 * линии. Разрез имеет смысл только для линейных частей.
 */
const VEGETATION_CATEGORIES: ReadonlySet<string> = new Set([
  'vegetation',
  'vegetation_fc',
  'vegetation_el',
])

/** Открытый объект относится к растительности. */
export const isVegetationCategory = (categoryId: string | null | undefined): boolean =>
  typeof categoryId === 'string' && VEGETATION_CATEGORIES.has(categoryId)

/** Категория, у которой геометрия — линия (контур или его часть). */
export const isVegetationLineCategory = (categoryId: string | null | undefined): boolean =>
  categoryId === 'vegetation_fc' || categoryId === 'vegetation_el'
