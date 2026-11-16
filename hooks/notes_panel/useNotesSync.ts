import { useCallback, useEffect, useRef } from 'react'
import { browser } from 'wxt/browser'
import { geometryFromDrawCoords } from '@/lib/notes/model/geometry'
import type { NoteGeometry } from '@/lib/notes/model/types'
import {
  type DrawableNoteKind,
  isDrawableNoteKind,
  NOTES_DRAW_FINISHED_ACTION,
  NOTES_LOAD_ACTION,
  NOTES_SELECT_ACTION,
  NOTES_SNAPSHOT_ACTION,
  type NotesLoadResponse,
  type NotesSnapshot,
} from '@/lib/notes/protocol'
import { NOTES_PANEL_SHOW_NOTE_MESSAGE } from '@/lib/notes_panel/host'
import { useNotesAutoReload } from './useNotesAutoReload'
import type { NotesPanelStore } from './useNotesPanelState'

/**
 * Загрузка снимка и подписки панели.
 *
 * Панель живёт в постоянно смонтированном iframe: без подписки на вход в
 * Яндекс и на возврат вкладки в фокус она навсегда осталась бы в том состоянии,
 * в котором открылась.
 */
export const useNotesSync = (
  store: NotesPanelStore,
  createNote: (kind: DrawableNoteKind, geometry: NoteGeometry) => void,
) => {
  const { dispatch } = store
  const createNoteRef = useRef(createNote)
  useEffect(() => {
    createNoteRef.current = createNote
  }, [createNote])

  /**
   * Режим рисования в изменяемой ссылке.
   *
   * `NOTES_DRAW_FINISHED` приходит в панель дважды: напрямую от content script
   * (`runtime.sendMessage` из content script получают все страницы расширения,
   * включая этот iframe) и ещё раз от background, который пересылает событие
   * вкладкам и панели. Ссылка, а не состояние: гасить режим нужно в момент
   * первого сообщения, иначе второе, пришедшее в той же пачке, успеет создать
   * ещё одну заметку.
   */
  const drawingKindRef = useRef(store.state.drawingKind)
  drawingKindRef.current = store.state.drawingKind

  // Загрузка: при монтировании, после входа и по кнопке «Повторить».
  const loadNotes = useCallback(
    (options: { silent?: boolean } = {}) => {
      if (!options.silent) dispatch({ type: 'statusChanged', status: 'loading' })

      browser.runtime
        .sendMessage({ action: NOTES_LOAD_ACTION })
        .then((response: unknown) => {
          const payload = response as NotesLoadResponse | undefined
          if (payload?.ok) {
            dispatch({ type: 'loaded', snapshot: payload.snapshot })
            return
          }
          dispatch({
            type: 'statusChanged',
            status: payload?.error === 'AUTH_REQUIRED' ? 'auth' : 'error',
          })
        })
        .catch(() => dispatch({ type: 'statusChanged', status: 'error' }))
    },
    [dispatch],
  )

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useNotesAutoReload(store, loadNotes)

  /** Вход прямо из панели: токена нет, а карта открыта. */
  const login = useCallback(() => {
    dispatch({ type: 'statusChanged', status: 'loading' })
    browser.runtime
      .sendMessage({ action: 'login' })
      .then(() => loadNotes({ silent: true }))
      .catch(() => dispatch({ type: 'statusChanged', status: 'auth' }))
  }, [dispatch, loadNotes])

  // Снимки и события карты.
  useEffect(() => {
    const handleMessage = (message: Record<string, unknown>) => {
      switch (message.action) {
        case NOTES_SNAPSHOT_ACTION: {
          const next = message.snapshot as NotesSnapshot | undefined
          if (next?.manifest) dispatch({ type: 'merged', snapshot: next })
          break
        }
        case NOTES_SELECT_ACTION: {
          const noteId = typeof message.noteId === 'string' ? message.noteId : null
          dispatch({ type: 'noteSelected', noteId })
          break
        }
        case NOTES_DRAW_FINISHED_ACTION: {
          // Ждём результат только если действительно рисуем: без этой проверки
          // одно нажатие давало две заметки — сообщение приходит по двум каналам.
          if (!drawingKindRef.current) break
          drawingKindRef.current = null

          const kind = message.kind
          const coords = message.coords
          dispatch({ type: 'drawingStopped' })
          if (isDrawableNoteKind(kind) && Array.isArray(coords)) {
            const geometry = geometryFromDrawCoords(kind, coords as [number, number][])
            if (geometry) createNoteRef.current(kind, geometry)
          }
          break
        }
        default:
          break
      }
    }

    const handleWindowMessage = (event: MessageEvent) => {
      const data = event.data as { action?: string; noteId?: string } | null
      if (data?.action === NOTES_PANEL_SHOW_NOTE_MESSAGE && typeof data.noteId === 'string') {
        dispatch({ type: 'noteSelected', noteId: data.noteId })
      }
    }

    browser.runtime.onMessage.addListener(handleMessage)
    window.addEventListener('message', handleWindowMessage)
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage)
      window.removeEventListener('message', handleWindowMessage)
    }
  }, [dispatch])

  return { loadNotes, login }
}

export type NotesSync = ReturnType<typeof useNotesSync>
