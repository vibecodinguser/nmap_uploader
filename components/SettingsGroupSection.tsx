import { ChevronRight } from 'lucide-react'
import { type ReactNode, useState } from 'react'

const SECTION_CHEVRON_ICON_SIZE = 16

type SettingsGroupSectionProps = Readonly<{
  id: string
  title: string
  children: ReactNode
  /** Секция раскрыта при первом показе. */
  defaultExpanded?: boolean
}>

/** Карточка настроек с раскрывающимся заголовком и группой строк. */
export const SettingsGroupSection = ({
  id,
  title,
  children,
  defaultExpanded = false,
}: SettingsGroupSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const headingId = `${id}-heading`
  const contentId = `${id}-content`
  const sectionClassName = isExpanded
    ? 'settings-section settings-section--group'
    : 'settings-section settings-section--group settings-section--collapsed'
  const chevronClassName = isExpanded
    ? 'settings-section-toggle-icon settings-section-toggle-icon--expanded'
    : 'settings-section-toggle-icon'

  return (
    <section className={sectionClassName} aria-labelledby={headingId}>
      <h3 id={headingId} className="settings-section-title">
        <button
          type="button"
          className="settings-section-toggle"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded((value) => !value)}
        >
          <ChevronRight size={SECTION_CHEVRON_ICON_SIZE} aria-hidden className={chevronClassName} />
          <span className="settings-section-toggle-label">{title}</span>
        </button>
      </h3>
      {isExpanded ? (
        <div id={contentId} className="settings-toggle-group">
          {children}
        </div>
      ) : null}
    </section>
  )
}
