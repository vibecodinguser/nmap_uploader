/**
 * Автоматическое имя заметки: «дд.мм.гггг + вид объекта».
 *
 * Подпись вида приходит снаружи: имя формируется на языке интерфейса, а не
 * на языке модели.
 */
export const buildAutoNoteName = ({
  date,
  kindLabel,
  existingNames,
}: {
  /** Дата в формате DD-MM-YYYY. */
  date: string
  kindLabel: string
  /** Названия всех заметок — по ним подбирается номер. */
  existingNames: readonly string[]
}): string => {
  const base = `${date} ${kindLabel}`.trim()
  const taken = new Set(existingNames.map((name) => name.trim()))

  if (!taken.has(base)) return base

  let index = 2
  while (taken.has(`${base} ${index}`)) {
    index += 1
  }
  return `${base} ${index}`
}

/** Имя для показа: своё название, иначе автоимя. */
export const displayNoteName = (note: {
  name: string
  date: string
  kindLabel: string
  existingNames?: readonly string[]
}): string =>
  note.name.trim() ||
  buildAutoNoteName({
    date: note.date,
    kindLabel: note.kindLabel,
    existingNames: note.existingNames ?? [],
  })
