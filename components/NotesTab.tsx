/* eslint-disable max-nested-callbacks, max-lines-per-function, complexity */
import {
  ChevronRight,
  Hexagon,
  Loader2,
  LocateFixed,
  MapPin,
  MoreVertical,
  Pencil,
  Trash2,
  Waypoints,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { PointDateField } from '@/components/PointDateField'
import { useLocale } from '@/hooks/useLocale'
import { useNotesManagement } from '@/hooks/useNotesManagement'
import type { ManualPointInput } from '@/hooks/usePointUpload'
import { calculateBoundingBox, type GeomType, type NotePoint } from '@/lib/notes'

export type { GeomType, NotePoint }

type NotesTabProps = {
  isUploading: boolean
  isLoggedIn: boolean
  onRequireAuth: () => void
  onManualUpload: (input: ManualPointInput) => void
}

type NoteListItemProps = {
  p: NotePoint
  isExpanded: boolean
  editingPointId: string | null
  editingName: string
  editingDesc: string
  isSavingEdit: boolean
  isUploading: boolean
  isPicking: boolean
  isDeletingId: string | null
  toggleExpand: (id?: string) => void
  setEditingPointId: (id: string | null) => void
  setEditingName: (name: string) => void
  setEditingDesc: (desc: string) => void
  handleSaveEdit: (id: string) => void
  handleDeleteNote: (id: string) => void
}

/**
 * Рендерит один элемент списка заметок.
 * Выделено в отдельный компонент для снижения Cognitive Complexity.
 */
const NoteListItemEdit = ({
  p,
  editingName,
  editingDesc,
  isSavingEdit,
  setEditingName,
  setEditingDesc,
  handleSaveEdit,
  setEditingPointId,
}: Pick<
  NoteListItemProps,
  | 'p'
  | 'editingName'
  | 'editingDesc'
  | 'isSavingEdit'
  | 'setEditingName'
  | 'setEditingDesc'
  | 'handleSaveEdit'
  | 'setEditingPointId'
>) => {
  const { t } = useLocale()
  return (
    <div className="notes-list-item-edit-form">
      <input
        type="text"
        value={editingName}
        onChange={(e) => setEditingName(e.target.value)}
        disabled={isSavingEdit}
        className="point-description-input notes-list-item-edit-input"
        placeholder={t('notes.namePlaceholder')}
      />
      <textarea
        value={editingDesc}
        onChange={(e) => setEditingDesc(e.target.value)}
        disabled={isSavingEdit}
        className="point-description-input notes-list-item-edit-input notes-list-item-edit-textarea"
        placeholder={t('notes.descPlaceholder')}
        rows={3}
      />
      <div className="notes-list-item-edit-actions">
        <button
          type="button"
          className="submit-btn--outline"
          disabled={isSavingEdit || !editingName.trim() || !p.id}
          onClick={() => {
            if (p.id) handleSaveEdit(p.id)
          }}
        >
          {t('notes.save')}
        </button>
        <button
          type="button"
          className="submit-btn--outline"
          disabled={isSavingEdit}
          onClick={() => setEditingPointId(null)}
        >
          {t('notes.cancel')}
        </button>
      </div>
    </div>
  )
}

const NoteItemContent = ({
  p,
  isExpanded,
  toggleExpand,
}: Pick<NoteListItemProps, 'p' | 'isExpanded' | 'toggleExpand'>) => {
  const expandId = p.id || p.localId
  return (
    <button
      type="button"
      onClick={() => toggleExpand(expandId)}
      disabled={!expandId}
      className={['notes-list-item-btn', isExpanded ? 'notes-list-item-btn--expanded' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="notes-list-item-header">
        <ChevronRight
          size={16}
          className={`notes-list-item-chevron ${isExpanded ? 'notes-list-item-chevron--expanded' : ''}`}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {p.geomType === 'Point' && (
            <MapPin size={16} style={{ color: 'var(--nmap-text-secondary)' }} />
          )}
          {p.geomType === 'LineString' && (
            <Waypoints size={16} style={{ color: 'var(--nmap-text-secondary)' }} />
          )}
          {p.geomType === 'Polygon' && (
            <Hexagon size={16} style={{ color: 'var(--nmap-text-secondary)' }} />
          )}
        </div>
        <strong className="notes-list-item-title">{p.name}</strong>
      </div>
      {p.noteDesc && (
        <div className="notes-list-item-desc">
          <span className="notes-list-item-desc-text">{p.noteDesc}</span>
        </div>
      )}
    </button>
  )
}
const NoteItemActions = ({
  p,
  isUploading,
  isPicking,
  isDeletingId,
  setEditingPointId,
  setEditingName,
  setEditingDesc,
  handleDeleteNote,
}: Pick<
  NoteListItemProps,
  | 'p'
  | 'isUploading'
  | 'isPicking'
  | 'isDeletingId'
  | 'setEditingPointId'
  | 'setEditingName'
  | 'setEditingDesc'
  | 'handleDeleteNote'
>) => {
  const { t } = useLocale()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <div className="notes-list-item-actions-wrapper">
      <button
        type="button"
        data-tooltip={t('notes.showOnMap')}
        onClick={() => {
          if (isUploading || isPicking) {
            return
          }
          const bbox = calculateBoundingBox(p.geomCoords)
          browser.runtime

            .sendMessage({
              action: 'centerMap',
              latitude: p.latitude,
              longitude: p.longitude,
              bbox,
              zoom: 18,
            })
            .catch(console.error)
        }}
        disabled={isUploading || isPicking}
        className="notes-list-action-btn yandex-tooltip-wrapper"
      >
        <LocateFixed size={16} />
      </button>

      <div ref={menuRef} style={{ position: 'relative', display: 'flex' }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(!menuOpen)
          }}
          disabled={isUploading || isPicking}
          className="notes-list-action-btn"
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen && (
          <div className="notes-list-item-menu">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                if (isUploading || isPicking || !p.id) {
                  return
                }
                setEditingPointId(p.id)
                setEditingName(p.name)
                setEditingDesc(p.noteDesc || '')
              }}
              disabled={isUploading || isPicking || !p.id}
              className="notes-list-item-menu-btn"
            >
              <Pencil size={14} />
              {t('notes.edit')}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                if (isUploading || isPicking || !p.id) {
                  return
                }
                handleDeleteNote(p.id)
              }}
              disabled={isUploading || isPicking || !p.id || isDeletingId === p.id}
              className="notes-list-item-menu-btn notes-list-item-menu-btn--danger"
            >
              {isDeletingId === p.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              {t('notes.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const NoteListItemView = ({
  p,
  isExpanded,
  isUploading,
  isPicking,
  isDeletingId,
  toggleExpand,
  setEditingPointId,
  setEditingName,
  setEditingDesc,
  handleDeleteNote,
}: Pick<
  NoteListItemProps,
  | 'p'
  | 'isExpanded'
  | 'isUploading'
  | 'isPicking'
  | 'isDeletingId'
  | 'toggleExpand'
  | 'setEditingPointId'
  | 'setEditingName'
  | 'setEditingDesc'
  | 'handleDeleteNote'
>) => (
  <div className="notes-list-item-view">
    <NoteItemContent p={p} isExpanded={isExpanded} toggleExpand={toggleExpand} />
    <NoteItemActions
      p={p}
      isUploading={isUploading}
      isPicking={isPicking}
      isDeletingId={isDeletingId}
      setEditingPointId={setEditingPointId}
      setEditingName={setEditingName}
      setEditingDesc={setEditingDesc}
      handleDeleteNote={handleDeleteNote}
    />
  </div>
)

const NoteListItem = (props: NoteListItemProps) => {
  const isEditing = props.editingPointId === props.p.id && props.p.id
  return (
    <li className="notes-list-item">
      {isEditing ? <NoteListItemEdit {...props} /> : <NoteListItemView {...props} />}
    </li>
  )
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
