import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '@/hooks/useLocale'
import type { Note, NoteGroup } from '@/lib/notes/model/types'
import {
  buildListRows,
  type PositionedRow,
  positionRows,
  totalHeight,
  visibleSlice,
} from '@/lib/notes/panel/rows'

const DEFAULT_VIEWPORT = 420

/**
 * Окно прокрутки списка заметок.
 *
 * Заметок тысячи, а заголовки групп добавляют ещё строки. Высота строк разная
 * (заголовок ниже строки заметки), поэтому окно считается по накопленным
 * смещениям, а не по индексу.
 */
export const useVirtualRows = ({
  notes,
  groups,
  collapsedGroupIds,
}: {
  notes: readonly Note[]
  groups: readonly NoteGroup[]
  collapsedGroupIds: readonly string[]
}) => {
  const { t } = useLocale()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT)

  const rows = useMemo(
    () =>
      buildListRows({
        notes,
        groups,
        collapsedGroupIds,
        ungroupedTitle: t('notesPanel.ungrouped'),
      }),
    [notes, groups, collapsedGroupIds, t],
  )
  const positioned = useMemo(() => positionRows(rows), [rows])
  const height = useMemo(() => totalHeight(rows), [rows])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return

    const update = () => setViewportHeight(element.clientHeight || DEFAULT_VIEWPORT)
    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // При смене фильтра или сворачивании список может стать короче — тогда
  // прокрутка за пределами контента оставила бы пустой экран.
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    if (element.scrollTop > height) {
      element.scrollTop = 0
      setScrollTop(0)
    }
  }, [height])

  const { items } = visibleSlice(positioned, scrollTop, viewportHeight)

  const onScroll = (event: React.UIEvent<HTMLDivElement>): void => {
    setScrollTop(event.currentTarget.scrollTop)
  }

  return { viewportRef, items, height, onScroll, rows, positioned }
}

export type VirtualRows = {
  items: PositionedRow[]
  /** Полный набор строк, а не только видимое окно: нужен клавиатуре. */
  rows: ReturnType<typeof buildListRows>
  positioned: PositionedRow[]
  height: number
  viewportRef: React.RefObject<HTMLDivElement | null>
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void
}
