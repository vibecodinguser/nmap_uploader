type PointDateFieldProps = {
  id: string
  name?: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}

export const PointDateField = ({
  id,
  name = 'date',
  value,
  disabled = false,
  onChange,
}: PointDateFieldProps) => (
  <div className="coords-field coords-field--date">
    <label htmlFor={id}>Дата заметки</label>
    <input
      type="date"
      id={id}
      name={name}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
)
