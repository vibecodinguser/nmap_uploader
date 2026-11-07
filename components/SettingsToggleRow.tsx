import type { ReactNode } from 'react'

type SettingsToggleRowProps = Readonly<{
  id: string
  title: string
  ariaLabel: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
  children?: ReactNode
  /** `card` — самостоятельная карточка настроек, `plain` — строка внутри общей секции. */
  variant?: 'card' | 'plain'
}>

export const SettingsToggleRow = ({
  id,
  title,
  ariaLabel,
  checked,
  disabled,
  onChange,
  children,
  variant = 'card',
}: SettingsToggleRowProps) => {
  const headingId = `${id}-heading`
  const HeadingTag = variant === 'card' ? 'h3' : 'h4'

  const content = (
    <>
      <div className="settings-toggle-row">
        <HeadingTag id={headingId} className="settings-section-title">
          {title}
        </HeadingTag>
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
    </>
  )

  if (variant === 'plain') {
    return <div className="settings-toggle-item">{content}</div>
  }

  return (
    <section className="settings-section" aria-labelledby={headingId}>
      {content}
    </section>
  )
}
