import { useCallback } from 'react'
import { browser } from 'wxt/browser'
import { type DrawableNoteKind, NOTES_START_DRAW_ACTION } from '@/lib/notes/protocol'
import { CANCEL_POINT_PICKING_ACTION } from '@/lib/pick_point_action'
import type { NotesPanelStore } from './useNotesPanelState'

/**
 * Рисование фигур на карте.
 *
 * Панель только просит карту включить режим и снимает его. Сама геометрия
 * приходит обратно сообщением `NOTES_DRAW_FINISHED`, её разбирает синхронизация.
 */
export const useNotesDrawing = ({ state, dispatch }: NotesPanelStore) => {
  const startDrawing = useCallback(
    (kind: DrawableNoteKind) => {
      dispatch({ type: 'drawingStarted', kind })
      browser.runtime.sendMessage({ action: NOTES_START_DRAW_ACTION, kind }).catch(() => {})
    },
    [dispatch],
  )

  const cancelDrawing = useCallback(() => {
    dispatch({ type: 'drawingStopped' })
    browser.runtime.sendMessage({ action: CANCEL_POINT_PICKING_ACTION }).catch(() => {})
  }, [dispatch])

  return { drawingKind: state.drawingKind, startDrawing, cancelDrawing }
}

export type NotesDrawing = ReturnType<typeof useNotesDrawing>
