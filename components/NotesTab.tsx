import { NoteListItem } from '@/components/NoteListItem'
import { PointDateField } from '@/components/PointDateField'
import { useLocale } from '@/hooks/useLocale'
import { useNotesManagement } from '@/hooks/useNotesManagement'
import type { ManualPointInput } from '@/hooks/usePointUpload'
import type { GeomType, NotePoint } from '@/lib/notes'

export type { GeomType, NotePoint }

type NotesTabProps = {
  isUploading: boolean
  isLoggedIn: boolean
  onRequireAuth: () => void
  onManualUpload: (input: ManualPointInput) => void
}

export const NotesTab = ({
  isUploading,
  isLoggedIn,
  onRequireAuth,
  onManualUpload,
}: NotesTabProps) => {
  const { t } = useLocale()
  const {
    selectedDate,
    setSelectedDate,
    currentPoints,
    isInitialized,
    isLoadingNotes,
    isPicking,
    geomType,
    pendingCoords,
    pendingName,
    setPendingName,
    pendingDesc,
    setPendingDesc,
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
    handleStartPicking,
    handleSaveNote,
    handleCancelNote,
    handleSaveEdit,
    handleDeleteNote,
  } = useNotesManagement({
    isLoggedIn,
    onRequireAuth,
    onManualUpload,
  })

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
            disabled={isUploading || isPicking}
            onChange={setSelectedDate}
            centerPlaceholderWithButton
          />
        </div>
      </div>

      <div
        className="notes-geom-type-container"
        style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}
      >
        <button
          type="button"
          className="submit-btn--outline"
          style={
            isPicking && geomType === 'Point'
              ? {
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  borderColor: 'var(--primary)',
                }
              : {}
          }
          onClick={() => handleStartPicking('Point')}
          disabled={isUploading || isPicking || !selectedDate || pendingCoords !== null}
        >
          {t('notes.typePoint')}
        </button>
        <button
          type="button"
          className="submit-btn--outline"
          style={
            isPicking && geomType === 'LineString'
              ? {
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  borderColor: 'var(--primary)',
                }
              : {}
          }
          onClick={() => handleStartPicking('LineString')}
          disabled={isUploading || isPicking || !selectedDate || pendingCoords !== null}
        >
          {t('notes.typeLine')}
        </button>
        <button
          type="button"
          className="submit-btn--outline"
          style={
            isPicking && geomType === 'Polygon'
              ? {
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  borderColor: 'var(--primary)',
                }
              : {}
          }
          onClick={() => handleStartPicking('Polygon')}
          disabled={isUploading || isPicking || !selectedDate || pendingCoords !== null}
        >
          {t('notes.typePolygon')}
        </button>
      </div>

      {isLoadingNotes && <div className="notes-loading">{t('notes.loadingNotes')}</div>}

      {pendingCoords && (
        <div className="manual-upload-container notes-manual-upload">
          <div className="notes-manual-upload-info">
            {geomType === 'Point'
              ? t('notes.coordsLabel', {
                  lat: pendingCoords[0].lat.toFixed(6),
                  lon: pendingCoords[0].lon.toFixed(6),
                })
              : t('notes.figureOfPoints', { count: pendingCoords.length })}
          </div>
          <input
            type="text"
            className="point-description-input notes-manual-upload-input"
            placeholder={t('notes.noteDescPlaceholder')}
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            disabled={isUploading}
          />
          <textarea
            className="point-description-input notes-manual-upload-input notes-manual-upload-textarea"
            placeholder={t('notes.noteExtendedDescPlaceholder')}
            value={pendingDesc}
            onChange={(e) => setPendingDesc(e.target.value)}
            disabled={isUploading}
            rows={3}
          />
          <div className="notes-manual-upload-actions">
            <button
              type="button"
              className="submit-btn--outline"
              disabled={isUploading || !pendingName.trim()}
              onClick={handleSaveNote}
            >
              {t('notes.save')}
            </button>
            <button
              type="button"
              className="submit-btn--outline"
              disabled={isUploading}
              onClick={handleCancelNote}
            >
              {t('notes.cancel')}
            </button>
          </div>
        </div>
      )}

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
                  editingPointId={editingPointId}
                  editingName={editingName}
                  editingDesc={editingDesc}
                  isSavingEdit={isSavingEdit}
                  isUploading={isUploading}
                  isPicking={isPicking}
                  isDeletingId={isDeletingId}
                  toggleExpand={toggleExpand}
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
