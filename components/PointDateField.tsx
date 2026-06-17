import { Calendar } from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useId, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { enUS, ru } from 'react-day-picker/locale'
import { useLocale, useTranslate } from '@/hooks/useLocale'
import { useOccupiedDates } from '@/hooks/useOccupiedDates'
import {
  formatDateDisplay,
  formatDateDisplayInput,
  formatDateIso,
  parseDateDisplay,
} from '@/lib/date_format'
import 'react-day-picker/style.css'

const POPOVER_WIDTH = 378

type PointDateFieldProps = {
  id: string
  name?: string
  value: string
  disabled?: boolean
  centerPlaceholderWithButton?: boolean
  onChange: (value: string) => void
}

export const PointDateField = ({
  id,
  name = 'date',
  value,
  disabled = false,
  centerPlaceholderWithButton = false,
  onChange,
}: PointDateFieldProps) => {
  const t = useTranslate()
  const { locale } = useLocale()
  const dayPickerLocale = locale === 'en' ? enUS : ru
  const popoverId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({})
  const { occupiedDates, isLoading, refreshOccupiedDates } = useOccupiedDates()
  const selectedDate = parseDateDisplay(value)

  const closeCalendar = useCallback(() => {
    setIsOpen(false)
  }, [])

  const openCalendar = useCallback(() => {
    if (disabled) return
    setIsOpen(true)
    void refreshOccupiedDates()
  }, [disabled, refreshOccupiedDates])

  const updatePopoverPosition = useCallback(() => {
    const input = inputRef.current
    if (!input) return

    const rect = input.getBoundingClientRect()
    const gap = 6
    const viewportPadding = 8
    const popoverWidth = Math.min(POPOVER_WIDTH, window.innerWidth - viewportPadding * 2)
    let left = rect.left

    if (left + popoverWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - viewportPadding - popoverWidth
    }
    if (left < viewportPadding) {
      left = viewportPadding
    }

    setPopoverStyle({
      top: rect.bottom + gap,
      left,
      width: popoverWidth,
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return

    updatePopoverPosition()

    const handleLayoutChange = () => {
      updatePopoverPosition()
    }

    window.addEventListener('resize', handleLayoutChange)
    window.addEventListener('scroll', handleLayoutChange, true)
    return () => {
      window.removeEventListener('resize', handleLayoutChange)
      window.removeEventListener('scroll', handleLayoutChange, true)
    }
  }, [isOpen, updatePopoverPosition])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const root = containerRef.current
      if (!root) return
      if (event.composedPath().includes(root)) return
      closeCalendar()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen, closeCalendar])

  const handleTriggerClick = () => {
    if (isOpen) {
      closeCalendar()
      return
    }
    openCalendar()
  }

  const handleSelect = (date: Date | undefined) => {
    if (!date) return
    onChange(formatDateDisplay(date))
    closeCalendar()
  }

  return (
    <div className="coords-field coords-field--date" ref={containerRef}>
      <label htmlFor={id}>{t('dateField.label')}</label>
      <div className="point-date-control">
        <div
          className={
            centerPlaceholderWithButton
              ? 'point-date-input point-date-input--center-with-button'
              : 'point-date-input'
          }
          ref={inputRef}
        >
          <input
            type="text"
            id={id}
            name={name}
            value={value}
            placeholder={t('dateField.placeholder')}
            maxLength={10}
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            aria-controls={isOpen ? popoverId : undefined}
            onChange={(event) => onChange(formatDateDisplayInput(event.target.value))}
            onFocus={openCalendar}
          />
          <button
            type="button"
            className="point-date-trigger"
            disabled={disabled}
            aria-label={t('dateField.openCalendarAria')}
            aria-expanded={isOpen}
            aria-controls={isOpen ? popoverId : undefined}
            onClick={handleTriggerClick}
          >
            <Calendar size={16} aria-hidden />
          </button>
        </div>
        {isOpen && (
          <div
            className="point-date-popover"
            id={popoverId}
            role="dialog"
            aria-label={t('dateField.calendarAria')}
            style={popoverStyle}
          >
            {isLoading && (
              <p className="point-date-popover-status">{t('dateField.loadingDates')}</p>
            )}
            <DayPicker
              mode="single"
              locale={dayPickerLocale}
              weekStartsOn={1}
              selected={selectedDate}
              onSelect={handleSelect}
              modifiers={{
                occupied: (date) => occupiedDates.has(formatDateIso(date)),
              }}
              modifiersClassNames={{
                occupied: 'point-date-day--occupied',
              }}
            />
            <p className="point-date-legend">
              <span className="point-date-legend-swatch" aria-hidden />
              {t('dateField.occupiedLegend')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
