import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { useLocale } from '@/hooks/useLocale'
import { formatDateDisplay } from '@/lib/date_format'
import { buildAutoNoteName } from '@/lib/notes/autonames'
import { geometryAnchor, geometryBounds, zoomForBounds } from '@/lib/notes/geometry'
import type { NotesManifest } from '@/lib/notes/manifest'
import {
  NOTES_DELETE_NOTE_ACTION,
  NOTES_DRAW_FINISHED_ACTION,
  NOTES_HIDDEN_CHANGED_ACTION,
  NOTES_LOAD_ACTION,
  NOTES_SAVE_NOTE_ACTION,
  NOTES_SELECT_ACTION,
  NOTES_SNAPSHOT_ACTION,
  NOTES_START_DRAW_ACTION,
} from '@/lib/notes/messages'
import type { GeometryShard } from '@/lib/notes/shards'
import { createDefaultStyle } from '@/lib/notes/style_resolution'
import type { Note, NoteGeometry, NoteKind } from '@/lib/notes/types'
import { NOTES_PANEL_SHOW_NOTE_MESSAGE } from '@/lib/notes_panel/host'
import { CANCEL_POINT_PICKING_ACTION } from '@/lib/pick_point_action'

export type NotesPanelMode = 'list' | 'properties'

export type DrawableKind = Extract<NoteKind, 'Point' | 'Line' | 'Polygon'>

type SnapshotState = {
  manifest: NotesManifest
  shards: Record<string, GeometryShard>
  hiddenIds: string[]
}

type MutationResponse = {
  ok?: boolean
  error?: string
  manifest?: NotesManifest
  shards?: Record<string, GeometryShard>
}

const SAVE_DEBOUNCE_MS = 700
const UNDO_TIMEOUT_MS = 5000

const geometriesOf = (shards: Record<string, GeometryShard>): Record<string, NoteGeometry> => {
  const geometries: Record<string, NoteGeometry> = {}
  for (const shard of Object.values(shards)) {
    Object.assign(geometries, shard.notes)
  }
  return geometries
}

const kindLabelKey = (kind: NoteKind) =>
  `notesPanel.kind${kind}` as
    | 'notesPanel.kindPoint'
    | 'notesPanel.kindLine'
    | 'notesPanel.kindPolygon'
    | 'notesPanel.kindSquare'
    | 'notesPanel.kindCircle'

/**
 * Состояние панели заметок.
 *
 * Панель — единственный владелец изменений: она собирает заметку целиком и
 * отправляет её в background, а background уже решает, как писать файлы.
 */
export const useNotesPanel = () => {
  const { t } = useLocale()
  const [snapshot, setSnapshot] = useState<SnapshotState | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<NotesPanelMode>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [drawingKind, setDrawingKind] = useState<DrawableKind | null>(null)
  const [undo, setUndo] = useState<{ note: Note; geometry: NoteGeometry } | null>(null)
  const saveTimer = useRef<number | null>(null)
  const pendingNote = useRef<{ note: Note; geometry: NoteGeometry } | null>(null)
  const createNoteRef = useRef<((kind: DrawableKind, coords: [number, number][]) => void) | null>(
    null,
  )

  const applyMutation = useCallback((response: MutationResponse) => {
    if (!response.ok || !response.manifest) {
      setError(response.error ?? null)
      return
    }
    setSnapshot((previous) => ({
      manifest: response.manifest as NotesManifest,
      shards: { ...(previous?.shards ?? {}), ...(response.shards ?? {}) },
      hiddenIds: previous?.hiddenIds ?? [],
    }))
    setError(null)
  }, [])

  const flushSave = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const pending = pendingNote.current
    if (!pending) return
    pendingNote.current = null

    browser.runtime
      .sendMessage({
        action: NOTES_SAVE_NOTE_ACTION,
        note: pending.note,
        geometry: pending.geometry,
      })
      .then((response: unknown) => applyMutation(response as MutationResponse))
      .catch(() => setError(t('notesPanel.saveError')))
  }, [applyMutation, t])

  const scheduleSave = useCallback(
    (note: Note, geometry: NoteGeometry) => {
      pendingNote.current = { note, geometry }
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS)
    },
    [flushSave],
  )

  // Загрузка при открытии: сначала кэш, потом Диск широковещательно.
  useEffect(() => {
    let isMounted = true

    browser.runtime
      .sendMessage({ action: NOTES_LOAD_ACTION })
      .then((response: unknown) => {
        if (!isMounted) return
        const payload = response as { ok?: boolean; error?: string; snapshot?: SnapshotState }
        if (payload?.ok && payload.snapshot) {
          setSnapshot({
            manifest: payload.snapshot.manifest,
            shards: payload.snapshot.shards,
            hiddenIds: payload.snapshot.hiddenIds,
          })
          setStatus('ready')
          return
        }
        setStatus(payload?.error === 'AUTH_REQUIRED' ? 'auth' : 'error')
      })
      .catch(() => {
        if (isMounted) setStatus('error')
      })

    return () => {
      isMounted = false
      flushSave()
    }
  }, [flushSave])

  // Снимки и события карты.
  useEffect(() => {
    const handleMessage = (message: Record<string, unknown>) => {
      switch (message.action) {
        case NOTES_SNAPSHOT_ACTION: {
          const next = message.snapshot as SnapshotState | undefined
          if (next?.manifest) {
            setSnapshot(next)
            setStatus('ready')
          }
          break
        }
        case NOTES_SELECT_ACTION: {
          const noteId = typeof message.noteId === 'string' ? message.noteId : null
          setSelectedId(noteId)
          setMode(noteId ? 'properties' : 'list')
          break
        }
        case NOTES_DRAW_FINISHED_ACTION: {
          const kind = message.kind
          const coords = message.coords
          setDrawingKind(null)
          if (
            (kind === 'Point' || kind === 'Line' || kind === 'Polygon') &&
            Array.isArray(coords) &&
            coords.length > 0
          ) {
            createNoteRef.current?.(kind, coords as [number, number][])
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
        setSelectedId(data.noteId)
        setMode('properties')
      }
    }

    browser.runtime.onMessage.addListener(handleMessage)
    window.addEventListener('message', handleWindowMessage)
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage)
      window.removeEventListener('message', handleWindowMessage)
    }
  }, [])

  const notes = snapshot?.manifest.notes ?? []
  const groups = snapshot?.manifest.groups ?? []
  const geometries = useMemo(() => geometriesOf(snapshot?.shards ?? {}), [snapshot?.shards])

  const geometryOf = useCallback(
    (noteId: string): NoteGeometry | null => geometries[noteId] ?? null,
    [geometries],
  )

  const createNote = useCallback(
    (kind: DrawableKind, coords: [number, number][]) => {
      const date = formatDateDisplay(new Date())
      const existingNames = (snapshot?.manifest.notes ?? []).map((note) => note.name)
      const name = buildAutoNoteName({
        date,
        kindLabel: t(kindLabelKey(kind)),
        existingNames,
      })

      const geometry: NoteGeometry =
        kind === 'Point'
          ? { kind: 'Point', coords: coords[0] }
          : kind === 'Line'
            ? { kind: 'Line', coords }
            : { kind: 'Polygon', coords }

      const timestamp = new Date().toISOString()
      const note: Note = {
        id: crypto.randomUUID(),
        kind,
        name,
        description: '',
        date,
        icon: null,
        showLabel: false,
        style: createDefaultStyle(kind),
        groupId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      browser.runtime
        .sendMessage({ action: NOTES_SAVE_NOTE_ACTION, note, geometry })
        .then((response: unknown) => {
          applyMutation(response as MutationResponse)
          setSelectedId(note.id)
          setMode('properties')
        })
        .catch(() => setError(t('notesPanel.createFailed')))
    },
    [applyMutation, snapshot?.manifest.notes, t],
  )

  createNoteRef.current = createNote

  const updateNote = useCallback(
    (noteId: string, patch: Partial<Note>) => {
      const note = (snapshot?.manifest.notes ?? []).find((item) => item.id === noteId)
      const geometry = geometries[noteId]
      if (!note || !geometry) return

      const next: Note = { ...note, ...patch, updatedAt: new Date().toISOString() }

      setSnapshot((previous) =>
        previous
          ? {
              ...previous,
              manifest: {
                ...previous.manifest,
                notes: previous.manifest.notes.map((item) => (item.id === noteId ? next : item)),
              },
            }
          : previous,
      )

      scheduleSave(next, geometry)
    },
    [geometries, scheduleSave, snapshot?.manifest.notes],
  )

  const removeNote = useCallback(
    (noteId: string) => {
      const note = (snapshot?.manifest.notes ?? []).find((item) => item.id === noteId)
      const geometry = geometries[noteId]
      if (!note || !geometry) return

      browser.runtime
        .sendMessage({ action: NOTES_DELETE_NOTE_ACTION, noteId })
        .then((response: unknown) => {
          applyMutation(response as MutationResponse)
          setUndo({ note, geometry })
          setSelectedId(null)
          setMode('list')
          window.setTimeout(() => setUndo(null), UNDO_TIMEOUT_MS)
        })
        .catch(() => setError(t('notesPanel.saveError')))
    },
    [applyMutation, geometries, snapshot?.manifest.notes, t],
  )

  const undoRemove = useCallback(() => {
    if (!undo) return
    browser.runtime
      .sendMessage({ action: NOTES_SAVE_NOTE_ACTION, note: undo.note, geometry: undo.geometry })
      .then((response: unknown) => {
        applyMutation(response as MutationResponse)
        setUndo(null)
      })
      .catch(() => setError(t('notesPanel.saveError')))
  }, [applyMutation, t, undo])

  const selectNote = useCallback((noteId: string | null) => {
    setSelectedId(noteId)
    setMode(noteId ? 'properties' : 'list')
    browser.runtime.sendMessage({ action: NOTES_SELECT_ACTION, noteId }).catch(() => {})
  }, [])

  const locateNote = useCallback(
    (noteId: string) => {
      const geometry = geometryOf(noteId)
      if (!geometry) return
      const anchor = geometryAnchor(geometry)
      const bounds = geometryBounds(geometry)
      if (!anchor) return

      browser.runtime
        .sendMessage({
          action: 'centerMap',
          latitude: anchor[1],
          longitude: anchor[0],
          zoom: bounds ? Math.max(zoomForBounds(bounds), 15) : 17,
        })
        .catch(() => {})
      browser.runtime.sendMessage({ action: NOTES_SELECT_ACTION, noteId }).catch(() => {})
    },
    [geometryOf],
  )

  const toggleHidden = useCallback((noteId: string) => {
    setSnapshot((previous) => {
      if (!previous) return previous
      const hidden = new Set(previous.hiddenIds)
      if (hidden.has(noteId)) hidden.delete(noteId)
      else hidden.add(noteId)
      const hiddenIds = [...hidden]
      browser.runtime
        .sendMessage({ action: NOTES_HIDDEN_CHANGED_ACTION, hiddenIds })
        .catch(() => {})
      return { ...previous, hiddenIds }
    })
  }, [])

  const startDrawing = useCallback((kind: DrawableKind) => {
    setDrawingKind(kind)
    browser.runtime.sendMessage({ action: NOTES_START_DRAW_ACTION, kind }).catch(() => {})
  }, [])

  const cancelDrawing = useCallback(() => {
    setDrawingKind(null)
    browser.runtime.sendMessage({ action: CANCEL_POINT_PICKING_ACTION }).catch(() => {})
  }, [])

  const filteredNotes = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = [...notes].sort((left, right) => left.name.localeCompare(right.name, 'ru'))
    if (!needle) return list
    return list.filter(
      (note) =>
        note.name.toLowerCase().includes(needle) || note.description.toLowerCase().includes(needle),
    )
  }, [notes, query])

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  )

  return {
    t,
    status,
    error,
    mode,
    setMode,
    query,
    setQuery,
    notes: filteredNotes,
    groups,
    hiddenIds: snapshot?.hiddenIds ?? [],
    selectedNote,
    selectedId,
    selectNote,
    locateNote,
    toggleHidden,
    updateNote,
    removeNote,
    undo,
    undoRemove,
    drawingKind,
    startDrawing,
    cancelDrawing,
    geometryOf,
  }
}
