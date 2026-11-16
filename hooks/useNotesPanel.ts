import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { useLocale } from '@/hooks/useLocale'
import { formatDateDisplay } from '@/lib/date_format'
import { buildAutoNoteName } from '@/lib/notes/autonames'
import {
  distanceMeters,
  geometryAnchor,
  geometryBounds,
  squareCornersFromDrag,
  zoomForBounds,
} from '@/lib/notes/geometry'
import { collapseKey, type GroupVisibility, groupVisibility } from '@/lib/notes/grouping'
import { mergeManifests, type NotesManifest } from '@/lib/notes/manifest'
import { NOTE_PALETTE } from '@/lib/notes/palette'
import {
  type DrawableNoteKind,
  isDrawableNoteKind,
  NOTES_DELETE_GROUP_ACTION,
  NOTES_DELETE_NOTE_ACTION,
  NOTES_DRAW_FINISHED_ACTION,
  NOTES_HIDDEN_CHANGED_ACTION,
  NOTES_LOAD_ACTION,
  NOTES_MOVE_NOTE_ACTION,
  NOTES_SAVE_GROUP_ACTION,
  NOTES_SAVE_NOTE_ACTION,
  NOTES_SELECT_ACTION,
  NOTES_SNAPSHOT_ACTION,
  NOTES_START_DRAW_ACTION,
  type NotesMutationResponse,
  type NotesPatch,
  type NotesSnapshot,
} from '@/lib/notes/protocol'
import { type GeometryShard, shardIdForDate } from '@/lib/notes/shards'
import { createDefaultStyle } from '@/lib/notes/style_resolution'
import type { Note, NoteGeometry, NoteGroup, NoteKind } from '@/lib/notes/types'
import { setNotesHidden, toggleHiddenNoteId } from '@/lib/notes/visibility'
import { NOTES_PANEL_PREVIEW_MESSAGE, NOTES_PANEL_SHOW_NOTE_MESSAGE } from '@/lib/notes_panel/host'
import { CANCEL_POINT_PICKING_ACTION } from '@/lib/pick_point_action'
import { STORAGE_TOKEN_KEY, STORAGE_USER_KEY } from '@/lib/yandex/constants'

export type NotesPanelMode = 'list' | 'properties'

export type DrawableKind = DrawableNoteKind

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

/** Снимок с добавленной заметкой и её геометрией. Чистая функция — удобно сравнивать. */
const withNote = (snapshot: NotesSnapshot, note: Note, geometry: NoteGeometry): NotesSnapshot => {
  const shardId = shardIdForDate(note.date)
  const others = snapshot.manifest.notes.filter((item) => item.id !== note.id)

  return {
    ...snapshot,
    manifest: { ...snapshot.manifest, notes: [...others, note] },
    shards: shardId
      ? {
          ...snapshot.shards,
          [shardId]: {
            version: snapshot.shards[shardId]?.version ?? 1,
            updatedAt: new Date().toISOString(),
            notes: { ...(snapshot.shards[shardId]?.notes ?? {}), [note.id]: geometry },
          },
        }
      : snapshot.shards,
  }
}

/** Снимок без заметки. Геометрию не трогаем: она уедет вместе со снимком с Диска. */
const withoutNote = (snapshot: NotesSnapshot, noteId: string): NotesSnapshot => ({
  ...snapshot,
  manifest: {
    ...snapshot.manifest,
    notes: snapshot.manifest.notes.filter((item) => item.id !== noteId),
  },
})

/**
 * Геометрия из того, что нарисовал пользователь.
 *
 * Точка, линия и многоугольник приходят набором вершин; квадрат и круг —
 * двумя точками (углы и «центр → окружность»). Возвращает `null`, если по
 * нарисованному фигуру не построить: например, протяжка нулевой длины.
 */
export const geometryFromDrawCoords = (
  kind: DrawableKind,
  coords: [number, number][],
): NoteGeometry | null => {
  if (coords.length === 0) return null

  switch (kind) {
    case 'Point':
      return { kind: 'Point', coords: coords[0] }
    case 'Line':
      return coords.length >= 2 ? { kind: 'Line', coords } : null
    case 'Polygon':
      return coords.length >= 3 ? { kind: 'Polygon', coords } : null
    case 'Square': {
      const [start, end] = coords
      if (!start || !end) return null
      const corners = squareCornersFromDrag(start, end)
      // Вырожденная протяжка по одной оси не даёт квадрата.
      if (corners[0][0] === corners[1][0] || corners[0][1] === corners[1][1]) return null
      return { kind: 'Square', corners }
    }
    case 'Circle': {
      const [center, edge] = coords
      if (!center || !edge) return null
      const radiusMeters = distanceMeters(center, edge)
      if (!Number.isFinite(radiusMeters) || radiusMeters < 1) return null
      return { kind: 'Circle', center, radiusMeters }
    }
    default:
      return null
  }
}

/**
 * Наложение серверного снимка на локальный.
 *
 * Широковещательный снимок приходит уже после записи, но локально может быть
 * более свежая правка, которая ещё не улетела на Диск. Побеждает более свежий
 * `updatedAt`, иначе ответ сервера откатывал бы только что сделанное изменение.
 */
const mergeSnapshot = (incoming: NotesSnapshot, local: NotesSnapshot | null): NotesSnapshot => {
  if (!local) return incoming
  return {
    manifest: mergeManifests(incoming.manifest, local.manifest),
    shards: { ...local.shards, ...incoming.shards },
    hiddenIds: incoming.hiddenIds,
  }
}

const EMPTY_SNAPSHOT: NotesSnapshot = {
  manifest: { version: 1, updatedAt: new Date(0).toISOString(), groups: [], notes: [] },
  shards: {},
  hiddenIds: [],
}

/**
 * Состояние панели заметок.
 *
 * Панель — единственный владелец изменений: она собирает заметку целиком и
 * отправляет её в background, а background уже решает, как писать файлы.
 */
export const useNotesPanel = () => {
  const { t } = useLocale()
  const [snapshot, setSnapshot] = useState<NotesSnapshot | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<NotesPanelMode>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [drawingKind, setDrawingKind] = useState<DrawableKind | null>(null)
  const [undo, setUndo] = useState<{ note: Note; geometry: NoteGeometry } | null>(null)
  const saveTimer = useRef<number | null>(null)
  const pendingNote = useRef<{ note: Note; geometry: NoteGeometry } | null>(null)
  /**
   * Цепочка отправок.
   *
   * Дебаунс ограничивает частоту, но не запрещает вторую отправку, пока первая
   * ещё в пути. Две параллельные записи одного файла дают от Диска
   * `423 LOCKED`, поэтому запросы идут строго по одному.
   */
  const saveChain = useRef<Promise<unknown>>(Promise.resolve())
  const createNoteRef = useRef<((kind: DrawableKind, geometry: NoteGeometry) => void) | null>(null)

  const enqueueSaveMessage = useCallback(
    (
      message: Record<string, unknown>,
      handlers: {
        onSuccess: (response: NotesMutationResponse) => void
        onError: () => void
      },
    ) => {
      saveChain.current = saveChain.current
        .then(() => browser.runtime.sendMessage(message))
        .then((response: unknown) => {
          const parsed = response as NotesMutationResponse | undefined
          // `ok: false` — это тоже неудача: background вернул её вместо
          // исключения, и вызывающий код должен откатить своё состояние.
          if (parsed?.ok === false) {
            handlers.onError()
            return
          }
          handlers.onSuccess(parsed as NotesMutationResponse)
        })
        .catch(() => handlers.onError())
    },
    [],
  )

  /**
   * Показать состояние карте немедленно.
   *
   * Панель — iframe страницы карты, поэтому снимок можно отдать напрямую в
   * хост, не дожидаясь, пока background запишет файлы на Диск.
   */
  const postPreview = useCallback((next: NotesSnapshot) => {
    try {
      window.parent?.postMessage({ action: NOTES_PANEL_PREVIEW_MESSAGE, snapshot: next }, '*')
    } catch {
      // Кросс-доменный родитель — карта просто догонит широковещательным снимком.
    }
  }, [])

  /** Наложить патч на текущий снимок: манифест целиком, шарды — по одному. */
  const applyPatch = useCallback((patch: NotesPatch) => {
    setSnapshot((previous) =>
      previous
        ? {
            manifest: patch.manifest,
            shards: { ...previous.shards, ...patch.shards },
            hiddenIds: previous.hiddenIds,
          }
        : previous,
    )
  }, [])

  const applyMutation = useCallback(
    (response: NotesMutationResponse) => {
      if (!response.ok) {
        setError(response.error)
        return
      }
      applyPatch(response.patch)
      setError(null)
    },
    [applyPatch],
  )

  const flushSave = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const pending = pendingNote.current
    if (!pending) return
    pendingNote.current = null

    enqueueSaveMessage(
      {
        action: NOTES_SAVE_NOTE_ACTION,
        note: pending.note,
        geometry: pending.geometry,
      },
      {
        onSuccess: applyMutation,
        onError: () => setError(t('notesPanel.saveError')),
      },
    )
  }, [applyMutation, enqueueSaveMessage, t])

  const scheduleSave = useCallback(
    (note: Note, geometry: NoteGeometry) => {
      pendingNote.current = { note, geometry }
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS)
    },
    [flushSave],
  )

  // Загрузка: при монтировании, после входа и по кнопке «Повторить».
  const loadNotes = useCallback((options: { silent?: boolean } = {}) => {
    if (!options.silent) setStatus('loading')

    browser.runtime
      .sendMessage({ action: NOTES_LOAD_ACTION })
      .then((response: unknown) => {
        const payload = response as { ok?: boolean; error?: string; snapshot?: NotesSnapshot }
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
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  // Незаписанная правка не должна потеряться при закрытии панели.
  useEffect(() => () => flushSave(), [flushSave])

  /**
   * Вход в Яндекс меняет токен в `storage.local`.
   *
   * Панель живёт в постоянно смонтированном iframe, поэтому без этой
   * подписки она навсегда осталась бы в состоянии «Войдите в Яндекс».
   */
  useEffect(() => {
    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ): void => {
      if (area !== 'local') return
      if (!(STORAGE_TOKEN_KEY in changes) && !(STORAGE_USER_KEY in changes)) return

      const token = changes[STORAGE_TOKEN_KEY]?.newValue
      if (typeof token === 'string' && token) {
        loadNotes({ silent: true })
        return
      }
      setStatus('auth')
      setSnapshot(null)
    }

    browser.storage.onChanged.addListener(handleStorageChange)
    return () => browser.storage.onChanged.removeListener(handleStorageChange)
  }, [loadNotes])

  /**
   * Страховка на случай пропущенного события storage.
   *
   * Панель скрыта через `display: none` у контейнера, поэтому при показе
   * документ снова становится видимым — это хороший момент перечитать данные.
   */
  useEffect(() => {
    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') loadNotes({ silent: true })
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [loadNotes])

  /** Вход прямо из панели: токена нет, а карта открыта. */
  const login = useCallback(() => {
    setStatus('loading')
    browser.runtime
      .sendMessage({ action: 'login' })
      .then(() => loadNotes({ silent: true }))
      .catch(() => setStatus('auth'))
  }, [loadNotes])

  // Снимки и события карты.
  useEffect(() => {
    const handleMessage = (message: Record<string, unknown>) => {
      switch (message.action) {
        case NOTES_SNAPSHOT_ACTION: {
          const next = message.snapshot as NotesSnapshot | undefined
          if (next?.manifest) {
            setSnapshot((previous) => mergeSnapshot(next, previous))
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
          if (isDrawableNoteKind(kind) && Array.isArray(coords)) {
            const geometry = geometryFromDrawCoords(kind, coords as [number, number][])
            if (geometry) createNoteRef.current?.(kind, geometry)
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
    (kind: DrawableKind, geometry: NoteGeometry) => {
      const date = formatDateDisplay(new Date())
      const existingNames = (snapshot?.manifest.notes ?? []).map((note) => note.name)
      const name = buildAutoNoteName({
        date,
        kindLabel: t(kindLabelKey(kind)),
        existingNames,
      })

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

      // Оптимистичное создание: заметка появляется на карте и в списке сразу,
      // не дожидаясь Диска. Полный цикл записи — несколько сетевых round-trip,
      // и держать пользователя в ожидании после каждого клика по карте незачем.
      const optimistic = withNote(snapshot ?? EMPTY_SNAPSHOT, note, geometry)
      setSnapshot(optimistic)
      postPreview(optimistic)
      setSelectedId(note.id)
      setMode('properties')

      enqueueSaveMessage(
        { action: NOTES_SAVE_NOTE_ACTION, note, geometry },
        {
          onSuccess: (response) => {
            if (response.ok) applyPatch(response.patch)
          },
          onError: () => {
            // Не записалось — убираем заметку с карты и из списка, чтобы не
            // осталось призрака, которого нет на других устройствах.
            if (snapshot) {
              const reverted = withoutNote(snapshot, note.id)
              setSnapshot(reverted)
              postPreview(reverted)
            }
            setSelectedId(null)
            setMode('list')
            setError(t('notesPanel.createFailed'))
          },
        },
      )
    },
    [enqueueSaveMessage, postPreview, snapshot, t],
  )

  createNoteRef.current = createNote

  const updateNote = useCallback(
    (noteId: string, patch: Partial<Note>) => {
      const note = (snapshot?.manifest.notes ?? []).find((item) => item.id === noteId)
      const geometry = geometries[noteId]
      if (!note || !geometry) return

      const next: Note = { ...note, ...patch, updatedAt: new Date().toISOString() }

      if (snapshot) {
        // Правка видна на карте сразу: цвет, подпись и название не должны
        // ждать записи на Диск.
        const optimistic: NotesSnapshot = {
          ...snapshot,
          manifest: {
            ...snapshot.manifest,
            notes: snapshot.manifest.notes.map((item) => (item.id === noteId ? next : item)),
          },
        }
        setSnapshot(optimistic)
        postPreview(optimistic)
      }

      scheduleSave(next, geometry)
    },
    [geometries, postPreview, scheduleSave, snapshot],
  )

  const removeNote = useCallback(
    (noteId: string) => {
      const note = (snapshot?.manifest.notes ?? []).find((item) => item.id === noteId)
      const geometry = geometries[noteId]
      if (!note || !geometry) return

      // Удаление должно попасть в очередь после незаписанных правок:
      // иначе отложенное сохранение может вернуть уже удалённую заметку.
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      if (pendingNote.current?.note.id === noteId) {
        pendingNote.current = null
      }

      // Оптимистичное удаление: строка исчезает сразу, не дожидаясь Диска.
      // Если запись не пройдёт, заметка вернётся на место с сообщением об ошибке.
      if (snapshot) {
        const optimistic = withoutNote(snapshot, noteId)
        setSnapshot(optimistic)
        postPreview(optimistic)
      }
      setSelectedId(null)
      setMode('list')
      setUndo({ note, geometry })
      window.setTimeout(() => setUndo(null), UNDO_TIMEOUT_MS)

      enqueueSaveMessage(
        { action: NOTES_DELETE_NOTE_ACTION, noteId, date: note.date },
        {
          onSuccess: (response) => {
            // Манифест с Диска — источник истины; локальная копия уже без заметки.
            if (response.ok) applyPatch(response.patch)
          },
          onError: () => {
            if (snapshot) {
              const restored = withNote(snapshot, note, geometry)
              setSnapshot(restored)
              postPreview(restored)
            }
            setUndo(null)
            setError(t('notesPanel.saveError'))
          },
        },
      )
    },
    [enqueueSaveMessage, geometries, postPreview, snapshot, t],
  )

  const undoRemove = useCallback(() => {
    if (!undo) return

    if (snapshot) {
      const restored = withNote(snapshot, undo.note, undo.geometry)
      setSnapshot(restored)
      postPreview(restored)
    }
    setUndo(null)

    enqueueSaveMessage(
      { action: NOTES_SAVE_NOTE_ACTION, note: undo.note, geometry: undo.geometry },
      {
        onSuccess: (response) => {
          if (response.ok) applyPatch(response.patch)
        },
        onError: () => {
          if (snapshot) {
            const reverted = withoutNote(snapshot, undo.note.id)
            setSnapshot(reverted)
            postPreview(reverted)
          }
          setError(t('notesPanel.saveError'))
        },
      },
    )
  }, [enqueueSaveMessage, postPreview, snapshot, t, undo])

  const selectNote = useCallback((noteId: string | null) => {
    setSelectedId(noteId)
    setMode(noteId ? 'properties' : 'list')
    browser.runtime.sendMessage({ action: NOTES_SELECT_ACTION, noteId }).catch(() => {})
  }, [])

  /**
   * Показать заметку на карте.
   *
   * Это навигация, а не редактирование: карта центрируется на объекте, но
   * выбранная заметка не меняется и свойства не открываются.
   */
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
    },
    [geometryOf],
  )

  /** Применить новый набор скрытых: состояние и карта обновляются одним сообщением. */
  const commitHiddenIds = useCallback((hiddenIds: string[]) => {
    setSnapshot((previous) => (previous ? { ...previous, hiddenIds } : previous))
    browser.runtime.sendMessage({ action: NOTES_HIDDEN_CHANGED_ACTION, hiddenIds }).catch(() => {})
  }, [])

  const toggleHidden = useCallback(
    (noteId: string) => {
      const current = snapshot?.hiddenIds ?? []
      commitHiddenIds(toggleHiddenNoteId(current, noteId))
    },
    [commitHiddenIds, snapshot?.hiddenIds],
  )

  /**
   * Переключить видимость группы.
   *
   * Правило как у чекбокса «выбрать всё»: если видно хотя бы что-то, скрываем
   * всю группу, иначе показываем всю. Иначе при частично скрытой группе первый
   * клик оставлял бы половину объектов на карте.
   */
  const toggleGroupHidden = useCallback(
    (noteIds: readonly string[], visibility: GroupVisibility) => {
      const current = snapshot?.hiddenIds ?? []
      commitHiddenIds(setNotesHidden(current, noteIds, visibility !== 'hidden'))
    },
    [commitHiddenIds, snapshot?.hiddenIds],
  )

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

  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>([])

  const toggleGroupCollapsed = useCallback((groupId: string | null) => {
    const key = collapseKey(groupId)
    setCollapsedGroupIds((previous) =>
      previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key],
    )
  }, [])

  /** Сохранить группу: создание и переименование — один и тот же запрос. */
  const saveGroup = useCallback(
    (group: NoteGroup) => {
      if (snapshot) {
        const groups = snapshot.manifest.groups.some((item) => item.id === group.id)
          ? snapshot.manifest.groups.map((item) => (item.id === group.id ? group : item))
          : [...snapshot.manifest.groups, group]
        const optimistic: NotesSnapshot = {
          ...snapshot,
          manifest: { ...snapshot.manifest, groups },
        }
        setSnapshot(optimistic)
      }

      enqueueSaveMessage(
        { action: NOTES_SAVE_GROUP_ACTION, group },
        {
          onSuccess: (response) => {
            if (response.ok) applyPatch(response.patch)
          },
          onError: () => {
            // Группу не сохранили — возвращаем список групп с Диска.
            setError(t('notesPanel.saveError'))
            loadNotes({ silent: true })
          },
        },
      )
    },
    [enqueueSaveMessage, loadNotes, snapshot, t],
  )

  const createGroup = useCallback(
    (name: string): NoteGroup => {
      const timestamp = new Date().toISOString()
      const order = (snapshot?.manifest.groups ?? []).reduce(
        (max, group) => Math.max(max, group.order),
        -1,
      )
      const group: NoteGroup = {
        id: crypto.randomUUID(),
        name: name.trim(),
        color: NOTE_PALETTE[(snapshot?.manifest.groups.length ?? 0) % NOTE_PALETTE.length],
        order: order + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      saveGroup(group)
      return group
    },
    [saveGroup, snapshot?.manifest.groups],
  )

  const renameGroup = useCallback(
    (groupId: string, name: string) => {
      const group = (snapshot?.manifest.groups ?? []).find((item) => item.id === groupId)
      if (!group) return
      saveGroup({ ...group, name: name.trim(), updatedAt: new Date().toISOString() })
    },
    [saveGroup, snapshot?.manifest.groups],
  )

  const recolorGroup = useCallback(
    (groupId: string, color: string) => {
      const group = (snapshot?.manifest.groups ?? []).find((item) => item.id === groupId)
      if (!group) return
      saveGroup({ ...group, color, updatedAt: new Date().toISOString() })
    },
    [saveGroup, snapshot?.manifest.groups],
  )

  /**
   * Удалить группу.
   *
   * `keepNotes` распускает её: заметки остаются на карте и уходят в корень.
   * `cascade` удаляет и заметки — это выбор пользователя в диалоге.
   */
  const removeGroup = useCallback(
    (groupId: string, mode: 'keepNotes' | 'cascade') => {
      if (snapshot) {
        const optimistic: NotesSnapshot = {
          ...snapshot,
          manifest: {
            ...snapshot.manifest,
            groups: snapshot.manifest.groups.filter((group) => group.id !== groupId),
            notes:
              mode === 'cascade'
                ? snapshot.manifest.notes.filter((note) => note.groupId !== groupId)
                : snapshot.manifest.notes.map((note) =>
                    note.groupId === groupId ? { ...note, groupId: null } : note,
                  ),
          },
        }
        setSnapshot(optimistic)
        postPreview(optimistic)
      }

      enqueueSaveMessage(
        { action: NOTES_DELETE_GROUP_ACTION, groupId, mode },
        {
          onSuccess: (response) => {
            if (response.ok) applyPatch(response.patch)
          },
          onError: () => {
            setError(t('notesPanel.saveError'))
            loadNotes({ silent: true })
          },
        },
      )
    },
    [enqueueSaveMessage, loadNotes, postPreview, snapshot, t],
  )

  /** Перенести заметку в группу или в корень. */
  const moveNoteToGroup = useCallback(
    (noteId: string, groupId: string | null) => {
      const note = (snapshot?.manifest.notes ?? []).find((item) => item.id === noteId)
      if (!note) return

      if (snapshot) {
        const optimistic: NotesSnapshot = {
          ...snapshot,
          manifest: {
            ...snapshot.manifest,
            notes: snapshot.manifest.notes.map((item) =>
              item.id === noteId ? { ...item, groupId, updatedAt: new Date().toISOString() } : item,
            ),
          },
        }
        setSnapshot(optimistic)
      }

      enqueueSaveMessage(
        { action: NOTES_MOVE_NOTE_ACTION, noteId, groupId },
        {
          onSuccess: (response) => {
            if (response.ok) applyPatch(response.patch)
          },
          onError: () => {
            setError(t('notesPanel.saveError'))
            loadNotes({ silent: true })
          },
        },
      )
    },
    [enqueueSaveMessage, loadNotes, snapshot, t],
  )

  return {
    t,
    status,
    loadNotes,
    login,
    error,
    mode,
    setMode,
    query,
    setQuery,
    notes: filteredNotes,
    groups,
    collapsedGroupIds,
    toggleGroupCollapsed,
    createGroup,
    renameGroup,
    recolorGroup,
    removeGroup,
    moveNoteToGroup,
    hiddenIds: snapshot?.hiddenIds ?? [],
    selectedNote,
    selectedId,
    selectNote,
    locateNote,
    toggleHidden,
    toggleGroupHidden,
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
