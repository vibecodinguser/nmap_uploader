import type { ReactNode } from 'react'

type SettingsToggleRowProps = Readonly<{
  id: string
  title: string
  ariaLabel: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
  children?: ReactNode
}>

export const SettingsToggleRow = ({
  id,
  title,
  ariaLabel,
  checked,
  disabled,
  onChange,
  children,
}: SettingsToggleRowProps) => {
  return (
    <section className="settings-section" aria-labelledby={`${id}-heading`}>
      <div className="settings-toggle-row">
        <h3 id={`${id}-heading`} className="settings-section-title">
          {title}
        </h3>
        <label className="settings-toggle" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            role="switch"
            className="settings-toggle-input"
            checked={checked}
            aria-checked={checked}
            disabled={disabled}
            aria-label={ariaLabel}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="settings-toggle-track" aria-hidden="true">
            <span className="settings-toggle-thumb" />
          </span>
        </label>
      </div>
      {children}
    </section>
  )
}
