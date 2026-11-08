import { ChevronRight, Hexagon, Loader2, MapPin, Pencil, Trash2, Waypoints } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { AnchoredTooltip } from '@/components/AnchoredTooltip'
import { useLocale } from '@/hooks/useLocale'
import { calculateBoundingBox, type NotePoint } from '@/lib/notes'

const ICON_SIZE = 16
const ICON_SIZE_SMALL = 14

/**
 * Нативная иконка «Центрировать» из набора редактора (`nk-icon_id_center`).
 *
 * Отрисована штрихом на `currentColor`, а не заливками: так она попадает в ту
 * же палитру, что и «Ещё», и корректно перекрашивается в disabled/hover.
 */
const NativeCenterIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
    stroke="currentColor"
    aria-hidden="true"
  >
    <circle cx="10.5" cy="11.5" r="9.5" strokeWidth="2" opacity="0.45" />
    <circle cx="10.5" cy="11.5" r="4.5" strokeWidth="1.6" />
    <path d="M5 11.5h3m5 0h3m-5.5-3v3m0 2v3" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

/** Нативная иконка «Ещё» из набора редактора (`nk-icon_id_more`). */
const NativeMoreIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 22 22"
    aria-hidden="true"
  >
    <path d="M6 12.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m6.5-1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m3.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" />
    <path
      fillRule="evenodd"
      d="M15 4H7a7 7 0 0 0 0 14h8a7 7 0 1 0 0-14M2 11a5 5 0 0 1 5-5h8a5 5 0 0 1 0 10H7a5 5 0 0 1-5-5"
    />
  </svg>
)

/** Нативная иконка «Показать/скрыть объект» — глаз из набора редактора. */
const NativeEyeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 22 22"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M21.695 11.474a.99.99 0 0 0 0-1.248C19.05 6.979 16.176 4 11.1 4S3.15 6.979.504 10.226a.99.99 0 0 0 0 1.248C3.15 14.721 6.024 17.7 11.1 17.7s7.95-2.979 10.595-6.226m-19.23-.33a.49.49 0 0 1 0-.592C4.468 7.92 6.858 5.7 11.1 5.7s6.638 2.22 8.633 4.86a.49.49 0 0 1-.001.59C17.709 13.783 14.957 16 11.1 16s-6.605-2.218-8.634-4.856M11.1 14.85c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4m0-2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2"
    />
  </svg>
)

/** Перечёркнутый глаз: объект скрыт. */
const NativeEyeOffIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 22 22"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M11.1 4c5.076 0 7.95 2.979 10.595 6.226a.99.99 0 0 1 0 1.248 21 21 0 0 1-2.02 2.28l-1.2-1.2a19 19 0 0 0 1.658-1.898.49.49 0 0 0 .001-.59C18.138 7.42 15.748 5.2 11.5 5.2c-.72 0-1.39.07-2.01.2L7.98 3.89C8.94 3.62 9.97 3.5 11.1 3.5zM2.5 2.7a.6.6 0 0 1 .85 0l16.4 16.4a.6.6 0 0 1-.85.85l-3.4-3.4A11.6 11.6 0 0 1 11.1 17.7C6.024 17.7 3.15 14.721.504 11.474a.99.99 0 0 1 0-1.248A21.2 21.2 0 0 1 4.5 6.1zM5.9 7.5a19.4 19.4 0 0 0-2.9 3.06.49.49 0 0 0 .001.59C5.035 13.783 7.787 16 11.6 16c1.24 0 2.34-.22 3.32-.6L13.2 13.6a4.2 4.2 0 0 1-5.6-5.6zm1.7 1.7a2.9 2.9 0 0 0 3.9 3.9z"
    />
  </svg>
)

/**
 * Классы кнопки-иконки в строке заметки.
 *
 * Обе кнопки используют один набор: `nk-icon` + `nk-icon_colored` +
 * `nk-icon_interactive`, поэтому рисуются в общей палитре редактора.
 */
const iconButtonClassName = (native: string, disabled: boolean): string =>
  `notes-list-action-btn nk-icon ${native} nk-icon_colored ${
    disabled ? 'nk-icon_disabled' : 'nk-icon_interactive'
  }`

const CENTER_ICON_CLASS = 'nk-icon_id_center nk-icon_align_auto'
const MORE_ICON_CLASS = 'nk-icon_id_more nk-icon_align_auto'
const EYE_ICON_CLASS = 'nk-icon_id_eye nk-icon_align_auto'

export type NoteListItemProps = {
  p: NotePoint
  isExpanded: boolean
  isHidden: boolean
  editingPointId: string | null
  editingName: string
  editingDesc: string
  isSavingEdit: boolean
  isDeletingId: string | null
  toggleExpand: (id?: string) => void
  onToggleVisibility: (id: string) => void
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
  const hasDesc = Boolean(p.noteDesc?.trim())
  return (
    <button
      type="button"
      onClick={() => toggleExpand(expandId)}
      disabled={!expandId || !hasDesc}
      className={`notes-list-item-btn ${hasDesc && isExpanded ? 'notes-list-item-btn--expanded' : ''}`}
    >
      <div className="notes-list-item-header">
        {hasDesc && (
          <ChevronRight
            size={ICON_SIZE}
            className={`notes-list-item-chevron ${isExpanded ? 'notes-list-item-chevron--expanded' : ''}`}
          />
        )}
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
      {hasDesc && (
        <div className="notes-list-item-desc">
          <span className="notes-list-item-desc-text">{p.noteDesc}</span>
        </div>
      )}
    </button>
  )
}

export const NoteItemActions = ({
  p,
  isHidden,
  isDeletingId,
  onToggleVisibility,
  setEditingPointId,
  setEditingName,
  setEditingDesc,
  handleDeleteNote,
}: Pick<
  NoteListItemProps,
  | 'p'
  | 'isHidden'
  | 'isDeletingId'
  | 'onToggleVisibility'
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

  const handleShowOnMap = (): void => {
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
  }

  return (
    <div className="notes-list-item-actions-wrapper">
      <AnchoredTooltip
        label={isHidden ? t('notes.showObject') : t('notes.hideObject')}
        className={iconButtonClassName(EYE_ICON_CLASS, false)}
        onClick={() => {
          if (p.id) onToggleVisibility(p.id)
        }}
        disabled={p.id === undefined}
      >
        {isHidden ? <NativeEyeOffIcon /> : <NativeEyeIcon />}
      </AnchoredTooltip>

      <AnchoredTooltip
        label={t('notes.showOnMap')}
        className={iconButtonClassName(CENTER_ICON_CLASS, false)}
        onClick={handleShowOnMap}
      >
        <NativeCenterIcon />
      </AnchoredTooltip>

      <div ref={menuRef} style={{ position: 'relative', display: 'flex' }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(!menuOpen)
          }}
          className={iconButtonClassName(MORE_ICON_CLASS, false)}
          aria-label={t('notes.more')}
        >
          <NativeMoreIcon />
        </button>
        {menuOpen && (
          <div className="notes-list-item-menu">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                if (p.id === undefined) return
                setEditingPointId(p.id)
                setEditingName(p.name)
                setEditingDesc(p.noteDesc || '')
              }}
              disabled={p.id === undefined}
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
                if (p.id === undefined) return
                handleDeleteNote(p.id)
              }}
              disabled={p.id === undefined || isDeletingId === p.id}
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
  isHidden,
  isDeletingId,
  toggleExpand,
  onToggleVisibility,
  setEditingPointId,
  setEditingName,
  setEditingDesc,
  handleDeleteNote,
}: Pick<
  NoteListItemProps,
  | 'p'
  | 'isExpanded'
  | 'isHidden'
  | 'isDeletingId'
  | 'toggleExpand'
  | 'onToggleVisibility'
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
        isHidden={isHidden}
        isDeletingId={isDeletingId}
        onToggleVisibility={onToggleVisibility}
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
  const className = `notes-list-item${props.isHidden ? ' notes-list-item--hidden' : ''}`
  return (
    <li className={className}>
      {isEditing ? <NoteListItemEdit {...props} /> : <NoteListItemView {...props} />}
    </li>
  )
}
