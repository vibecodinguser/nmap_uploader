import { useLocale } from '@/hooks/useLocale'
import type { DrawableNoteKind } from '@/lib/notes/protocol'
import { useNoteGroups } from './notes_panel/useNoteGroups'
import { useNoteRemoval } from './notes_panel/useNoteRemoval'
import { useNotesDrawing } from './notes_panel/useNotesDrawing'
import { useNotesMutations } from './notes_panel/useNotesMutations'
import { useNotesPanelState } from './notes_panel/useNotesPanelState'
import { useNotesSync } from './notes_panel/useNotesSync'
import { useNotesView } from './notes_panel/useNotesView'
import { useNotesWrites } from './notes_panel/useNotesWrites'

export type { NotesPanelMode } from '@/lib/notes/panel/state'
export type DrawableKind = DrawableNoteKind

/**
 * Состояние панели заметок.
 *
 * Панель — единственный владелец изменений: она собирает заметку целиком и
 * отправляет её в background, а background уже решает, как писать файлы.
 *
 * Хук собирает пять частей: состояние (редьюсер), запись (очередь и дебаунс),
 * вид (список, поиск, навигация), мутации (заметки и группы) и синхронизацию
 * (загрузка, подписки, вход). Порядок сборки важен: синхронизации нужен
 * `createNote`, группам — `loadNotes`.
 */
export const useNotesPanel = () => {
  const { t } = useLocale()
  const store = useNotesPanelState()
  const writes = useNotesWrites(store)
  const view = useNotesView(store)
  const mutations = useNotesMutations(store, writes)
  const removal = useNoteRemoval(store, writes)
  const sync = useNotesSync(store, mutations.createNote)
  const groups = useNoteGroups(store, writes, () => sync.loadNotes({ silent: true }))
  const drawing = useNotesDrawing(store)

  return {
    t,
    status: store.state.status,
    error: store.state.error,
    undo: store.state.undo,
    loadNotes: sync.loadNotes,
    login: sync.login,
    ...view,
    ...mutations,
    ...removal,
    ...groups,
    ...drawing,
  }
}
