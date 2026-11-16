import { useReducer } from 'react'
import { notesPanelReducer } from '@/lib/notes/panel/reducer'
import { initialNotesPanelState } from '@/lib/notes/panel/state'

/**
 * Состояние панели одним редьюсером.
 *
 * Хуки ниже получают эту пару и не держат собственных копий снимка: иначе
 * появлялись бы расхождения вроде «заметка есть в списке, но не на карте».
 */
export const useNotesPanelState = () => {
  const [state, dispatch] = useReducer(notesPanelReducer, initialNotesPanelState)
  return { state, dispatch }
}

export type NotesPanelStore = ReturnType<typeof useNotesPanelState>
