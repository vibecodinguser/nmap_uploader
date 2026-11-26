import type { NoteGroup } from './types'

/**
 * Группировка заметок.
 *
 * Один уровень вложенности: группа — это именованный набор заметок, заметка
 * состоит не более чем в одной группе. Подгрупп нет намеренно: при тысячах
 * объектов дерево становится неуправляемым, а нужен только цвет и порядок.
 *
 * Раскладка списка (строки, высоты, окно прокрутки) живёт в
 * `lib/notes/panel/rows.ts`: она нужна только интерфейсу.
 */

/**
 * Порядок групп: `order`, затем название.
 *
 * `order` может совпадать у групп из разных устройств (обе получили 0), и
 * тогда единственный предсказуемый порядок — по имени.
 */
export const sortGroups = (groups: readonly NoteGroup[]): NoteGroup[] =>
  [...groups].sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order
    return left.name.localeCompare(right.name, 'ru')
  })

export type GroupVisibility = 'visible' | 'hidden' | 'mixed'

/**
 * Состояние видимости группы.
 *
 * «Смешанное» бывает, когда часть заметок скрыли по одной: кнопка группы
 * должна это показывать, иначе она врёт о состоянии и первый клик скрывает не
 * всё, чего ждёт пользователь.
 */
export const groupVisibility = (
  noteIds: readonly string[],
  hiddenIds: readonly string[],
): GroupVisibility => {
  if (noteIds.length === 0) return 'visible'

  const hidden = new Set(hiddenIds)
  const hiddenCount = noteIds.reduce((count, id) => (hidden.has(id) ? count + 1 : count), 0)

  if (hiddenCount === 0) return 'visible'
  if (hiddenCount === noteIds.length) return 'hidden'
  return 'mixed'
}
