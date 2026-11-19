import { useEffect, useRef } from 'react'
import { pruneCollapsedKeys } from '@/lib/notes/panel/rows'
import {
  readCollapsedGroupKeys,
  writeCollapsedGroupKeys,
} from '@/lib/notes/storage/collapsed_groups'
import type { NotesPanelStore } from './useNotesPanelState'

/**
 * Свёрнутость групп переживает перезапуск панели.
 *
 * Читается один раз при монтировании: до этого момента запись запрещена
 * флагом `restored`. Без него первый же прогон эффекта записал бы пустой список
 * поверх сохранённого — панель открывается с пустым состоянием, а чтение с
 * диска асинхронное.
 *
 * Запись чистится от id удалённых групп. Зависимость от `groupIds`, а не только
 * от свёрнутости: после роспуска группы её id больше не должен висеть в
 * настройках, хотя сам список свёрнутых не менялся.
 */
export const useCollapsedGroupsPersistence = ({ state, dispatch }: NotesPanelStore) => {
  const restored = useRef(false)
  const groups = state.snapshot?.manifest.groups ?? []
  const groupIds = groups.map((group) => group.id)
  /*
   * Зависимость — строка id, а не сам манифест: снимок меняется от любой
   * правки заметки, и запись в `storage.local` шла бы на каждое изменение.
   * Список групп меняется куда реже.
   */
  const groupIdsKey = groupIds.join('|')
  const groupsLoaded = state.snapshot !== null

  useEffect(() => {
    let cancelled = false

    readCollapsedGroupKeys()
      .then((keys) => {
        if (cancelled) return
        dispatch({ type: 'collapsedKeysRestored', keys })
      })
      .catch(() => {
        // Свёрнутость — украшение: без неё группы раскроются сами, это не ошибка.
      })
      .finally(() => {
        restored.current = true
      })

    return () => {
      cancelled = true
    }
  }, [dispatch])

  useEffect(() => {
    if (!restored.current) return
    // Пока снимок не пришёл, состав групп неизвестен, и чистка выбросила бы
    // все id — сохранённое состояние потерялось бы при каждом запуске.
    if (!groupsLoaded) return

    writeCollapsedGroupKeys(pruneCollapsedKeys(state.collapsedGroupIds, groupIds)).catch(() => {})
  }, [state.collapsedGroupIds, groupIdsKey, groupsLoaded])
}
