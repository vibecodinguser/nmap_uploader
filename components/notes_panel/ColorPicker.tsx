import { useEffect, useState } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { NOTE_PALETTE } from '@/lib/notes/model/palette'

/** Выбор цвета заметки: фиксированная палитра плюс свой цвет. */
export const ColorPicker = ({
  value,
  onChange,
  label,
}: {
  value: string | null
  onChange: (color: string) => void
  label: string
}) => {
  const { t } = useLocale()
  const [custom, setCustom] = useState(value ?? NOTE_PALETTE[0])

  useEffect(() => {
    if (value) setCustom(value)
  }, [value])

  return (
    <div className="notes-panel__field notes-panel__field--wide">
      <span className="notes-panel__field-label">{label}</span>
      <div className="notes-panel__colors">
        {NOTE_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className="notes-panel__color"
            data-active={value?.toLowerCase() === color.toLowerCase()}
            style={{ backgroundColor: color }}
            aria-label={color}
            aria-pressed={value?.toLowerCase() === color.toLowerCase()}
            onClick={() => onChange(color)}
          />
        ))}
        <label
          className="notes-panel__color notes-panel__color--custom"
          title={t('notesPanel.color')}
        >
          <input
            type="color"
            value={custom}
            onChange={(event) => {
              setCustom(event.target.value)
              onChange(event.target.value)
            }}
          />
        </label>
      </div>
    </div>
  )
}
