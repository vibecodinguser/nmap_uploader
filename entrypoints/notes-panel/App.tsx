import { useEffect, useState } from 'react'
import { DeleteGroupDialog } from '@/components/notes_panel/DeleteGroupDialog'
import { NOTES_PANEL_BUTTON_IDS } from '@/components/notes_panel/ids'
import { NoteList } from '@/components/notes_panel/NoteList'
import { NoteProperties } from '@/components/notes_panel/NoteProperties'
import { ShapePicker } from '@/components/notes_panel/ShapePicker'
import { useLocale } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import { buildAutoNoteName } from '@/lib/notes/autonames'
import type { DrawableNoteKind } from '@/lib/notes/protocol'
import type { Note } from '@/lib/notes/types'
import {
  NOTES_PANEL_CLOSE_MESSAGE,
  NOTES_PANEL_LAYOUT_MESSAGE,
  NOTES_PANEL_STATE_MESSAGE,
} from '@/lib/notes_panel/host'

const kindLabelKey = (kind: Note['kind']) => `notesPanel.kind${kind}` as const

/** Квадрат и круг рисуются протяжкой, остальные — кликами по вершинам. */
const isDragShape = (kind: DrawableNoteKind): boolean => kind === 'Square' || kind === 'Circle'

const requestLayout = (layout: 'compact' | 'full'): void => {
  window.parent?.postMessage({ action: NOTES_PANEL_LAYOUT_MESSAGE, layout }, '*')
}

const requestClose = (): void => {
  window.parent?.postMessage({ action: NOTES_PANEL_CLOSE_MESSAGE }, '*')
}

/** Приложение панели заметок: список и свойства. */
export const NotesPanelApp = () => {
  const { t } = useLocale()
  const panel = useNotesPanel()
  const [layout, setLayout] = useState<'compact' | 'full'>('compact')
  const [shapeOpen, setShapeOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return
      const data = event.data as { action?: string; layout?: string } | null
      if (data?.action === NOTES_PANEL_STATE_MESSAGE) {
        setLayout(data.layout === 'full' ? 'full' : 'compact')
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const isFull = layout === 'full'

  const fallbackName = (note: Note): string =>
    buildAutoNoteName({
      date: note.date,
      kindLabel: t(kindLabelKey(note.kind)),
      existingNames: panel.notes.filter((item) => item.id !== note.id).map((item) => item.name),
    })

  return (
    <div className="notes-panel">
      <header className="notes-panel__head">
        <h1 className="notes-panel__title">{t('notesPanel.title')}</h1>

        {panel.mode === 'list' && (
          <input
            className="notes-panel__search"
            type="search"
            value={panel.query}
            placeholder={t('notesPanel.searchPlaceholder')}
            aria-label={t('notesPanel.searchPlaceholder')}
            onChange={(event) => panel.setQuery(event.target.value)}
          />
        )}

        <div className="notes-panel__head-actions">
          {panel.mode === 'list' && (
            <button
              type="button"
              id={NOTES_PANEL_BUTTON_IDS.createGroup}
              className="notes-panel__button"
              title={t('notesPanel.createGroup')}
              onClick={() => panel.createGroup(t('notesPanel.newGroupName'))}
            >
              + {t('notesPanel.createGroup')}
            </button>
          )}

          <div className="notes-panel__create">
            <button
              type="button"
              className="notes-panel__button notes-panel__button--primary"
              aria-expanded={shapeOpen}
              disabled={Boolean(panel.drawingKind)}
              onClick={() => setShapeOpen((open) => !open)}
            >
              {t('notesPanel.create')}
            </button>
            {shapeOpen && (
              <ShapePicker
                busy={Boolean(panel.drawingKind)}
                onCancel={() => setShapeOpen(false)}
                onPick={(kind) => {
                  setShapeOpen(false)
                  panel.startDrawing(kind)
                }}
              />
            )}
          </div>

          <button
            type="button"
            className="notes-panel__icon-button"
            title={isFull ? t('notesPanel.collapse') : t('notesPanel.expand')}
            aria-label={isFull ? t('notesPanel.collapse') : t('notesPanel.expand')}
            onClick={() => {
              const next = isFull ? 'compact' : 'full'
              setLayout(next)
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

      <div className="notes-panel__body">
        {panel.status === 'loading' && (
          <div className="notes-panel__status">{t('notesPanel.loading')}</div>
        )}
        {panel.status === 'auth' && (
          <div className="notes-panel__status">
            <p>{t('notesPanel.authRequired')}</p>
            <button
              type="button"
              className="notes-panel__button notes-panel__button--primary"
              onClick={panel.login}
            >
              {t('notesPanel.login')}
            </button>
          </div>
        )}
        {panel.status === 'error' && (
          <div className="notes-panel__status notes-panel__status--error">
            <p>{t('notesPanel.loadError')}</p>
            <button type="button" className="notes-panel__button" onClick={() => panel.loadNotes()}>
              {t('notesPanel.retry')}
            </button>
          </div>
        )}

        {panel.status === 'ready' && panel.drawingKind && (
          <div className="notes-panel__hint notes-panel__hint--draw">
            <span>
              {t(
                isDragShape(panel.drawingKind)
                  ? 'notesPanel.drawHintDragActive'
                  : 'notesPanel.drawHintClicksActive',
              )}
            </span>
            <button
              type="button"
              className="notes-panel__link-button"
              onClick={panel.cancelDrawing}
            >
              {t('notesPanel.cancel')}
            </button>
          </div>
        )}

        {panel.status === 'ready' && panel.mode === 'properties' && panel.selectedNote && (
          <NoteProperties
            key={panel.selectedNote.id}
            note={panel.selectedNote}
            fallbackName={fallbackName(panel.selectedNote)}
            hidden={panel.hiddenIds.includes(panel.selectedNote.id)}
            onPatch={(patch) => panel.updateNote(panel.selectedNote?.id ?? '', patch)}
            onDelete={() => panel.removeNote(panel.selectedNote?.id ?? '')}
            onBack={() => panel.selectNote(null)}
            onLocate={() => panel.locateNote(panel.selectedNote?.id ?? '')}
            onToggleHidden={() => panel.toggleHidden(panel.selectedNote?.id ?? '')}
            groups={panel.groups}
            onMoveToGroup={(groupId) =>
              panel.moveNoteToGroup(panel.selectedNote?.id ?? '', groupId)
            }
          />
        )}

        {panel.status === 'ready' &&
          panel.mode === 'list' &&
          (panel.notes.length === 0 ? (
            <div className="notes-panel__empty">
              {panel.query ? t('notesPanel.emptySearch') : t('notesPanel.empty')}
            </div>
          ) : (
            <NoteList
              notes={panel.notes}
              groups={panel.groups}
              collapsedGroupIds={panel.collapsedGroupIds}
              hiddenIds={panel.hiddenIds}
              selectedId={panel.selectedId}
              onSelect={panel.selectNote}
              onToggleHidden={panel.toggleHidden}
              onLocate={panel.locateNote}
              onDelete={panel.removeNote}
              onToggleGroup={panel.toggleGroupCollapsed}
              onRenameGroup={panel.renameGroup}
              onRecolorGroup={panel.recolorGroup}
              onRemoveGroup={(groupId) => setGroupToDelete(groupId)}
              onMoveNote={panel.moveNoteToGroup}
              onToggleGroupVisibility={panel.toggleGroupHidden}
            />
          ))}
      </div>

      {groupToDelete && (
        <DeleteGroupDialog
          groupName={panel.groups.find((group) => group.id === groupToDelete)?.name ?? ''}
          notesCount={panel.notes.filter((note) => note.groupId === groupToDelete).length}
          onCancel={() => setGroupToDelete(null)}
          onConfirm={(mode) => {
            panel.removeGroup(groupToDelete, mode)
            setGroupToDelete(null)
          }}
        />
      )}

      {panel.undo && (
        <div className="notes-panel__toast" role="status">
          <span>{t('notesPanel.undoDelete')}</span>
          <button type="button" className="notes-panel__link-button" onClick={panel.undoRemove}>
            {t('notesPanel.undo')}
          </button>
        </div>
      )}

      {panel.error && (
        <div className="notes-panel__toast notes-panel__toast--error" role="alert">
          {panel.error}
        </div>
      )}
    </div>
  )
}
