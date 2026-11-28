import { mergeManifests } from '../model/manifest'
import type { Note, NoteGeometry, NoteGroup, NoteKind } from '../model/types'
import type { NotesPatch, NotesSnapshot } from '../protocol'
import { replaceNote, withGroup, withNote, withNoteGroup, withoutGroup, withoutNote } from './edits'
import { GROUP_FILTER_ALL, type NotesFilter } from './filters'
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
type NotesPanelAction =
  | { type: 'loaded'; snapshot: NotesSnapshot }
  | { type: 'merged'; snapshot: NotesSnapshot }
  | { type: 'statusChanged'; status: NotesPanelStatus }
  | { type: 'errorChanged'; error: string | null }
  | { type: 'modeChanged'; mode: NotesPanelMode }
  | { type: 'noteSelected'; noteId: string | null }
  | { type: 'queryChanged'; query: string }
  | { type: 'noteChecked'; noteId: string; checked: boolean }
  | { type: 'checkedCleared' }
  | { type: 'checkedReplaced'; noteIds: string[] }
  | { type: 'checkedRemoved'; noteIds: readonly string[] }
  | { type: 'notesRemoved'; noteIds: readonly string[] }
  | { type: 'notesMoved'; noteIds: readonly string[]; groupId: string | null; updatedAt: string }
  | { type: 'filtersChanged'; filters: Partial<NotesFilter> }
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
  | { type: 'collapsedKeysRestored'; keys: string[] }
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

/**
 * Снимает выбор, если заметки больше нет в снимке.
 *
 * Панель может остаться в режиме свойств с id, которого нет в манифесте:
 * заметку удалили на другом устройстве или сменился аккаунт. Тогда ни список,
 * ни карточка не рисуются, и панель выглядит пустой.
 */
const pruneSelection = (
  snapshot: NotesSnapshot,
  selectedId: string | null,
): Pick<NotesPanelState, 'selectedId' | 'mode'> => {
  if (selectedId === null) return { selectedId: null, mode: 'list' }
  const exists = snapshot.manifest.notes.some((note) => note.id === selectedId)
  return exists ? { selectedId, mode: 'properties' } : { selectedId: null, mode: 'list' }
}

export const notesPanelReducer = (
  state: NotesPanelState,
  action: NotesPanelAction,
): NotesPanelState => {
  switch (action.type) {
    case 'loaded':
      return {
        ...state,
        snapshot: action.snapshot,
        status: 'ready',
        error: null,
        // Заметку могли удалить на другом устройстве: выбранный id тогда
        // указывает в пустоту, и карточка свойств не рисуется — панель
        // выглядит пустой. Свежий снимок — единственный источник правды.
        ...pruneSelection(action.snapshot, state.selectedId),
      }

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

    case 'noteChecked':
      return {
        ...state,
        checkedIds: action.checked
          ? [...new Set([...state.checkedIds, action.noteId])]
          : state.checkedIds.filter((id) => id !== action.noteId),
      }

    case 'checkedCleared':
      return { ...state, checkedIds: [] }

    case 'checkedReplaced':
      return { ...state, checkedIds: [...new Set(action.noteIds)] }

    case 'checkedRemoved': {
      const gone = new Set(action.noteIds)
      return { ...state, checkedIds: state.checkedIds.filter((id) => !gone.has(id)) }
    }

    case 'filtersChanged':
      return { ...state, filters: { ...state.filters, ...action.filters } }

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

    case 'notesRemoved': {
      if (!state.snapshot) return { ...state, checkedIds: [] }
      const gone = new Set(action.noteIds)
      return {
        ...state,
        snapshot: {
          ...state.snapshot,
          manifest: {
            ...state.snapshot.manifest,
            notes: state.snapshot.manifest.notes.filter((note) => !gone.has(note.id)),
          },
        },
        selectedId: gone.has(state.selectedId ?? '') ? null : state.selectedId,
        mode: gone.has(state.selectedId ?? '') ? 'list' : state.mode,
        checkedIds: [],
      }
    }

    case 'notesMoved': {
      if (!state.snapshot) return state
      const targets = new Set(action.noteIds)
      return {
        ...state,
        snapshot: {
          ...state.snapshot,
          manifest: {
            ...state.snapshot.manifest,
            notes: state.snapshot.manifest.notes.map((note) =>
              targets.has(note.id)
                ? { ...note, groupId: action.groupId, updatedAt: action.updatedAt }
                : note,
            ),
          },
        },
      }
    }

    case 'noteRemoved':
      return state.snapshot
        ? {
            ...state,
            snapshot: withoutNote(state.snapshot, action.noteId),
            selectedId: null,
            mode: 'list',
            checkedIds: state.checkedIds.filter((id) => id !== action.noteId),
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
            /*
             * Фильтр на удалённую группу больше ничего не значит, а в дропдауне
             * выглядел как «Все группы» — при пустом списке. Сбрасываем его,
             * чтобы подпись фильтра и содержимое списка говорили одно и то же.
             */
            filters:
              state.filters.group === action.groupId
                ? { ...state.filters, group: GROUP_FILTER_ALL }
                : state.filters,
            // Отметки могли относиться к удалённым каскадом заметкам.
            checkedIds: state.checkedIds.filter((id) =>
              state.snapshot?.manifest.notes.some(
                (note) =>
                  note.id === id && (action.mode !== 'cascade' || note.groupId !== action.groupId),
              ),
            ),
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

    /*
     * Замена списка целиком, а не добавление: сохранённое состояние уже
     * прочитано с диска, и наложение на пустой список дало бы то же самое, но
     * в обратном порядке и без защиты от дублей.
     */
    case 'collapsedKeysRestored':
      return { ...state, collapsedGroupIds: action.keys }

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
