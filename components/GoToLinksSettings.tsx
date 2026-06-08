import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { useGoToLinks } from '@/hooks/useGoToLinks'
import { getGoToSourceDisplayName, getGoToSourceIconUrl } from '@/lib/go_to_sources'

type GoToLinksSettingsProps = Pick<
  ReturnType<typeof useGoToLinks>,
  | 'isMenuEnabled'
  | 'items'
  | 'isLoaded'
  | 'setIsMenuEnabled'
  | 'setItemActive'
  | 'moveItemUp'
  | 'moveItemDown'
>

export const GoToLinksSettings = ({
  isMenuEnabled,
  items,
  isLoaded,
  setIsMenuEnabled,
  setItemActive,
  moveItemUp,
  moveItemDown,
}: GoToLinksSettingsProps) => {
  const [isListExpanded, setIsListExpanded] = useState(false)
  const activeCount = items.filter((item) => item.active).length

  const handleToggleList = () => {
    setIsListExpanded((isExpanded) => !isExpanded)
  }

  return (
    <section className="settings-section" aria-labelledby="settings-go-to-heading">
      <div className="settings-toggle-row">
        <h3 id="settings-go-to-heading" className="settings-section-title">
          Другие картографические сервисы
        </h3>
        <label className="settings-toggle" htmlFor="settings-go-to-menu-enabled">
          <input
            id="settings-go-to-menu-enabled"
            type="checkbox"
            role="switch"
            className="settings-toggle-input"
            checked={isMenuEnabled}
            aria-checked={isMenuEnabled}
            disabled={!isLoaded}
            aria-label="Отображать кнопку"
            onChange={(event) => setIsMenuEnabled(event.target.checked)}
          />
          <span className="settings-toggle-track" aria-hidden="true">
            <span className="settings-toggle-thumb" />
          </span>
        </label>
      </div>

      <button
        type="button"
        className="settings-go-to-toggle"
        aria-expanded={isListExpanded}
        aria-controls="settings-go-to-list"
        disabled={!isLoaded}
        onClick={handleToggleList}
      >
        <ChevronRight
          size={16}
          aria-hidden
          className={isListExpanded ? 'settings-go-to-toggle-icon--expanded' : undefined}
        />
        <span className="settings-go-to-toggle-label">Список сервисов</span>
        <span className="settings-go-to-toggle-meta">
          {activeCount} из {items.length} активны
        </span>
      </button>

      {isListExpanded ? (
        <div id="settings-go-to-list" className="settings-go-to-panel">
          <p className="settings-go-to-hint">
            Порядок пунктов в списке соответствует их расположению в меню.
          </p>

          <ul className="settings-go-to-list" aria-label="Ссылки для перехода на геосервисы">
            {items.map((item, index) => {
              const displayName = getGoToSourceDisplayName(item.name)
              const iconUrl = getGoToSourceIconUrl(item.name)
              const canMoveUp = index > 0
              const canMoveDown = index < items.length - 1

              return (
                <li key={item.name} className="settings-go-to-item">
                  <div className="settings-go-to-item-label">
                    <span
                      className="settings-go-to-item-icon"
                      style={{ backgroundImage: `url(${iconUrl})` }}
                      aria-hidden
                    />
                    <span className="settings-go-to-item-name">{displayName}</span>
                  </div>

                  <label className="settings-toggle" htmlFor={`settings-go-to-item-${item.name}`}>
                    <input
                      id={`settings-go-to-item-${item.name}`}
                      type="checkbox"
                      role="switch"
                      className="settings-toggle-input"
                      checked={item.active}
                      aria-checked={item.active}
                      disabled={!isLoaded}
                      aria-label={`Показывать ${displayName} в меню`}
                      onChange={(event) => setItemActive(item.name, event.target.checked)}
                    />
                    <span className="settings-toggle-track" aria-hidden="true">
                      <span className="settings-toggle-thumb" />
                    </span>
                  </label>

                  <div className="settings-go-to-item-actions">
                    <button
                      type="button"
                      className="settings-go-to-move-btn"
                      disabled={!isLoaded || !canMoveUp}
                      aria-label={`Поднять ${displayName}`}
                      onClick={() => moveItemUp(item.name)}
                    >
                      <ChevronUp size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="settings-go-to-move-btn"
                      disabled={!isLoaded || !canMoveDown}
                      aria-label={`Опустить ${displayName}`}
                      onClick={() => moveItemDown(item.name)}
                    >
                      <ChevronDown size={16} aria-hidden />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
