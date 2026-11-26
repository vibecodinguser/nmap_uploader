/**
 * Перетаскивание строк списка «Внешние геосервисы» в настройках.
 *
 * Порядок во время перетаскивания живёт в локальном состоянии-превью, а в
 * хранилище попадает один раз — по отпусканию указателя. Иначе каждая
 * перестановка писала бы в `browser.storage` и перезапускала подписки на
 * изменение настроек.
 */

import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from 'react'
import { type DragSortRow, startDragSort } from '@/lib/go_to/drag_sort'
import { type GoToItem, moveGoToItemTo } from '@/lib/go_to_settings'

/** Атрибут строки списка с именем источника. */
export const GO_TO_DRAG_ITEM_ATTRIBUTE = 'data-go-to-name'

type GoToItemsDragOptions = {
  items: GoToItem[]
  reorderItems: (items: GoToItem[]) => void
}

export type GoToItemsDrag = {
  listRef: React.RefObject<HTMLUListElement | null>
  /** Порядок для отрисовки: превью во время перетаскивания, иначе `items`. */
  displayedItems: GoToItem[]
  draggingName: string | null
  handlePointerDown: (event: ReactPointerEvent<HTMLElement>, name: string) => void
}

const readRows = (list: HTMLUListElement | null): DragSortRow[] => {
  if (!list) return []

  const rows: DragSortRow[] = []
  const elements = list.querySelectorAll<HTMLElement>(`[${GO_TO_DRAG_ITEM_ATTRIBUTE}]`)
  for (const element of Array.from(elements)) {
    rows.push({ key: element.getAttribute(GO_TO_DRAG_ITEM_ATTRIBUTE) ?? '', element })
  }
  return rows
}

export function useGoToListDrag({ items, reorderItems }: GoToItemsDragOptions): GoToItemsDrag {
  const listRef = useRef<HTMLUListElement | null>(null)
  const previewRef = useRef<GoToItem[] | null>(null)
  const [previewItems, setPreviewItems] = useState<GoToItem[] | null>(null)
  const [draggingName, setDraggingName] = useState<string | null>(null)

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, name: string): void => {
      const startItems = items

      startDragSort({
        event: event.nativeEvent,
        key: name,
        getRows: () => readRows(listRef.current),
        onMoveStart: (movedName) => {
          previewRef.current = startItems
          setPreviewItems(startItems)
          setDraggingName(movedName)
        },
        onReorder: (movedName, targetName) => {
          const base = previewRef.current ?? startItems
          const next = moveGoToItemTo(base, movedName, targetName)
          if (next === base) return
          previewRef.current = next
          setPreviewItems(next)
        },
        onRestore: () => {
          previewRef.current = null
          setPreviewItems(null)
        },
        onCancel: () => setDraggingName(null),
        onMoveEnd: () => {
          const next = previewRef.current
          previewRef.current = null
          setPreviewItems(null)
          setDraggingName(null)
          if (next) reorderItems(next)
        },
      })
    },
    [items, reorderItems],
  )

  return {
    listRef,
    displayedItems: previewItems ?? items,
    draggingName,
    handlePointerDown,
  }
}
