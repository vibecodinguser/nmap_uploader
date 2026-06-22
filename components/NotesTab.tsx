import { Trash2, MapPin, Waypoints, Hexagon, Pencil, LocateFixed } from 'lucide-react'
import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { PointDateField } from '@/components/PointDateField'
import { displayToIso } from '@/lib/date_format'
import { POINT_PICKED_ACTION, START_POINT_PICKING_ACTION } from '@/lib/pick_point_action'
import { requireAuthBeforeAction } from '@/lib/require_auth'
import { downloadIndexJson, getStoredAuth, uploadIndexJson } from '@/lib/yandex/client'

type NotesTabProps = {
  isUploading: boolean
  isLoggedIn: boolean
  onRequireAuth: () => void
  onManualUpload: (input: {
    description: string
    latitude: string
    longitude: string
    date: string
  }) => void
}

type NotePoint = {
  id?: string
  name: string
  latitude: number
  longitude: number
  date: string
  noteTime?: string
  noteDesc?: string
  geomType: 'Point' | 'LineString' | 'Polygon'
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
}: Pick<NoteListItemProps, 'p' | 'editingName' | 'editingDesc' | 'isSavingEdit' | 'setEditingName' | 'setEditingDesc' | 'handleSaveEdit' | 'setEditingPointId'>) => (
  <div className="notes-list-item-edit-form">
    <input
      type="text"
      value={editingName}
      onChange={(e) => setEditingName(e.target.value)}
      disabled={isSavingEdit}
      className="point-description-input notes-list-item-edit-input"
      placeholder="Название"
    />
    <textarea
      value={editingDesc}
      onChange={(e) => setEditingDesc(e.target.value)}
      disabled={isSavingEdit}
      className="point-description-input notes-list-item-edit-input notes-list-item-edit-textarea"
      placeholder="Расширенное описание (необязательно)"
      rows={3}
    />
    <div className="notes-list-item-edit-actions">
      <button
        className="submit-btn--outline"
        disabled={isSavingEdit || !editingName.trim()}
        onClick={() => handleSaveEdit(p.id!)}
      >
        Сохранить
      </button>
      <button
        className="submit-btn--outline"
        disabled={isSavingEdit}
        onClick={() => setEditingPointId(null)}
      >
        Отмена
      </button>
    </div>
  </div>
)

const NoteItemContent = ({
  p,
  isExpanded,
  toggleExpand,
}: Pick<NoteListItemProps, 'p' | 'isExpanded' | 'toggleExpand'>) => (
  <button 
    type="button"
    onClick={() => toggleExpand(p.id)}
    disabled={!p.id}
    className={`notes-list-item-btn ${isExpanded ? 'notes-list-item-btn--expanded' : ''}`}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
      {p.geomType === 'Point' && <MapPin size={16} style={{ color: 'var(--nmap-text-secondary)' }} />}
      {p.geomType === 'LineString' && <Waypoints size={16} style={{ color: 'var(--nmap-text-secondary)' }} />}
      {p.geomType === 'Polygon' && <Hexagon size={16} style={{ color: 'var(--nmap-text-secondary)' }} />}
    </div>
    <strong className="notes-list-item-title">{p.name}</strong>
    {p.noteDesc && (
      <div className="notes-list-item-desc">
        <span className="notes-list-item-desc-text">{p.noteDesc}</span>
      </div>
    )}
  </button>
)

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
}: Pick<NoteListItemProps, 'p' | 'isExpanded' | 'isUploading' | 'isPicking' | 'isDeletingId' | 'setEditingPointId' | 'setEditingName' | 'setEditingDesc' | 'handleDeleteNote'>) => {
  if (!p.id) return null
  return (
    <div className={`notes-list-item-actions-wrapper ${isExpanded ? 'notes-list-item-actions-wrapper--expanded' : ''}`}>
      <button
        type="button"
        title="Показать на карте"
        onClick={() => {
          if (isUploading || isPicking) return;
          let bbox: [number, number, number, number] | undefined
          if (p.geomCoords && p.geomCoords.length > 1) {
            const lons = p.geomCoords.map(c => c[0])
            const lats = p.geomCoords.map(c => c[1])
            bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
          }
          browser.runtime.sendMessage({
            action: 'centerMap',
            latitude: p.latitude,
            longitude: p.longitude,
            bbox,
            zoom: 18,
          }).catch(console.error)
        }}
        disabled={isUploading || isPicking}
        className="notes-list-action-btn"
      >
        <LocateFixed size={16} />
      </button>
      <button
        type="button"
        title="Редактировать"
        onClick={() => {
          if (isUploading || isPicking) return;
          setEditingPointId(p.id!)
          setEditingName(p.name)
          setEditingDesc(p.noteDesc || '')
        }}
        disabled={isUploading || isPicking}
        className="notes-list-action-btn"
      >
        <Pencil size={16} />
      </button>
      <button
        type="button"
        title="Удалить"
        onClick={() => {
          if (isUploading || isPicking || isDeletingId === p.id) return;
          handleDeleteNote(p.id!)
        }}
        disabled={isUploading || isPicking || isDeletingId === p.id}
        className="notes-list-action-btn"
      >
        <Trash2 size={16} />
      </button>
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
}: Pick<NoteListItemProps, 'p' | 'isExpanded' | 'isUploading' | 'isPicking' | 'isDeletingId' | 'toggleExpand' | 'setEditingPointId' | 'setEditingName' | 'setEditingDesc' | 'handleDeleteNote'>) => (
  <div className={`notes-list-item-view ${isExpanded ? 'notes-list-item-view--expanded' : ''}`}>
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
  const [selectedDate, setSelectedDate] = useState('')
  const [points, setPoints] = useState<NotePoint[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  const [isPicking, setIsPicking] = useState(false)
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lon: number }[] | null>(null)
  const [pendingName, setPendingName] = useState('')
  const [pendingDesc, setPendingDesc] = useState('')
  const [geomType, setGeomType] = useState('Point')
  const [editingPointId, setEditingPointId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingDesc, setEditingDesc] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id?: string) => {
    if (!id) return
    setExpandedNoteIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    browser.storage.local.get(['notes_selected_date']).then((res) => {
      if (typeof res.notes_selected_date === 'string') {
        setSelectedDate(res.notes_selected_date)
      }
      setIsInitialized(true)
    })
  }, [])

  useEffect(() => {
    if (!isInitialized) return
    browser.storage.local.set({ notes_selected_date: selectedDate }).catch(() => { })
  }, [selectedDate, isInitialized])

  useEffect(() => {
    if (!isInitialized || !selectedDate) {
      setPoints([])
      return
    }

    const isoDate = displayToIso(selectedDate)
    if (!isoDate) {
      setPoints([])
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
        if (!isMounted) return
        if (nmapIndex?.points) {
          const remotePoints = Object.entries(nmapIndex.points).map(([id, pt]) => {
            let geomType: 'Point' | 'LineString' | 'Polygon' = 'Point'
            if (nmapIndex.paths?.[id]) {
              const path = nmapIndex.paths[id]
              if (path.length > 2 && path[0][0] === path.at(-1)![0] && path[0][1] === path.at(-1)![1]) {
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
              geomCoords: nmapIndex.paths?.[id] || [pt.coords],
            }
          })
          setPoints(remotePoints)
        } else {
          setPoints([])
        }
      })
      .catch(() => {
        if (isMounted) setPoints([])
      })
      .finally(() => {
        if (isMounted) setIsLoadingNotes(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedDate, isInitialized])

  const handleStartPicking = () => {
    if (!requireAuthBeforeAction({ isLoggedIn, onRequireAuth })) {
      return
    }
    setIsPicking(true)
    browser.runtime.sendMessage({ action: START_POINT_PICKING_ACTION, geomType }).catch(() => {
      setIsPicking(false)
    })
  }

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message?.action === POINT_PICKED_ACTION) {
        setIsPicking(false)
        if (Array.isArray(message.coords)) {
          const coordsArr = message.coords.map((c: number[]) => ({ lat: c[0], lon: c[1] }))
          setPendingCoords(coordsArr)
          setPendingName('')
        }
      }
    }

    browser.runtime.onMessage.addListener(handleMessage)
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  const handleSaveNote = () => {
    if (pendingCoords && pendingCoords.length > 0 && pendingName.trim()) {
      const name = pendingName.trim()
      const firstCoord = pendingCoords[0]
      const now = new Date()
      const noteTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      const desc = pendingDesc.trim()

      setPoints((prev) => [...prev, { name, latitude: firstCoord.lat, longitude: firstCoord.lon, date: selectedDate, noteTime, noteDesc: desc, geomType: geomType as 'Point' | 'LineString' | 'Polygon' }])

      // Преобразуем формат для загрузчика
      const formattedCoords = pendingCoords.map(c => [c.lon, c.lat])

      onManualUpload({
        description: name,
        coords: formattedCoords,
        geomType,
        date: selectedDate,
        note_time: noteTime,
        note_desc: desc,
      } as any)

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
    if (!newName) return

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

      setPoints(prev => prev.map(p => p.id === id ? { ...p, name: newName, noteDesc: editingDesc.trim() } : p))
      setEditingPointId(null)
    } catch (e) {
      console.error('Failed to edit point:', e)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteNote = async (id: string) => {
    if (!globalThis.confirm('Вы уверены, что хотите удалить эту заметку?')) return;
    
    setIsDeletingId(id)
    try {
      const auth = await getStoredAuth()
      if (!auth) throw new Error('No auth')
      
      const isoDate = displayToIso(selectedDate)
      if (!isoDate) throw new Error('Invalid date')

      const index = await downloadIndexJson({ token: auth.token, targetDate: isoDate })
      if (!index?.points) throw new Error('Index not found')

      delete index.points[id]
      
      await uploadIndexJson({ token: auth.token, targetDate: isoDate, data: index })

      setPoints(prev => prev.filter(p => p.id !== id))
    } catch (e) {
      console.error('Failed to delete point:', e)
    } finally {
      setIsDeletingId(null)
    }
  }

  const currentPoints = points.filter((p) => p.date === selectedDate)

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

      <div className="notes-geom-type-container">
        <label htmlFor="geomTypeSelect" className="notes-geom-type-label">Тип фигуры:</label>
        <select
          id="geomTypeSelect"
          value={geomType}
          onChange={(e) => setGeomType(e.target.value)}
          disabled={isUploading || isPicking || pendingCoords !== null}
          className="notes-geom-type-select"
        >
          <option value="Point">Точка</option>
          <option value="LineString">Линия</option>
          <option value="Polygon">Полигон</option>
        </select>
      </div>

      <div className="notes-actions">
        <button
          type="button"
          className="submit-btn--outline"
          disabled={isUploading || isPicking || !selectedDate || pendingCoords !== null}
          onClick={handleStartPicking}
        >
          {isPicking ? 'Нарисуйте на карте...' : 'Добавить заметку'}
        </button>
      </div>

      {isLoadingNotes && (
        <div className="notes-loading">
          Загрузка заметок...
        </div>
      )}

      {!isLoadingNotes && currentPoints.length > 0 && (
        <div className="notes-list notes-list-container">
          <ul className="notes-list-ul">
            {currentPoints.map((p, idx) => {
              const isExpanded = p.id ? expandedNoteIds.has(p.id) : false
              return (
              <NoteListItem
                key={p.id || idx}
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
            )})}
          </ul>
        </div>
      )}

      {pendingCoords && (
        <div className="manual-upload-container notes-manual-upload">
          <div className="notes-manual-upload-info">
            {geomType === 'Point'
              ? `Координаты: ${pendingCoords[0].lat.toFixed(5)}, ${pendingCoords[0].lon.toFixed(5)}`
              : `Фигура из ${pendingCoords.length} точек`
            }
          </div>
          <input
            type="text"
            className="point-description-input notes-manual-upload-input"
            placeholder="Описание заметки"
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            disabled={isUploading}
          />
          <textarea
            className="point-description-input notes-manual-upload-input notes-manual-upload-textarea"
            placeholder="Расширенное описание заметки (необязательно)"
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
              Сохранить
            </button>
            <button
              type="button"
              className="submit-btn--outline"
              disabled={isUploading}
              onClick={handleCancelNote}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
