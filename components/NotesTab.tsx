import { NoteListItem } from '@/components/NoteListItem'
import { PointDateField } from '@/components/PointDateField'
import { useLocale } from '@/hooks/useLocale'
import { useNotesManagement } from '@/hooks/useNotesManagement'

/**
 * Попап «Блокнот»: управление заметками выбранной даты.
 *
 * Создание заметок вынесено в сайдбар редактора (`lib/notes_sidebar`),
 * поэтому здесь нет ни выбора типа фигуры, ни формы сохранения.
 */
export const NotesTab = () => {
  const { t } = useLocale()
  const {
    selectedDate,
    setSelectedDate,
    currentPoints,
    isInitialized,
    isLoadingNotes,
    editingPointId,
    setEditingPointId,
    editingName,
    setEditingName,
    editingDesc,
    setEditingDesc,
    isSavingEdit,
    isDeletingId,
    expandedNoteIds,
    toggleExpand,
    hiddenNoteIds,
    toggleNoteVisibility,
    handleSaveEdit,
    handleDeleteNote,
  } = useNotesManagement()

  if (!isInitialized) {
    return null
  }

  return (
    <div className="tab-panel notes-tab">
      <div className="coords-row--list" style={{ marginBottom: '16px' }}>
        <div className="coords-field coords-field--date" style={{ gridColumn: '1 / -1' }}>
          <PointDateField
            id="notes-date"
            name="notesDate"
            value={selectedDate}
            onChange={setSelectedDate}
            centerPlaceholderWithButton
          />
        </div>
      </div>

      {isLoadingNotes && <div className="notes-loading">{t('notes.loadingNotes')}</div>}

      {!isLoadingNotes && currentPoints.length > 0 && (
        <div className="notes-list notes-list-container">
          <ul className="notes-list-ul">
            {currentPoints.map((p, idx) => {
              const expandId = p.id || p.localId
              const isExpanded = expandId ? expandedNoteIds.has(expandId) : false
              return (
                <NoteListItem
                  key={expandId || idx}
                  p={p}
                  isExpanded={isExpanded}
                  isHidden={Boolean(expandId && hiddenNoteIds.has(expandId))}
                  editingPointId={editingPointId}
                  editingName={editingName}
                  editingDesc={editingDesc}
                  isSavingEdit={isSavingEdit}
                  isDeletingId={isDeletingId}
                  toggleExpand={toggleExpand}
                  onToggleVisibility={toggleNoteVisibility}
                  setEditingPointId={setEditingPointId}
                  setEditingName={setEditingName}
                  setEditingDesc={setEditingDesc}
                  handleSaveEdit={handleSaveEdit}
                  handleDeleteNote={(id) => handleDeleteNote(id, t('notes.deleteConfirm'))}
                />
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
