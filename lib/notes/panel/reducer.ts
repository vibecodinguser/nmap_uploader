import { mergeManifests } from '../model/manifest'
import type { Note, NoteGeometry, NoteGroup, NoteKind } from '../model/types'
import type { NotesPatch, NotesSnapshot } from '../protocol'
import { replaceNote, withGroup, withNote, withNoteGroup, withoutGroup, withoutNote } from './edits'
import type {
  GroupDeleteMode,
  NotesPanelMode,
  NotesPanelState,
  NotesPanelStatus,
  UndoEntry,
} from './state'

/**
 * Действия панели.
 *
 * Названия говорят о том, что произошло, а не что нарисовать: `noteRemoved`,
 * а не `setSnapshot`. Так одно действие одинаково понимают оптимистичный
 * сценарий и ответ Диска.
 */
export type NotesPanelAction =
  | { type: 'loaded'; snapshot: NotesSnapshot }
  | { type: 'merged'; snapshot: NotesSnapshot }
  | { type: 'statusChanged'; status: NotesPanelStatus }
  | { type: 'errorChanged'; error: string | null }
  | { type: 'modeChanged'; mode: NotesPanelMode }
  | { type: 'noteSelected'; noteId: string | null }
  | { type: 'queryChanged'; query: string }
  | { type: 'noteAdded'; note: Note; geometry: NoteGeometry }
  | { type: 'notePatched'; note: Note }
  | { type: 'noteRemoved'; noteId: string }
  | { type: 'noteRestored'; entry: UndoEntry }
  | { type: 'patchApplied'; patch: NotesPatch }
  | { type: 'groupSaved'; group: NoteGroup }
  | { type: 'groupRemoved'; groupId: string; mode: GroupDeleteMode }
  | { type: 'noteMoved'; noteId: string; groupId: string | null; updatedAt: string }
  | { type: 'hiddenChanged'; hiddenIds: string[] }
  | { type: 'drawingStarted'; kind: NoteKind }
  | { type: 'drawingStopped' }
  | { type: 'undoSet'; entry: UndoEntry }
  | { type: 'undoCleared' }
  | { type: 'groupCollapsedToggled'; key: string }
  | { type: 'snapshotCleared' }

/**
 * Слияние широковещательного снимка с локальным.
 *
 * Снимок приходит уже после записи, но локально может быть более свежая
 * правка, которая ещё не улетела на Диск. Побеждает более свежий `updatedAt`,
 * иначе ответ сервера откатывал бы только что сделанное изменение.
 */
const mergeSnapshot = (incoming: NotesSnapshot, local: NotesSnapshot | null): NotesSnapshot => {
  if (!local) return incoming
  return {
    manifest: mergeManifests(incoming.manifest, local.manifest),
    shards: { ...local.shards, ...incoming.shards },
    hiddenIds: incoming.hiddenIds,
  }
}

/**
 * Наложение патча ответа Диска.
 *
 * Манифест сливается по `updatedAt`, а не заменяется: ответ несёт состояние
 * Диска на момент записи, а в панели к этому времени может быть более свежая
 * правка — следующая порция набранного текста или правка другой заметки.
 * Замена возвращала бы поле к предыдущему значению, пока не доедет следующий
 * ответ: пользователь видел «прыжок назад и возврат».
 */
const withPatch = (snapshot: NotesSnapshot, patch: NotesPatch): NotesSnapshot => ({
  ...snapshot,
  manifest: mergeManifests(patch.manifest, snapshot.manifest),
  shards: { ...snapshot.shards, ...patch.shards },
})

export const notesPanelReducer = (
  state: NotesPanelState,
  action: NotesPanelAction,
): NotesPanelState => {
  switch (action.type) {
    case 'loaded':
      return { ...state, snapshot: action.snapshot, status: 'ready', error: null }

    case 'merged':
      return {
        ...state,
        snapshot: mergeSnapshot(action.snapshot, state.snapshot),
        status: 'ready',
      }

    case 'statusChanged':
      return { ...state, status: action.status }

    case 'errorChanged':
      return { ...state, error: action.error }

    case 'modeChanged':
      return { ...state, mode: action.mode }

    case 'noteSelected':
      return {
        ...state,
        selectedId: action.noteId,
        mode: action.noteId ? 'properties' : 'list',
      }

    case 'queryChanged':
      return { ...state, query: action.query }

    case 'noteAdded':
      return state.snapshot
        ? {
            ...state,
            snapshot: withNote(state.snapshot, action.note, action.geometry),
            selectedId: action.note.id,
            mode: 'properties',
          }
        : state

    case 'notePatched':
      return state.snapshot
        ? { ...state, snapshot: replaceNote(state.snapshot, action.note) }
        : state

    case 'noteRemoved':
      return state.snapshot
        ? {
            ...state,
            snapshot: withoutNote(state.snapshot, action.noteId),
            selectedId: null,
            mode: 'list',
          }
        : state

    case 'noteRestored':
      return state.snapshot
        ? {
            ...state,
            snapshot: withNote(state.snapshot, action.entry.note, action.entry.geometry),
            undo: null,
          }
        : { ...state, undo: null }

    case 'patchApplied':
      return state.snapshot
        ? { ...state, snapshot: withPatch(state.snapshot, action.patch) }
        : state

    case 'groupSaved':
      return state.snapshot
        ? { ...state, snapshot: withGroup(state.snapshot, action.group) }
        : state

    case 'groupRemoved':
      return state.snapshot
        ? {
            ...state,
            snapshot: withoutGroup(state.snapshot, action.groupId, action.mode),
            selectedId: null,
            mode: 'list',
          }
        : state

    case 'noteMoved':
      return state.snapshot
        ? {
            ...state,
            snapshot: withNoteGroup(
              state.snapshot,
              action.noteId,
              action.groupId,
              action.updatedAt,
            ),
          }
        : state

    case 'hiddenChanged':
      return state.snapshot
        ? { ...state, snapshot: { ...state.snapshot, hiddenIds: action.hiddenIds } }
        : state

    case 'drawingStarted':
      return { ...state, drawingKind: action.kind }

    case 'drawingStopped':
      return { ...state, drawingKind: null }

    case 'undoSet':
      return { ...state, undo: action.entry }

    case 'undoCleared':
      return { ...state, undo: null }

    case 'groupCollapsedToggled':
      return {
        ...state,
        collapsedGroupIds: state.collapsedGroupIds.includes(action.key)
          ? state.collapsedGroupIds.filter((item) => item !== action.key)
          : [...state.collapsedGroupIds, action.key],
      }

    case 'snapshotCleared':
      return { ...state, snapshot: null, selectedId: null, undo: null, mode: 'list' }

    default:
      return state
  }
}
