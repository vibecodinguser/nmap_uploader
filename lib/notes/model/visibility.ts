/**
 * Скрытие заметок.
 *
 * Скрытие — режим просмотра «у меня сейчас», а не свойство заметки: правила
 * работы с набором скрытых id чистые, а хранилище — в `storage/hidden_ids.ts`.
 */

export const toggleHiddenNoteId = (ids: readonly string[], id: string): string[] => {
  const next = new Set(ids)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  return [...next]
}

/** Скрыть или показать сразу набор заметок (группа, результат поиска). */
export const setNotesHidden = (
  ids: readonly string[],
  targets: readonly string[],
  hidden: boolean,
): string[] => {
  const next = new Set(ids)
  for (const id of targets) {
    if (hidden) next.add(id)
    else next.delete(id)
  }
  return [...next]
}
