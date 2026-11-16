import { useLocale } from '@/hooks/useLocale'
import type { UndoEntry } from '@/lib/notes/panel/state'

/**
 * Всплывающие сообщения панели: возврат удалённой заметки и ошибка.
 *
 * Живут внизу панели и не перекрывают друг друга: тост отмены — `status`,
 * ошибка — `alert`, чтобы скринридер прочитал обе.
 */
export const PanelToasts = ({
  undo,
  error,
  onUndo,
}: {
  undo: UndoEntry | null
  error: string | null
  onUndo: () => void
}) => {
  const { t } = useLocale()

  return (
    <>
      {undo && (
        <div className="notes-panel__toast" role="status">
          <span>{t('notesPanel.undoDelete')}</span>
          <button type="button" className="notes-panel__link-button" onClick={onUndo}>
            {t('notesPanel.undo')}
          </button>
        </div>
      )}

      {error && (
        <div className="notes-panel__toast notes-panel__toast--error" role="alert">
          {error}
        </div>
      )}
    </>
  )
}
