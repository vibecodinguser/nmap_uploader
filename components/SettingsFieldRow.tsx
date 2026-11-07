import type { ReactNode } from 'react'

type SettingsFieldRowProps = Readonly<{
  id: string
  title: string
  children: ReactNode
}>

/** Строка внутри групповой секции настроек: заголовок и произвольный контрол. */
export const SettingsFieldRow = ({ id, title, children }: SettingsFieldRowProps) => {
  return (
    <div className="settings-toggle-item">
      <h4 id={`${id}-heading`} className="settings-section-title">
        {title}
      </h4>
      {children}
    </div>
  )
}
