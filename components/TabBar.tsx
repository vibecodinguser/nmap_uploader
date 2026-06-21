import React from 'react'
import { type TabBarItem, TabButton } from './TabButton'

type TabBarProps<T extends string> = {
  tabs: TabBarItem<T>[]
  activeId: T
  onChange: (id: T) => void
  ariaLabel: string
  className?: string
}

export class TabBar<T extends string> extends React.Component<TabBarProps<T>> {
  public render() {
    const { tabs, activeId, ariaLabel, className = 'tabs', onChange } = this.props

    const tabButtons = []
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]
      const isActive = activeId === tab.id
      tabButtons.push(<TabButton key={tab.id} tab={tab} isActive={isActive} onSelect={onChange} />)
    }

    return (
      <div className={className} role="tablist" aria-label={ariaLabel}>
        {tabButtons}
      </div>
    )
  }
}
