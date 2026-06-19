export type TabBarItem<T extends string> = {
  id: T;
  label: string;
};

type TabButtonProps<T extends string> = {
  tab: TabBarItem<T>;
  isActive: boolean;
  onSelect: (id: T) => void;
};

function getButtonClassName(isActive: boolean): string {
  let className = 'tab-btn';
  if (isActive) {
    className += ' active';
  }
  return className;
}

export const TabButton = function tabButton<T extends string>({
  tab,
  isActive,
  onSelect,
}: TabButtonProps<T>) {
  const handleClick = (): void => {
    onSelect(tab.id);
  };

  return (
    <button
      key={tab.id}
      type="button"
      role="tab"
      className={getButtonClassName(isActive)}
      aria-selected={isActive}
      data-id={tab.id}
      onClick={handleClick}
    >
      {tab.label}
    </button>
  );
};
