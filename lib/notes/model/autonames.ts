/**
 * Свободное имя из основы.
 *
 * Если основа занята, добавляется номер: «Новая группа», «Новая группа 2»,
 * «Новая группа 3». Номер ищется с двойки и берётся первый свободный, поэтому
 * дырка в середине не мешает: при занятых «…» и «… 3» получится «… 2».
 *
 * Сравнение по точному совпадению после `trim`: имена с лишними пробелами —
 * тот же пользовательский ввод, и второй «Новая группа » рядом с «Новая
 * группа» читался бы как дубль.
 */
export const uniqueName = (base: string, existingNames: readonly string[]): string => {
  const trimmedBase = base.trim()
  const taken = new Set(existingNames.map((name) => name.trim()))

  if (!taken.has(trimmedBase)) return trimmedBase

  let index = 2
  while (taken.has(`${trimmedBase} ${index}`)) {
    index += 1
  }
  return `${trimmedBase} ${index}`
}

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
}): string => uniqueName(`${date} ${kindLabel}`, existingNames)

/**
 * Имя новой группы.
 *
 * Группа создаётся кнопкой без диалога, поэтому имя приходит готовой подписью
 * («Новая группа»), а номер добавляется здесь же — иначе третья группа подряд
 * называлась бы так же, как первая, и в списке было бы не отличить одну от
 * другой.
 */
export const buildAutoGroupName = ({
  baseName,
  existingNames,
}: {
  /** Подпись из интерфейса: «Новая группа». */
  baseName: string
  existingNames: readonly string[]
}): string => uniqueName(baseName, existingNames)
