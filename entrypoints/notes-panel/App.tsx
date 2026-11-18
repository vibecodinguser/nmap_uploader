import { useEffect, useState } from 'react'
import { DeleteGroupDialog } from '@/components/notes_panel/DeleteGroupDialog'
import { ListToolbar } from '@/components/notes_panel/ListToolbar'
import { NoteList } from '@/components/notes_panel/NoteList'
import { NoteProperties } from '@/components/notes_panel/NoteProperties'
import { PanelHeader, type PanelLayout } from '@/components/notes_panel/PanelHeader'
import { PanelStatus } from '@/components/notes_panel/PanelStatus'
import { PanelToasts } from '@/components/notes_panel/PanelToasts'
import { useLocale } from '@/hooks/useLocale'
import { useNotesPanel } from '@/hooks/useNotesPanel'
import { buildAutoNoteName } from '@/lib/notes/model/autonames'
import type { Note } from '@/lib/notes/model/types'
import { kindLabelKey } from '@/lib/notes/panel/labels'
import { NOTES_PANEL_STATE_MESSAGE } from '@/lib/notes_panel/host'

/** Квадрат и круг рисуются протяжкой, остальные — кликами по вершинам. */
const isDragShape = (kind: Note['kind']): boolean => kind === 'Square' || kind === 'Circle'

/** Приложение панели заметок: список и свойства. */
export const NotesPanelApp = () => {
  const { t } = useLocale()
  const panel = useNotesPanel()
  const [layout, setLayout] = useState<PanelLayout>('compact')
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

  const selectedId = panel.selectedNote?.id ?? ''

  const fallbackName = (note: Note): string =>
    buildAutoNoteName({
      date: note.date,
      kindLabel: t(kindLabelKey(note.kind)),
      existingNames: panel.notes.filter((item) => item.id !== note.id).map((item) => item.name),
    })

  return (
    <div className="notes-panel">
      <PanelHeader
        mode={panel.mode}
        search={{ value: panel.query, onChange: panel.setQuery }}
        layout={layout}
        onToggleLayout={setLayout}
      />

      <div className="notes-panel__body">
        <PanelStatus
          status={panel.status}
          onLogin={panel.login}
          onRetry={() => panel.loadNotes()}
        />

        {panel.status === 'ready' && panel.mode === 'list' && (
          <ListToolbar
            create={{
              drawing: Boolean(panel.drawingKind),
              onCreateGroup: () => panel.createGroup(t('notesPanel.newGroupName')),
              onStartDrawing: panel.startDrawing,
            }}
            filters={{
              filter: panel.filters,
              groups: panel.groups,
              onChange: panel.setFilters,
              onReset: panel.resetFilters,
            }}
            selection={{
              count: panel.checkedIds.length,
              groups: panel.groups,
              onSelectAll: () => panel.checkAllVisible(panel.notes.map((note) => note.id)),
              onClear: panel.clearChecked,
              onDelete: panel.deleteChecked,
              onMoveToGroup: panel.moveCheckedToGroup,
            }}
          />
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
            onPatch={(patch) => panel.updateNote(selectedId, patch)}
            onBack={() => panel.selectNote(null)}
            groups={panel.groups}
            onMoveToGroup={(groupId) => panel.moveNoteToGroup(selectedId, groupId)}
          />
        )}

        {panel.status === 'ready' &&
          panel.mode === 'list' &&
          (panel.notes.length === 0 ? (
            <div className="notes-panel__empty">
              {panel.hasNarrowing ? t('notesPanel.emptySearch') : t('notesPanel.empty')}
            </div>
          ) : (
            <NoteList
              notes={panel.notes}
              groups={panel.groups}
              collapsedGroupIds={panel.collapsedGroupIds}
              hiddenIds={panel.hiddenIds}
              selectedId={panel.selectedId}
              checkedIds={panel.checkedIds}
              onCheck={panel.toggleChecked}
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

      <PanelToasts undo={panel.undo} error={panel.error} onUndo={panel.undoRemove} />
    </div>
  )
}
