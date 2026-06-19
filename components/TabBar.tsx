import React, { MouseEvent } from 'react';
import { TabButton, type TabBarItem } from './TabButton';

type TabBarProps<T extends string> = {
  tabs: TabBarItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
};

export class TabBar<T extends string> extends React.Component<TabBarProps<T>> {
  private handleTabBarClick = (event: MouseEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    if (button) {
      const id = button.getAttribute('data-id') as T;
      if (id) {
        this.props.onChange(id);
      }
    }
  };

  public render() {
    const { tabs, activeId, ariaLabel, className = 'tabs' } = this.props;

    const tabButtons = [];
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const isActive = activeId === tab.id;
      tabButtons.push(<TabButton key={tab.id} tab={tab} isActive={isActive} />);
    }

    return (
      <div
        className={className}
        role="tablist"
        aria-label={ariaLabel}
        onClick={this.handleTabBarClick}
      >
        {tabButtons}
      </div>
    );
  }
}