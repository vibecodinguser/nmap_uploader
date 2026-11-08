import { useEffect, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { displayToIso } from '@/lib/date_format'
import {
  createDrawMapObjectsDetail,
  createDrawMapObjectsFromNmapIndex,
  createPolygonSnapTargets,
} from '@/lib/nmaps_draw_objects'
import { extractTrackerDate, NOTES_SELECTED_DATE_STORAGE_KEY, type NotePoint } from '@/lib/notes'
import { downloadIndexJson, getStoredAuth, uploadIndexJson } from '@/lib/yandex/client'

/**
 * Управление заметками выбранной даты: загрузка списка, редактирование, удаление.
 *
 * Создание заметок живёт в сайдбаре (`lib/notes_sidebar`): попап отвечает
 * только за управление уже сохранёнными заметками.
 */
export const useNotesManagement = () => {
  const [selectedDate, setSelectedDate] = useState('')
  const [points, setPoints] = useState<NotePoint[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
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
          const res = await browser.storage.local.get([NOTES_SELECTED_DATE_STORAGE_KEY])
          const storedDate = res[NOTES_SELECTED_DATE_STORAGE_KEY]
          if (typeof storedDate === 'string') {
            initialDate = storedDate
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
    browser.storage.local.set({ [NOTES_SELECTED_DATE_STORAGE_KEY]: selectedDate }).catch(() => {})
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
      .catch((error) => {
        console.error('[nmap_uploader notes] download error:', error)
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
      if (msg?.action === 'TRACKER_DATE_CHANGED' && msg.date) {
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

    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({ action: 'DRAW_MAP_OBJECTS', detail }, '*')
    }

    document.dispatchEvent(
      new CustomEvent('nmaps:drawObjects', {
        detail: detailString,
      }),
    )

    browser.runtime.sendMessage({ action: 'DRAW_MAP_OBJECTS', ...detail }).catch(() => {})
  }, [points, selectedDate, isInitialized])

  // Действия пользователя
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
    handleSaveEdit,
    handleDeleteNote,
  }
}
