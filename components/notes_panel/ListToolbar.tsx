import type { ComponentProps } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { CreateActions } from './CreateActions'
import { FilterBar } from './FilterBar'
import { SelectionBar } from './SelectionBar'

/**
 * Строка инструментов списка: создание и фильтры либо действия с отмеченным.
 *
 * Выбор — режим, а не ещё одна полоса: пока что-то отмечено, панель выбора
 * встаёт на место создания и фильтров. Две полосы подряд слипались в один
 * блок, а появление второй сдвигало список.
 *
 * «Отметить все» стоит и здесь, в обычной строке. Раньше она жила только в
 * панели выбора, а та появляется при первой отметке — то есть войти в режим
 * выбора было нечем: приходилось сначала отмечать одну заметку вручную.
 */
export const ListToolbar = ({
  create,
  filters,
  selection,
  hasNotes,
}: {
  create: ComponentProps<typeof CreateActions>
  filters: ComponentProps<typeof FilterBar>
  selection: ComponentProps<typeof SelectionBar>
  /** Есть ли что отмечать: при пустом списке кнопка не нужна. */
  hasNotes: boolean
}) => {
  const { t } = useLocale()

  if (selection.count > 0) return <SelectionBar {...selection} />

  return (
    <div className="notes-panel__toolbar">
      <CreateActions {...create} />
      <span className="notes-panel__toolbar-divider" aria-hidden="true" />
      <FilterBar {...filters} />
      {hasNotes && (
        <button
          type="button"
          className="notes-panel__link-button notes-panel__toolbar-select-all"
          onClick={selection.onSelectAll}
        >
          {t('notesPanel.selectAll')}
        </button>
      )}
    </div>
  )
}
