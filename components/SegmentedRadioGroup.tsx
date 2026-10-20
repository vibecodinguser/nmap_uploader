type Option<T extends string> = Readonly<{
  value: T
  label: string
}>

type SegmentedRadioGroupProps<T extends string> = Readonly<{
  name: string
  ariaLabel: string
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
}>

export const SegmentedRadioGroup = <T extends string>({
  name,
  ariaLabel,
  value,
  options,
  onChange,
}: SegmentedRadioGroupProps<T>) => {
  return (
    <div className="theme-mode-switch" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <label key={option.value} className="theme-mode-switch-option">
          <input
            type="radio"
            name={name}
            value={option.value}
            className="theme-mode-switch-input"
            checked={value === option.value}
            onChange={(e) => onChange(e.target.value as T)}
          />
          <span className="theme-mode-switch-label">{option.label}</span>
        </label>
      ))}
    </div>
  )
}
