import { type ReactNode, useEffect, useState } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { NOTE_PALETTE } from '@/lib/notes/model/palette'

/**
 * Выбор цвета заметки: фиксированная палитра плюс свой цвет.
 *
 * `children` рисуются под палитрой в той же рамке — сюда встают настройки,
 * которые берут этот же цвет (заливка).
 */
export const ColorPicker = ({
  value,
  onChange,
  label,
  children,
}: {
  value: string | null
  onChange: (color: string) => void
  label: string
  children?: ReactNode
}) => {
  const { t } = useLocale()
  const [custom, setCustom] = useState(value ?? NOTE_PALETTE[0])

  useEffect(() => {
    if (value) setCustom(value)
  }, [value])

  return (
    <fieldset className="notes-panel__field-group notes-panel__field-group--color">
      <legend className="notes-panel__field-group-title">{label}</legend>
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
      {children}
    </fieldset>
  )
}
