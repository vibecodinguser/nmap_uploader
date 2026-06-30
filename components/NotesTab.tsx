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
import type { ManualPointInput } from '@/hooks/usePointUpload'
import { displayToIso } from '@/lib/date_format'
import { POINT_PICKED_ACTION, START_POINT_PICKING_ACTION } from '@/lib/pick_point_action'
import { requireAuthBeforeAction } from '@/lib/require_auth'
import { downloadIndexJson, getStoredAuth, uploadIndexJson } from '@/lib/yandex/client'

type NotesTabProps = {
  isUploading: boolean
  isLoggedIn: boolean
  onRequireAuth: () => void
  onManualUpload: (input: ManualPointInput) => void
}

export type GeomType = 'Point' | 'LineString' | 'Polygon'

type NotePoint = {
  id?: string
  localId?: string
  name: string
  latitude: number
  longitude: number
  date: string
  noteTime?: string
  noteDesc?: string
  geomType: GeomType
  geomCoords?: [number, number][]
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
      className={`notes-list-item-btn ${isExpanded ? 'notes-list-item-btn--expanded' : ''}`}
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
  isExpanded,
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
  | 'isExpanded'
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
      isExpanded={isExpanded}
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
  const [selectedDate, setSelectedDate] = useState('')
  const [points, setPoints] = useState<NotePoint[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  const [isPicking, setIsPicking] = useState(false)
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lon: number }[] | null>(null)
  const [pendingName, setPendingName] = useState('')
  const [pendingDesc, setPendingDesc] = useState('')
  const [geomType, setGeomType] = useState<string | null>(null)
  const [editingPointId, setEditingPointId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingDesc, setEditingDesc] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id?: string) => {
    if (!id) {
      return
    }
    setExpandedNoteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    const initializeDate = async () => {
      try {
        const response = await browser.runtime.sendMessage({ action: 'getTrackerDate' })
        let initialDate = response?.date

        if (initialDate && typeof initialDate === 'string') {
          // Ищем паттерн DD.MM.YYYY в строке, даже если там есть лишний текст
          const match = /(\d{2})\.(\d{2})\.(\d{4})/.exec(initialDate)
          if (match) {
            initialDate = `${match[1]}-${match[2]}-${match[3]}`
          } else {
            initialDate = null
          }
        }

        if (!initialDate) {
          const res = await browser.storage.local.get(['notes_selected_date'])
          if (typeof res.notes_selected_date === 'string') {
            initialDate = res.notes_selected_date
          }
        }

        if (initialDate) {
          setSelectedDate(initialDate)
        }
      } catch (error) {
        console.error('[nmap_uploader] Failed to initialize notes date:', error)
      } finally {
        setIsInitialized(true)
      }
    }

    initializeDate()
  }, [])

  useEffect(() => {
    if (!isInitialized) {
      return
    }
    browser.storage.local.set({ notes_selected_date: selectedDate }).catch(() => {})
  }, [selectedDate, isInitialized])

  useEffect(() => {
    if (!isInitialized || !selectedDate) {
      setPoints((prev) => (prev.length === 0 ? prev : []))
      return
    }

    const isoDate = displayToIso(selectedDate)
    if (!isoDate) {
      setPoints((prev) => (prev.length === 0 ? prev : []))
      return
    }

    let isMounted = true
    setIsLoadingNotes(true)

    getStoredAuth()
      .then((auth) => {
        if (!auth || !isMounted) {
          setIsLoadingNotes(false)
          return
        }

        return downloadIndexJson({ token: auth.token, targetDate: isoDate })
      })
      .then((nmapIndex) => {
        if (!isMounted) {
          return
        }
        if (nmapIndex?.points) {
          const remotePoints = Object.entries(nmapIndex.points).map(([id, pt]) => {
            let geomType: GeomType = 'Point'
            if (nmapIndex.paths?.[id]) {
              const path = nmapIndex.paths[id]
              if (
                path.length > 2 &&
                path[0][0] === path.at(-1)?.[0] &&
                path[0][1] === path.at(-1)?.[1]
              ) {
                geomType = 'Polygon'
              } else {
                geomType = 'LineString'
              }
            }
            return {
              id,
              name: pt.desc,
              latitude: pt.coords[1],
              longitude: pt.coords[0],
              date: selectedDate,
              noteTime: pt.note_time,
              noteDesc: pt.note_desc,
              geomType,
              geomCoords: (nmapIndex.paths?.[id] as [number, number][]) || [pt.coords],
            }
          })
          setPoints(remotePoints)
        } else {
          setPoints((prev) => (prev.length === 0 ? prev : []))
        }
      })
      .catch(() => {
        if (isMounted) setPoints((prev) => (prev.length === 0 ? prev : []))
      })
      .finally(() => {
        if (isMounted) setIsLoadingNotes(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedDate, isInitialized])

  const handleStartPicking = (type: GeomType) => {
    if (!requireAuthBeforeAction({ isLoggedIn, onRequireAuth })) {
      return
    }
    setGeomType(type)
    setIsPicking(true)
    browser.runtime
      .sendMessage({ action: START_POINT_PICKING_ACTION, geomType: type })
      .catch(() => {
        setIsPicking(false)
      })
  }

  useEffect(() => {
    const handleRuntimeMessage = (message: any) => {
      if (message?.action === POINT_PICKED_ACTION) {
        setIsPicking(false)
        if (Array.isArray(message.coords)) {
          const coordsArr = message.coords.map((c: number[]) => ({ lat: c[0], lon: c[1] }))
          setPendingCoords(coordsArr)
          setPendingName('')
        }
      } else if (message?.action === 'TRACKER_DATE_CHANGED' && message.date) {
        let initialDate = message.date
        const match = /(\d{2})\.(\d{2})\.(\d{4})/.exec(initialDate)
        if (match) {
          initialDate = `${match[1]}-${match[2]}-${match[3]}`
          setSelectedDate(initialDate)
        }
      }
    }

    const handleWindowMessage = (event: MessageEvent) => {
      const message = event.data
      if (message?.action === 'TRACKER_DATE_CHANGED' && message.date) {
        let initialDate = message.date
        const match = /(\d{2})\.(\d{2})\.(\d{4})/.exec(initialDate)
        if (match) {
          initialDate = `${match[1]}-${match[2]}-${match[3]}`
          setSelectedDate(initialDate)
        }
      }
    }

    browser.runtime.onMessage.addListener(handleRuntimeMessage)
    window.addEventListener('message', handleWindowMessage)

    return () => {
      browser.runtime.onMessage.removeListener(handleRuntimeMessage)
      window.removeEventListener('message', handleWindowMessage)
    }
  }, [])

  const handleSaveNote = () => {
    if (pendingCoords && pendingCoords.length > 0 && pendingName.trim() && geomType) {
      const name = pendingName.trim()
      const firstCoord = pendingCoords[0]
      const now = new Date()
      const noteTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      const desc = pendingDesc.trim()

      // Преобразуем формат
      const formattedCoords = pendingCoords.map((c) => [c.lon, c.lat])

      setPoints((prev) => [
        ...prev,
        {
          localId: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          name,
          latitude: firstCoord.lat,
          longitude: firstCoord.lon,
          date: selectedDate,
          noteTime,
          noteDesc: desc,
          geomType: geomType as 'Point' | 'LineString' | 'Polygon',
          geomCoords: formattedCoords as [number, number][],
        },
      ])

      onManualUpload({
        description: name,
        coords: formattedCoords,
        geomType,
        date: selectedDate,
        note_time: noteTime,
        note_desc: desc,
      })

      setPendingCoords(null)
      setPendingName('')
      setPendingDesc('')
    }
  }

  const handleCancelNote = () => {
    setPendingCoords(null)
    setPendingName('')
    setPendingDesc('')
  }

  const handleSaveEdit = async (id: string) => {
    const newName = editingName.trim()
    if (!newName) {
      return
    }

    setIsSavingEdit(true)
    try {
      const auth = await getStoredAuth()
      if (!auth) throw new Error('No auth')

      const isoDate = displayToIso(selectedDate)
      if (!isoDate) throw new Error('Invalid date')

      const index = await downloadIndexJson({ token: auth.token, targetDate: isoDate })
      if (!index?.points?.[id]) throw new Error('Point not found')

      index.points[id].desc = newName
      index.points[id].note_desc = editingDesc.trim()
      await uploadIndexJson({ token: auth.token, targetDate: isoDate, data: index })

      setPoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: newName, noteDesc: editingDesc.trim() } : p)),
      )
      setEditingPointId(null)
    } catch (e) {
      console.error('Failed to edit point:', e)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteNote = async (id: string) => {
    if (!globalThis.confirm(t('notes.deleteConfirm'))) {
      return
    }

    setIsDeletingId(id)
    try {
      const auth = await getStoredAuth()
      if (!auth) throw new Error('No auth')

      const isoDate = displayToIso(selectedDate)
      if (!isoDate) throw new Error('Invalid date')

      const index = await downloadIndexJson({ token: auth.token, targetDate: isoDate })
      if (!index?.points) throw new Error('Index not found')

      delete index.points[id]
      if (index.paths?.[id]) {
        delete index.paths[id]
      }

      await uploadIndexJson({ token: auth.token, targetDate: isoDate, data: index })

      setPoints((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      console.error('Failed to delete point:', e)
    } finally {
      setIsDeletingId(null)
    }
  }

  const currentPoints = [...points].filter((p) => p.date === selectedDate).reverse()

  const lastDispatchedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isInitialized) {
      return
    }
    const pts = points.filter((p) => p.date === selectedDate)
    const ptsString = JSON.stringify(pts)

    if (lastDispatchedRef.current === ptsString) {
      return
    }
    lastDispatchedRef.current = ptsString

    // Пробуем отправить событие напрямую в текущий документ (если мы отрендерены в той же вкладке)
    document.dispatchEvent(
      new CustomEvent('nmaps:drawObjects', {
        detail: JSON.stringify({ points: pts }),
      }),
    )

    // И отправляем через фоновый скрипт (для нативной боковой панели)
    browser.runtime.sendMessage({ action: 'DRAW_MAP_OBJECTS', points: pts }).catch(() => {
      // Игнорируем ошибку отправки
    })
  }, [points, selectedDate, isInitialized])

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
                  handleDeleteNote={handleDeleteNote}
                />
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
