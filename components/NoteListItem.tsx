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
import { useLocale } from '@/hooks/useLocale'

const ICON_SIZE = 16
const ICON_SIZE_SMALL = 14

export type NotePoint = {
  id?: string
  localId?: string
  name: string
  latitude: number
  longitude: number
  date: string
  noteTime?: string
  noteDesc?: string
  geomType: 'Point' | 'LineString' | 'Polygon'
  geomCoords?: [number, number][]
}

export type NoteListItemProps = {
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
export const NoteListItemEdit = ({
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
          disabled={isSavingEdit || editingName.trim() === '' || p.id === undefined}
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

export const NoteItemContent = ({
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
      className={`notes-list-item-btn ${isExpanded ? 'notes-list-item-btn--expanded' : ''}`}
    >
    <div className="notes-list-item-header">
      <ChevronRight
        size={ICON_SIZE}
        className={`notes-list-item-chevron ${isExpanded ? 'notes-list-item-chevron--expanded' : ''}`}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        {p.geomType === 'Point' && (
          <MapPin size={ICON_SIZE} style={{ color: 'var(--nmap-text-secondary)' }} />
        )}
        {p.geomType === 'LineString' && (
          <Waypoints size={ICON_SIZE} style={{ color: 'var(--nmap-text-secondary)' }} />
        )}
        {p.geomType === 'Polygon' && (
          <Hexagon size={ICON_SIZE} style={{ color: 'var(--nmap-text-secondary)' }} />
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

export const NoteItemActions = ({
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
          if (isUploading || isPicking) return
          let bbox: [number, number, number, number] | undefined
          if (p.geomCoords && p.geomCoords.length > 1) {
            const lons = p.geomCoords.map((c) => c[0])
            const lats = p.geomCoords.map((c) => c[1])
            bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
          }
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
        <LocateFixed size={ICON_SIZE} />
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
          <MoreVertical size={ICON_SIZE} />
        </button>
        {menuOpen && (
          <div className="notes-list-item-menu">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                if (isUploading || isPicking || p.id === undefined) return
                setEditingPointId(p.id)
                setEditingName(p.name)
                setEditingDesc(p.noteDesc || '')
              }}
              disabled={isUploading || isPicking || p.id === undefined}
              className="notes-list-item-menu-btn"
            >
              <Pencil size={ICON_SIZE_SMALL} />
              {t('notes.edit')}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                if (isUploading || isPicking || p.id === undefined) return
                handleDeleteNote(p.id)
              }}
              disabled={isUploading || isPicking || p.id === undefined || isDeletingId === p.id}
              className="notes-list-item-menu-btn notes-list-item-menu-btn--danger"
            >
              {isDeletingId === p.id ? (
                <Loader2 size={ICON_SIZE_SMALL} className="animate-spin" />
              ) : (
                <Trash2 size={ICON_SIZE_SMALL} />
              )}
              {t('notes.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export const NoteListItemView = ({
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
>) => {
  return (
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
}

export const NoteListItem = (props: NoteListItemProps) => {
  const isEditing = props.editingPointId === props.p.id && props.p.id
  return (
    <li className="notes-list-item">
      {isEditing ? <NoteListItemEdit {...props} /> : <NoteListItemView {...props} />}
    </li>
  )
}

