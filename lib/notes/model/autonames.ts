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
