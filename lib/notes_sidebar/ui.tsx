import { useCallback, useEffect, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { PointDateField } from '@/components/PointDateField'
import { useLocale } from '@/hooks/useLocale'
import { type GeomType, NOTES_SELECTED_DATE_STORAGE_KEY } from '@/lib/notes'
import {
  CANCEL_POINT_PICKING_ACTION,
  POINT_PICKED_ACTION,
  START_POINT_PICKING_ACTION,
} from '@/lib/pick_point_action'
import { NOTES_PICK_SOURCE } from './core'
import { NOTES_ICON_PALETTE } from './icons'
import { NOTES_SIDEBAR_UPLOAD_ACTION, type SidebarNotePayload } from './upload_action'

type PickedCoords = { lat: number; lon: number }[]

type UploadStatus = { kind: 'error' | 'success'; text: string }

type UploadResponse = {
  ok?: boolean
  error?: string
  logs?: Array<{ level?: string; message?: string }>
}

/** Вершина геометрии: красный маркер с белым центром, как в нативных иконках. */
const Vertex = ({ x, y }: { x: number; y: number }) => (
  <g>
    <circle cx={x} cy={y} r="2.6" fill={NOTES_ICON_PALETTE.marker} />
    <circle cx={x} cy={y} r="1.4" fill={NOTES_ICON_PALETTE.white} />
  </g>
)

const PointTypeIcon = () => (
  <svg
    width="38"
    height="38"
    viewBox="0 0 38 38"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <ellipse cx="19" cy="32.4" rx="7" ry="2.4" fill={NOTES_ICON_PALETTE.surfaceDark} />
    <path
      fill={NOTES_ICON_PALETTE.marker}
      d="M19 3.5c-6.1 0-11 4.8-11 10.9 0 7.9 9.4 17.2 11 18.8 1.6-1.6 11-10.9 11-18.8 0-6.1-4.9-10.9-11-10.9z"
    />
    <circle cx="19" cy="14.4" r="4.6" fill={NOTES_ICON_PALETTE.white} />
  </svg>
)

const LineTypeIcon = () => (
  <svg
    width="38"
    height="38"
    viewBox="0 0 38 38"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="none"
      stroke={NOTES_ICON_PALETTE.surfaceDark}
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7.5 29 15 14.5l8 8.5 7.5-14"
    />
    <path
      fill="none"
      stroke={NOTES_ICON_PALETTE.line}
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7.5 29 15 14.5l8 8.5 7.5-14"
    />
    <Vertex x={7.5} y={29} />
    <Vertex x={15} y={14.5} />
    <Vertex x={23} y={23} />
    <Vertex x={30.5} y={9} />
  </svg>
)

const PolygonTypeIcon = () => (
  <svg
    width="38"
    height="38"
    viewBox="0 0 38 38"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill={NOTES_ICON_PALETTE.surfaceDark}
      d="M9 13.5 22.5 7l9.5 8.5-3.8 14.2-15.2 2L6 22.5z"
      transform="translate(0 1.6)"
    />
    <path fill={NOTES_ICON_PALETTE.surface} d="M9 13.5 22.5 7l9.5 8.5-3.8 14.2-15.2 2L6 22.5z" />
    <path
      fill="none"
      stroke={NOTES_ICON_PALETTE.markerDark}
      strokeWidth="1.6"
      strokeLinejoin="round"
      d="M9 13.5 22.5 7l9.5 8.5-3.8 14.2-15.2 2L6 22.5z"
    />
    <Vertex x={9} y={13.5} />
    <Vertex x={22.5} y={7} />
    <Vertex x={32} y={15.5} />
    <Vertex x={28.2} y={29.7} />
    <Vertex x={13} y={31.7} />
    <Vertex x={6} y={22.5} />
  </svg>
)

const GEOM_TYPES: Array<{
  type: GeomType
  labelKey: 'notes.typePoint' | 'notes.typeLine' | 'notes.typePolygon'
  icon: typeof PointTypeIcon
}> = [
  { type: 'Point', labelKey: 'notes.typePoint', icon: PointTypeIcon },
  { type: 'LineString', labelKey: 'notes.typeLine', icon: LineTypeIcon },
  { type: 'Polygon', labelKey: 'notes.typePolygon', icon: PolygonTypeIcon },
]

const readSelectedDate = async (): Promise<string> => {
  const stored = await browser.storage.local.get(NOTES_SELECTED_DATE_STORAGE_KEY)
  const value = stored[NOTES_SELECTED_DATE_STORAGE_KEY]
  return typeof value === 'string' ? value : ''
}

const parsePickedCoords = (message: Record<string, unknown>): PickedCoords | null => {
  if (message.action !== POINT_PICKED_ACTION || message.source !== NOTES_PICK_SOURCE) {
    return null
  }
  if (!Array.isArray(message.coords)) {
    return null
  }

  return (message.coords as unknown[])
    .filter(
      (point): point is [number, number] =>
        Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number',
    )
    .map((point) => ({ lat: point[0], lon: point[1] }))
}

const resolveUploadError = (
  response: UploadResponse | undefined,
  t: (key: 'upload.authRequired' | 'upload.saveError') => string,
): string => {
  if (response?.error === 'AUTH_REQUIRED') {
    return t('upload.authRequired')
  }
  const lastErrorLog = response?.logs?.filter((log) => log.level === 'error').at(-1)
  return lastErrorLog?.message ?? t('upload.saveError')
}

/**
 * Создание заметки в сайдбаре: тип фигуры, рисование на карте и сохранение.
 *
 * Управление заметками осталось в попапе «Блокнот»: здесь нет ни списка,
 * ни редактирования.
 */
export const NotesCreatePanel = () => {
  const { t } = useLocale()
  const [selectedDate, setSelectedDate] = useState('')
  const [geomType, setGeomType] = useState<GeomType | null>(null)
  const [isPicking, setIsPicking] = useState(false)
  const [pickedCoords, setPickedCoords] = useState<PickedCoords | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<UploadStatus | null>(null)

  useEffect(() => {
    let isMounted = true

    readSelectedDate()
      .then((date) => {
        if (isMounted) setSelectedDate(date)
      })
      .catch(() => {})

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ): void => {
      if (area !== 'local' || !(NOTES_SELECTED_DATE_STORAGE_KEY in changes)) return
      const nextDate = changes[NOTES_SELECTED_DATE_STORAGE_KEY]?.newValue
      setSelectedDate(typeof nextDate === 'string' ? nextDate : '')
    }

    browser.storage.onChanged.addListener(handleStorageChange)
    return () => {
      isMounted = false
      browser.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  useEffect(() => {
    const handleRuntimeMessage = (message: unknown): void => {
      if (!message || typeof message !== 'object') return
      const coords = parsePickedCoords(message as Record<string, unknown>)
      if (!coords) return
      setIsPicking(false)
      setStatus(null)
      // Пустой набор — рисование прервали клавишей или двойным кликом.
      if (coords.length === 0) {
        setPickedCoords(null)
        return
      }
      setPickedCoords(coords)
      setName('')
      setDesc('')
    }

    browser.runtime.onMessage.addListener(handleRuntimeMessage)
    return () => browser.runtime.onMessage.removeListener(handleRuntimeMessage)
  }, [])

  const cancelPicking = useCallback((): void => {
    browser.runtime
      .sendMessage({ action: CANCEL_POINT_PICKING_ACTION, source: NOTES_PICK_SOURCE })
      .catch(() => {})
  }, [])

  // Уход из блока во время рисования не должен оставлять оверлей на карте.
  // Следим именно за размонтированием: смена isPicking после успешного выбора
  // не должна отменять уже завершённый пикер.
  const isPickingRef = useRef(isPicking)
  useEffect(() => {
    isPickingRef.current = isPicking
  }, [isPicking])
  useEffect(() => {
    return () => {
      if (isPickingRef.current) cancelPicking()
    }
  }, [cancelPicking])

  const handleStartPicking = (type: GeomType): void => {
    if (!selectedDate) return
    setGeomType(type)
    setIsPicking(true)
    setPickedCoords(null)
    setStatus(null)
    browser.runtime
      .sendMessage({
        action: START_POINT_PICKING_ACTION,
        geomType: type,
        source: NOTES_PICK_SOURCE,
      })
      .catch(() => {
        setIsPicking(false)
      })
  }

  const handleCancelPicking = (): void => {
    setIsPicking(false)
    setPickedCoords(null)
    setStatus(null)
    cancelPicking()
  }

  const handleCancelForm = (): void => {
    setPickedCoords(null)
    setName('')
    setDesc('')
    setStatus(null)
  }

  const handleDateChange = (value: string): void => {
    setSelectedDate(value)
    browser.storage.local.set({ [NOTES_SELECTED_DATE_STORAGE_KEY]: value }).catch(() => {})
  }

  const handleSave = async (): Promise<void> => {
    if (!pickedCoords || !geomType || !name.trim()) return

    const payload: SidebarNotePayload = {
      coords: pickedCoords.map((point) => [point.lon, point.lat]),
      geomType,
      name: name.trim(),
      desc: desc.trim(),
      date: selectedDate,
    }

    setIsSaving(true)
    setStatus(null)
    try {
      const response = (await browser.runtime.sendMessage({
        action: NOTES_SIDEBAR_UPLOAD_ACTION,
        note: payload,
      })) as UploadResponse | undefined

      if (response?.ok) {
        setPickedCoords(null)
        setName('')
        setDesc('')
        setStatus({ kind: 'success', text: t('notes.saved') })
      } else {
        setStatus({ kind: 'error', text: resolveUploadError(response, t) })
      }
    } catch {
      setStatus({ kind: 'error', text: t('upload.saveError') })
    } finally {
      setIsSaving(false)
    }
  }

  const isBusy = isSaving || isPicking

  return (
    <div id="nmap-notes-create-panel" className="nmap-notes-create">
      <PointDateField
        id="nmap-notes-date"
        name="notesDate"
        value={selectedDate}
        disabled={isBusy}
        centerPlaceholderWithButton
        onChange={handleDateChange}
      />

      <div className="nmap-notes-create__types">
        {GEOM_TYPES.map(({ type, labelKey, icon: Icon }) => (
          <button
            key={type}
            type="button"
            className={`nmap-notes-create__type ${
              isPicking && geomType === type ? 'nmap-notes-create__type_active' : ''
            }`}
            aria-pressed={isPicking && geomType === type}
            onClick={() => handleStartPicking(type)}
            disabled={isBusy || !selectedDate}
          >
            <Icon />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {!selectedDate && <p className="nmap-notes-create__hint">{t('notes.dateRequired')}</p>}

      {isPicking && (
        <div className="nmap-notes-create__picking">
          <p className="nmap-notes-create__hint">{t('notes.drawOnMap')}</p>
          <button type="button" className="nmap-notes-create__link" onClick={handleCancelPicking}>
            {t('notes.cancel')}
          </button>
        </div>
      )}

      {pickedCoords && !isPicking && (
        <div className="nmap-notes-create__form">
          <p className="nmap-notes-create__hint">
            {geomType === 'Point'
              ? t('notes.coordsLabel', {
                  lat: pickedCoords[0].lat.toFixed(6),
                  lon: pickedCoords[0].lon.toFixed(6),
                })
              : t('notes.figureOfPoints', { count: pickedCoords.length })}
          </p>
          <input
            type="text"
            className="nmap-notes-create__field"
            placeholder={t('notes.namePlaceholder')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSaving}
          />
          <textarea
            className="nmap-notes-create__field nmap-notes-create__textarea"
            placeholder={t('notes.descPlaceholder')}
            value={desc}
            onChange={(event) => setDesc(event.target.value)}
            disabled={isSaving}
            rows={3}
          />
          <div className="nmap-notes-create__actions">
            <button
              type="button"
              className="nmap-notes-create__action nk-button nk-button_theme_islands nk-button_size_m nk-button_view_action"
              disabled={isSaving || !name.trim()}
              onClick={() => {
                void handleSave()
              }}
            >
              <span className="nk-button__text">{t('notes.save')}</span>
            </button>
            <button
              type="button"
              className="nmap-notes-create__action nk-button nk-button_theme_islands nk-button_size_m"
              disabled={isSaving}
              onClick={handleCancelForm}
            >
              <span className="nk-button__text">{t('notes.cancel')}</span>
            </button>
          </div>
        </div>
      )}

      {status && (
        <p
          className={`nmap-notes-create__status nmap-notes-create__status_${status.kind}`}
          role="status"
        >
          {status.text}
        </p>
      )}
    </div>
  )
}
