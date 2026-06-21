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
    browser.storage.local.set({ notes_selected_date: selectedDate }).catch(() => {})
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
        if (nmapIndex && nmapIndex.points) {
          const remotePoints = Object.entries(nmapIndex.points).map(([id, pt]) => ({
            id,
            name: pt.desc,
            latitude: pt.coords[1],
            longitude: pt.coords[0],
            date: selectedDate,
            noteTime: pt.note_time,
            noteDesc: pt.note_desc,
          }))
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
      
      setPoints((prev) => [...prev, { name, latitude: firstCoord.lat, longitude: firstCoord.lon, date: selectedDate, noteTime, noteDesc: desc }])

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
      if (!index || !index.points || !index.points[id]) throw new Error('Point not found')

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
            className="point-date-input--center-with-button"
          />
        </div>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
         <label style={{ display: 'block', fontSize: '12px', color: 'var(--nmap-text-secondary)', marginBottom: '4px' }}>Тип фигуры:</label>
         <select 
            value={geomType} 
            onChange={(e) => setGeomType(e.target.value)}
            disabled={isUploading || isPicking || pendingCoords !== null}
            style={{ width: '100%', padding: '8px', border: '1px solid var(--nmap-border)', borderRadius: '4px', background: 'var(--nmap-bg-secondary)' }}
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
        <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--nmap-text-secondary)' }}>
          Загрузка заметок...
        </div>
      )}

      {!isLoadingNotes && currentPoints.length > 0 && (
        <div className="notes-list" style={{ marginTop: '16px' }}>
          <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
            {currentPoints.map((p, idx) => (
              <li key={p.id || idx} style={{ marginBottom: '8px', padding: '8px', border: '1px solid var(--nmap-border)', borderRadius: '4px' }}>
                {editingPointId === p.id && p.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input 
                      type="text" 
                      value={editingName} 
                      onChange={(e) => setEditingName(e.target.value)} 
                      disabled={isSavingEdit}
                      className="point-description-input"
                      placeholder="Название"
                      style={{ padding: '8px', boxSizing: 'border-box' }}
                    />
                    <textarea
                      value={editingDesc}
                      onChange={(e) => setEditingDesc(e.target.value)}
                      disabled={isSavingEdit}
                      className="point-description-input"
                      placeholder="Расширенное описание (необязательно)"
                      rows={3}
                      style={{ padding: '8px', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="submit-btn--outline" 
                        style={{ flex: 1 }}
                        disabled={isSavingEdit || !editingName.trim()}
                        onClick={() => handleSaveEdit(p.id!)}
                      >
                        Сохранить
                      </button>
                      <button 
                        className="submit-btn--outline" 
                        style={{ flex: 1 }}
                        disabled={isSavingEdit}
                        onClick={() => setEditingPointId(null)}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        {p.noteTime && <span style={{ marginRight: '4px', color: 'var(--nmap-text-secondary)' }}>[{p.noteTime}]</span>}
                        <strong>{p.name}</strong>
                      </div>
                      {p.id && (
                        <button 
                          className="submit-btn--outline" 
                          style={{ padding: '4px 8px', fontSize: '12px', minHeight: 'auto', width: 'auto' }}
                          disabled={isUploading || isPicking}
                          onClick={() => {
                            setEditingPointId(p.id!)
                            setEditingName(p.name)
                            setEditingDesc(p.noteDesc || '')
                          }}
                        >
                          Редактировать
                        </button>
                      )}
                    </div>
                    {p.noteDesc && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--nmap-text-primary)', whiteSpace: 'pre-wrap' }}>
                        {p.noteDesc}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendingCoords && (
        <div className="manual-upload-container" style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--muted)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
            {geomType === 'Point' 
               ? `Координаты: ${pendingCoords[0].lat.toFixed(5)}, ${pendingCoords[0].lon.toFixed(5)}` 
               : `Фигура из ${pendingCoords.length} точек`
            }
          </div>
          <input
            type="text"
            className="point-description-input"
            placeholder="Описание заметки"
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            disabled={isUploading}
            style={{ marginBottom: '12px' }}
          />
          <textarea
            className="point-description-input"
            placeholder="Расширенное описание заметки (необязательно)"
            value={pendingDesc}
            onChange={(e) => setPendingDesc(e.target.value)}
            disabled={isUploading}
            rows={3}
            style={{ marginBottom: '12px', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="submit-btn--outline"
              disabled={isUploading || !pendingName.trim()}
              onClick={handleSaveNote}
              style={{ flex: 1 }}
            >
              Сохранить
            </button>
            <button
              type="button"
              className="submit-btn--outline"
              disabled={isUploading}
              onClick={handleCancelNote}
              style={{ flex: 1 }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
