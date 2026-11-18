import { useLocale } from '@/hooks/useLocale'
import { NOTES_PANEL_CLOSE_MESSAGE, NOTES_PANEL_LAYOUT_MESSAGE } from '@/lib/notes_panel/host'

export type PanelLayout = 'compact' | 'full'

const requestLayout = (layout: PanelLayout): void => {
  window.parent?.postMessage({ action: NOTES_PANEL_LAYOUT_MESSAGE, layout }, '*')
}

const requestClose = (): void => {
  window.parent?.postMessage({ action: NOTES_PANEL_CLOSE_MESSAGE }, '*')
}

/**
 * Шапка панели: заголовок, поиск, разворот и закрытие.
 *
 * Создание сюда не входит — оно в строке инструментов списка. Рядом с
 * кнопками окна оно читалось как управление окном.
 *
 * Кнопки разворота и закрытия не меняют состояние панели сами — они просят об
 * этом хост через `postMessage`: размер iframe задаёт хост, а не страница.
 */
export const PanelHeader = ({
  mode,
  search,
  layout,
  onToggleLayout,
}: {
  mode: 'list' | 'properties'
  search: { value: string; onChange: (query: string) => void }
  layout: PanelLayout
  onToggleLayout: (next: PanelLayout) => void
}) => {
  const { t } = useLocale()
  const isFull = layout === 'full'

  return (
    <header className="notes-panel__head">
      <h1 className="notes-panel__title">{t('notesPanel.title')}</h1>

      {mode === 'list' && (
        <input
          className="notes-panel__search"
          type="search"
          value={search.value}
          placeholder={t('notesPanel.searchPlaceholder')}
          aria-label={t('notesPanel.searchPlaceholder')}
          onChange={(event) => search.onChange(event.target.value)}
        />
      )}

      <div className="notes-panel__head-actions">
        <button
          type="button"
          className="notes-panel__icon-button"
          title={isFull ? t('notesPanel.collapse') : t('notesPanel.expand')}
          aria-label={isFull ? t('notesPanel.collapse') : t('notesPanel.expand')}
          onClick={() => {
            const next: PanelLayout = isFull ? 'compact' : 'full'
            onToggleLayout(next)
            requestLayout(next)
          }}
        >
          {isFull ? '⤡' : '⤢'}
        </button>

        <button
          type="button"
          className="notes-panel__icon-button"
          title={t('notesPanel.close')}
          aria-label={t('notesPanel.close')}
          onClick={requestClose}
        >
          ×
        </button>
      </div>
    </header>
  )
}
