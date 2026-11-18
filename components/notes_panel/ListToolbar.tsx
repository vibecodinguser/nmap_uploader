import type { ComponentProps } from 'react'
import { CreateActions } from './CreateActions'
import { FilterBar } from './FilterBar'
import { SelectionBar } from './SelectionBar'

/**
 * Строка инструментов списка: создание и фильтры либо действия с отмеченным.
 *
 * Выбор — режим, а не ещё одна полоса: пока что-то отмечено, панель выбора
 * встаёт на место создания и фильтров. Две полосы подряд слипались в один
 * блок, а появление второй сдвигало список.
 */
export const ListToolbar = ({
  create,
  filters,
  selection,
}: {
  create: ComponentProps<typeof CreateActions>
  filters: ComponentProps<typeof FilterBar>
  selection: ComponentProps<typeof SelectionBar>
}) => {
  if (selection.count > 0) return <SelectionBar {...selection} />

  return (
    <div className="notes-panel__toolbar">
      <CreateActions {...create} />
      <span className="notes-panel__toolbar-divider" aria-hidden="true" />
      <FilterBar {...filters} />
    </div>
  )
}
