import { useEffect, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import type { ManualPointInput } from '@/hooks/usePointUpload'
import { displayToIso } from '@/lib/date_format'
import {
  createDrawMapObjectsDetail,
  createDrawMapObjectsFromNmapIndex,
  createPolygonSnapTargets,
} from '@/lib/nmaps_draw_objects'
import { extractTrackerDate, type GeomType, type NotePoint } from '@/lib/notes'
import { POINT_PICKED_ACTION, START_POINT_PICKING_ACTION } from '@/lib/pick_point_action'
import { requireAuthBeforeAction } from '@/lib/require_auth'
import { downloadIndexJson, getStoredAuth, uploadIndexJson } from '@/lib/yandex/client'

export type UseNotesManagementProps = {
  isLoggedIn: boolean
  onRequireAuth: () => void
  onManualUpload: (input: ManualPointInput) => void
}

export const useNotesManagement = ({
  isLoggedIn,
  onRequireAuth,
  onManualUpload,
}: UseNotesManagementProps) => {
  const [selectedDate, setSelectedDate] = useState('')
  const [points, setPoints] = useState<NotePoint[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  const [isPicking, setIsPicking] = useState(false)
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lon: number }[] | null>(null)
  const [pendingName, setPendingName] = useState('')
  const [pendingDesc, setPendingDesc] = useState('')
  const [geomType, setGeomType] = useState<GeomType | null>(null)
  const [editingPointId, setEditingPointId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingDesc, setEditingDesc] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id?: string) => {
    if (!id) return
    setExpandedNoteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 1. Инициализация даты
  useEffect(() => {
    const initializeDate = async () => {
      try {
        const response = await browser.runtime.sendMessage({ action: 'getTrackerDate' })
        let initialDate = extractTrackerDate(response?.date)

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

  // 2. Сохранение даты в storage
  useEffect(() => {
    if (!isInitialized) return
    browser.storage.local.set({ notes_selected_date: selectedDate }).catch(() => {})
  }, [selectedDate, isInitialized])

  // 3. Загрузка точек выбранной даты
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
        if (!isMounted) return
        if (nmapIndex?.points) {
          setPoints(
            createDrawMapObjectsFromNmapIndex(nmapIndex, selectedDate).points as NotePoint[],
          )
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

  // 4. Слушатели сообщений из рантайма и окна
  useEffect(() => {
    const handleRuntimeMessage = (message: unknown) => {
      const msg = message as Record<string, unknown> | null | undefined
      if (msg?.action === POINT_PICKED_ACTION) {
        setIsPicking(false)
        if (Array.isArray(msg.coords)) {
          const coordsArr = (msg.coords as number[][]).map((c) => ({ lat: c[0], lon: c[1] }))
          setPendingCoords(coordsArr)
          setPendingName('')
        }
      } else if (msg?.action === 'TRACKER_DATE_CHANGED' && msg.date) {
        const nextDate = extractTrackerDate(msg.date)
        if (nextDate) {
          setSelectedDate(nextDate)
        }
      }
    }

    const handleWindowMessage = (event: MessageEvent) => {
      const message = event.data as Record<string, unknown> | null | undefined
      if (message?.action === 'TRACKER_DATE_CHANGED' && message.date) {
        const nextDate = extractTrackerDate(message.date)
        if (nextDate) {
          setSelectedDate(nextDate)
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

  // 5. Отрисовка объектов на карте Народной карты
  const lastDispatchedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isInitialized) return
    const pts = points.filter((p) => p.date === selectedDate)
    const detail = createDrawMapObjectsDetail(pts, createPolygonSnapTargets(pts))
    const detailString = JSON.stringify(detail)

    if (lastDispatchedRef.current === detailString) return
    lastDispatchedRef.current = detailString

    document.dispatchEvent(
      new CustomEvent('nmaps:drawObjects', {
        detail: detailString,
      }),
    )

    browser.runtime.sendMessage({ action: 'DRAW_MAP_OBJECTS', ...detail }).catch(() => {})
  }, [points, selectedDate, isInitialized])

  // Действия пользователя
  const handleStartPicking = (type: GeomType) => {
    if (!requireAuthBeforeAction({ isLoggedIn, onRequireAuth })) return
    setGeomType(type)
    setIsPicking(true)
    browser.runtime
      .sendMessage({ action: START_POINT_PICKING_ACTION, geomType: type })
      .catch(() => {
        setIsPicking(false)
      })
  }

  const handleSaveNote = () => {
    if (pendingCoords && pendingCoords.length > 0 && pendingName.trim() && geomType) {
      const name = pendingName.trim()
      const firstCoord = pendingCoords[0]
      const now = new Date()
      const noteTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      const desc = pendingDesc.trim()
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
          geomType,
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

  const handleDeleteNote = async (id: string, confirmMessage: string) => {
    if (!globalThis.confirm(confirmMessage)) return

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

  const currentPoints = points.filter((p) => p.date === selectedDate).reverse()

  return {
    selectedDate,
    setSelectedDate,
    points,
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
  }
}
