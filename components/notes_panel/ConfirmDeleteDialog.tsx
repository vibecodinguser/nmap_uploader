import { useEffect, useRef } from 'react'
import { useLocale } from '@/hooks/useLocale'

/**
 * Подтверждение удаления заметок.
 *
 * Повторяет нативное подтверждение редактора (`nk-confirmation-view` в
 * `nk-popup`): короткий вопрос и две кнопки справа — «Отменить» и «Удалить»,
 * где удаление акцентное, как `nk-button_view_action`.
 *
 * Размеры сняты с живого диалога, а не подобраны на глаз:
 *
 *   попап      радиус 4 px, тень `0 0 0 1px rgb(0 0 0 / 10%)` плюс
 *              `0 10px 20px -5px rgb(0 0 0 / 40%)`
 *   текст      13 px, отступ `12px 12px 0`
 *   ряд кнопок `12px 16px`, прижат вправо, между кнопками 8 px
 *
 * Подтверждение спрашивается именно здесь, а не после удаления: заметка — не
 * группа, у неё нет второго исхода, поэтому достаточно одного вопроса. Тост
 * «Отменить» при этом остаётся — он страхует от случайного подтверждения.
 */
export const ConfirmDeleteDialog = ({
  message,
  onCancel,
  onConfirm,
}: {
  /** Что именно удаляем: одна заметка по имени или пачка по количеству. */
  message: string
  onCancel: () => void
  onConfirm: () => void
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
        className="notes-panel__confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="nmap-notes-confirm-delete"
      >
        <p id="nmap-notes-confirm-delete" className="notes-panel__confirm-text">
          {message}
        </p>

        <div className="notes-panel__confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="notes-panel__confirm-button"
            onClick={onCancel}
          >
            {t('notesPanel.cancelAction')}
          </button>
          <button
            type="button"
            className="notes-panel__confirm-button notes-panel__confirm-button--action"
            onClick={onConfirm}
          >
            {t('notesPanel.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
