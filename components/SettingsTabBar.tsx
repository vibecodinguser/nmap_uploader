import { type KeyboardEvent, useCallback, useEffect, useRef } from 'react'

export type SettingsTabId = 'editing' | 'moderation' | 'style'

export type SettingsTabDescriptor = Readonly<{
  id: SettingsTabId
  label: string
}>

type SettingsTabBarProps = Readonly<{
  tabs: readonly SettingsTabDescriptor[]
  activeId: SettingsTabId
  ariaLabel: string
  onChange: (id: SettingsTabId) => void
}>

const SELECTION_CLASS = 'nk-tabs-bar__selection'
const SELECTED_TAB_CLASS = 'nk-tabs-bar__tab_selected'

/**
 * Полоса выбранной вкладки — по той же схеме, что нативный
 * `.nk-tabs-bar__selection`: элемент шириной 1px сдвигается на
 * `left + (width - 1) / 2` и растягивается через `scaleX`, потому что
 * `transform-origin` по умолчанию — центр.
 */
export const syncSettingsTabSelection = (
  bar: HTMLElement | null,
  active: HTMLElement | null,
): void => {
  if (!bar || !active) {
    return
  }
  const selection = bar.querySelector<HTMLElement>(`.${SELECTION_CLASS}`)
  if (!selection) {
    return
  }

  const width = active.offsetWidth
  if (width <= 0) {
    return
  }

  const offset = active.offsetLeft + (width - 1) / 2
  selection.style.transform = `translateX(${offset}px) scaleX(${width})`
}

/**
 * Вкладки настроек в виде нативного `.nk-tabs-bar`.
 *
 * Классы повторяют нативные, но их стили живут в CSS редактора, недоступном
 * в iframe панели, поэтому вид задан в `uploader.css` — как у шапки панели.
 * Вкладки — настоящие кнопки с ролями табов: нативный `div` не даёт ни
 * клавиатуры, ни семантики.
 */
export const SettingsTabBar = ({ tabs, activeId, ariaLabel, onChange }: SettingsTabBarProps) => {
  const barRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef(new Map<SettingsTabId, HTMLButtonElement>())

  const syncSelection = useCallback(() => {
    syncSettingsTabSelection(barRef.current, tabRefs.current.get(activeId) ?? null)
  }, [activeId])

  useEffect(
    function syncSelectionAfterRender() {
      syncSelection()
      const frame = window.requestAnimationFrame(syncSelection)
      return function cancelFrame() {
        window.cancelAnimationFrame(frame)
      }
    },
    [syncSelection],
  )

  // Ширина вкладок меняется при смене языка и размера шрифта: полосу надо
  // пересчитать, иначе она останется под прежней подписью.
  useEffect(
    function observeTabWidths() {
      const bar = barRef.current
      if (!bar || typeof globalThis.ResizeObserver === 'undefined') {
        return
      }
      const observer = new ResizeObserver(syncSelection)
      observer.observe(bar)
      for (const tab of tabRefs.current.values()) {
        observer.observe(tab)
      }
      return function disconnectObserver() {
        observer.disconnect()
      }
    },
    [syncSelection],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const index = tabs.findIndex((tab) => tab.id === activeId)
    if (index === -1) {
      return
    }

    let nextIndex = index
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % tabs.length
        break
      case 'ArrowLeft':
        nextIndex = (index - 1 + tabs.length) % tabs.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = tabs.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    const next = tabs[nextIndex]
    if (!next) {
      return
    }
    onChange(next.id)
    tabRefs.current.get(next.id)?.focus()
  }

  return (
    <div ref={barRef} className="nk-tabs-bar nk-section nk-section_level_1 settings-tabs-bar">
      <div className="nk-tabs-bar__tabs" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeId
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(tab.id, node)
                } else {
                  tabRefs.current.delete(tab.id)
                }
              }}
              type="button"
              id={`settings-tab-${tab.id}`}
              role="tab"
              className={isActive ? `nk-tabs-bar__tab ${SELECTED_TAB_CLASS}` : 'nk-tabs-bar__tab'}
              aria-selected={isActive}
              aria-controls={`settings-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={handleKeyDown}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div className={SELECTION_CLASS} aria-hidden="true" data-testid="settings-tabs-selection" />
    </div>
  )
}
