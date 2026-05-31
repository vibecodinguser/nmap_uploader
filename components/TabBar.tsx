type TabBarItem<T extends string> = {
  id: T
  label: string
}

type TabBarProps<T extends string> = {
  tabs: TabBarItem<T>[]
  activeId: T
  onChange: (id: T) => void
  ariaLabel: string
  className?: string
}

export const TabBar = <T extends string>({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  className = 'tabs',
}: TabBarProps<T>) => (
  <div className={className} role="tablist" aria-label={ariaLabel}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        className={activeId === tab.id ? 'tab-btn active' : 'tab-btn'}
        aria-selected={activeId === tab.id}
        onClick={() => onChange(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
)
