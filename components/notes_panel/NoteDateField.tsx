import { useEffect, useState } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { formatDateDisplayInput, isValidDisplayDate } from '@/lib/date_format'

/**
 * Поле даты заметки.
 *
 * Дата правится как текст: пользователь может набрать её по частям, а не
 * только выбрать из календаря. Неверная дата не применяется, но и не стирает
 * ввод — иначе набор «1» тут же отбрасывался бы.
 *
 * Месяц даты определяет шард геометрии, поэтому невалидное значение нельзя
 * молча превращать в «сегодня».
 */
export const NoteDateField = ({
  date,
  onCommit,
}: {
  date: string
  onCommit: (date: string) => void
}) => {
  const { t } = useLocale()
  const [draft, setDraft] = useState(date)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    setDraft(date)
    setTouched(false)
  }, [date])

  const valid = isValidDisplayDate(draft)

  const commit = (): void => {
    setTouched(true)
    if (valid && draft !== date) onCommit(draft)
  }

  return (
    <label className="notes-panel__field">
      <span className="notes-panel__field-label">{t('notesPanel.date')}</span>
      <input
        className="notes-panel__input"
        value={draft}
        inputMode="numeric"
        placeholder="дд.мм.гггг"
        onChange={(event) => {
          setDraft(formatDateDisplayInput(event.target.value))
          setTouched(true)
        }}
        onBlur={commit}
      />
      {touched && !valid && (
        <span className="notes-panel__hint notes-panel__hint--error">
          {t('notesPanel.dateInvalid')}
        </span>
      )}
    </label>
  )
}
