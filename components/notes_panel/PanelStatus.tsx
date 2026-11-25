import { useLocale } from '@/hooks/useLocale'
import type { NotesPanelStatus } from '@/lib/notes/panel/state'

/**
 * Состояния панели вместо списка: загрузка, нужен вход, ошибка загрузки.
 *
 * Отдельный компонент, потому что эти три состояния исключают друг друга и
 * раньше жили тремя блоками в разметке приложения.
 */
export const PanelStatus = ({
  status,
  onLogin,
  onGrantPermission,
  onRetry,
}: {
  status: NotesPanelStatus
  onLogin: () => void
  onGrantPermission: () => void
  onRetry: () => void
}) => {
  const { t } = useLocale()

  if (status === 'loading') {
    return <div className="notes-panel__status">{t('notesPanel.loading')}</div>
  }

  if (status === 'permission') {
    return (
      <div className="notes-panel__status">
        <p>{t('notesPanel.permissionRequired')}</p>
        <button
          type="button"
          className="notes-panel__button notes-panel__button--primary"
          onClick={onGrantPermission}
        >
          {t('notesPanel.grantPermission')}
        </button>
      </div>
    )
  }

  if (status === 'auth') {
    return (
      <div className="notes-panel__status">
        <p>{t('notesPanel.authRequired')}</p>
        <button
          type="button"
          className="notes-panel__button notes-panel__button--primary"
          onClick={onLogin}
        >
          {t('notesPanel.login')}
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="notes-panel__status notes-panel__status--error">
        <p>{t('notesPanel.loadError')}</p>
        <button type="button" className="notes-panel__button" onClick={onRetry}>
          {t('notesPanel.retry')}
        </button>
      </div>
    )
  }

  return null
}
