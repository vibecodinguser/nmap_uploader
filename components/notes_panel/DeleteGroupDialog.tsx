import { useEffect, useRef } from 'react'
import { useLocale } from '@/hooks/useLocale'

/**
 * Диалог удаления группы.
 *
 * У групп две разные судьбы, и выбор между ними необратим, поэтому спрашиваем:
 * распустить (заметки остаются на карте и уходят в корень) или удалить вместе
 * с ними. Молчаливый выбор любого из вариантов терял бы данные или мешал
 * наводить порядок.
 */
export const DeleteGroupDialog = ({
  groupName,
  notesCount,
  onCancel,
  onConfirm,
}: {
  groupName: string
  notesCount: number
  onCancel: () => void
  onConfirm: (mode: 'keepNotes' | 'cascade') => void
}) => {
  const { t } = useLocale()
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    cancelRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: клик по фону — привычное закрытие; Esc работает всегда
    <div
      className="notes-panel__dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className="notes-panel__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nmap-notes-delete-group-title"
      >
        <h2 id="nmap-notes-delete-group-title" className="notes-panel__dialog-title">
          {t('notesPanel.deleteGroupConfirm', { name: groupName })}
        </h2>

        <p className="notes-panel__dialog-text">
          {t('notesPanel.groupHint')}
          {notesCount > 0 ? ` · ${notesCount}` : ''}
        </p>

        <div className="notes-panel__dialog-actions">
          <button ref={cancelRef} type="button" className="notes-panel__button" onClick={onCancel}>
            {t('notesPanel.cancel')}
          </button>
          <button
            type="button"
            className="notes-panel__button"
            onClick={() => onConfirm('keepNotes')}
          >
            {t('notesPanel.deleteGroupKeepNotes')}
          </button>
          <button
            type="button"
            className="notes-panel__button notes-panel__button--danger"
            onClick={() => onConfirm('cascade')}
          >
            {t('notesPanel.deleteGroupCascade')}
          </button>
        </div>
      </div>
    </div>
  )
}
