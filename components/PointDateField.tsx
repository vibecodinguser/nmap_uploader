import { Calendar } from 'lucide-react';
import {
  type ChangeEvent,
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { DayPicker, UI } from 'react-day-picker';
import { enUS, ru } from 'react-day-picker/locale';
import { useLocale, useTranslate } from '@/hooks/useLocale';
import { useOccupiedDates } from '@/hooks/useOccupiedDates';
import {
  formatDateDisplay,
  formatDateDisplayInput,
  formatDateIso,
  parseDateDisplay,
} from '@/lib/date_format';
import 'react-day-picker/style.css';

const POPOVER_WIDTH = 378;

const DAY_PICKER_LOCALES = {
  en: enUS,
  ru,
} as const;

const INPUT_CLASS_NAMES = {
  default: 'point-date-input',
  centered: 'point-date-input point-date-input--center-with-button',
} as const;

function onRefreshOccupiedDatesSettled(): void {
  // refreshOccupiedDates handles errors internally; suppress unhandled rejection.
}

function handleRefreshOccupiedDatesTask(task: Promise<void>): void {
  task.catch(onRefreshOccupiedDatesSettled);
}

function getDayPickerLocale(locale: 'ru' | 'en') {
  return DAY_PICKER_LOCALES[locale];
}

function getInputClassName(centerPlaceholderWithButton: boolean): string {
  let classNameKey: keyof typeof INPUT_CLASS_NAMES = 'default';
  if (centerPlaceholderWithButton) {
    classNameKey = 'centered';
  }
  return INPUT_CLASS_NAMES[classNameKey];
}

function getCalendarAriaControls(isOpen: boolean, popoverId: string): string | undefined {
  let result: string | undefined;
  if (isOpen) {
    result = popoverId;
  }
  return result;
}

function removeLayoutListeners(): void {
  window.removeEventListener('resize', dispatchLayoutChange);
  window.removeEventListener('scroll', dispatchLayoutChange, true);
}

type LayoutEffectRegistration = {
  updatePopoverPosition: () => void;
};

type PointerDownRegistration = {
  containerRef: RefObject<HTMLDivElement | null>;
  closeCalendar: () => void;
};

const layoutEffectRegistrations = new Set<LayoutEffectRegistration>();
const pointerDownRegistrations = new Set<PointerDownRegistration>();

let layoutGlobalListenersAttached = false;
let pointerDownGlobalListenerAttached = false;

function onLayoutChange(updatePopoverPosition: () => void): void {
  updatePopoverPosition();
}

function dispatchLayoutChange(): void {
  for (const registration of layoutEffectRegistrations) {
    onLayoutChange(registration.updatePopoverPosition);
  }
}

function attachLayoutGlobalListeners(): void {
  if (!layoutGlobalListenersAttached) {
    window.addEventListener('resize', dispatchLayoutChange);
    window.addEventListener('scroll', dispatchLayoutChange, true);
    layoutGlobalListenersAttached = true;
  }
}

function detachLayoutGlobalListeners(): void {
  if (layoutGlobalListenersAttached && layoutEffectRegistrations.size === 0) {
    removeLayoutListeners();
    layoutGlobalListenersAttached = false;
  }
}

function registerLayoutEffect(registration: LayoutEffectRegistration): void {
  layoutEffectRegistrations.add(registration);
  attachLayoutGlobalListeners();
}

function unregisterLayoutEffect(registration: LayoutEffectRegistration): void {
  layoutEffectRegistrations.delete(registration);
  detachLayoutGlobalListeners();
}

function dispatchPointerDown(event: PointerEvent): void {
  for (const registration of pointerDownRegistrations) {
    onPointerDown(registration.containerRef, registration.closeCalendar, event);
  }
}

function attachPointerDownGlobalListener(): void {
  if (!pointerDownGlobalListenerAttached) {
    document.addEventListener('pointerdown', dispatchPointerDown);
    pointerDownGlobalListenerAttached = true;
  }
}

function detachPointerDownGlobalListener(): void {
  if (pointerDownGlobalListenerAttached && pointerDownRegistrations.size === 0) {
    document.removeEventListener('pointerdown', dispatchPointerDown);
    pointerDownGlobalListenerAttached = false;
  }
}

function registerPointerDown(registration: PointerDownRegistration): void {
  pointerDownRegistrations.add(registration);
  attachPointerDownGlobalListener();
}

function unregisterPointerDown(registration: PointerDownRegistration): void {
  pointerDownRegistrations.delete(registration);
  detachPointerDownGlobalListener();
}

function runLayoutEffect(
  isOpen: boolean,
  updatePopoverPosition: () => void,
): LayoutEffectRegistration | null {
  let registration: LayoutEffectRegistration | null = null;
  if (isOpen) {
    updatePopoverPosition();
    registration = { updatePopoverPosition };
    registerLayoutEffect(registration);
  }
  return registration;
}

function cleanupLayoutEffect(registration: LayoutEffectRegistration | null): void {
  if (registration) {
    unregisterLayoutEffect(registration);
  }
}

function runStoredLayoutCleanup(registrationRef: RefObject<LayoutEffectRegistration | null>): void {
  cleanupLayoutEffect(registrationRef.current);
  registrationRef.current = null;
}

function onPointerDown(
  containerRef: RefObject<HTMLDivElement | null>,
  closeCalendar: () => void,
  event: PointerEvent,
): void {
  const root = containerRef.current;
  const eventPath = event.composedPath();
  const clickedInside = root !== null && eventPath.includes(root);
  if (!clickedInside) {
    closeCalendar();
  }
}

function runPointerDownEffect(
  isOpen: boolean,
  containerRef: RefObject<HTMLDivElement | null>,
  closeCalendar: () => void,
): PointerDownRegistration | null {
  let registration: PointerDownRegistration | null = null;
  if (isOpen) {
    registration = { containerRef, closeCalendar };
    registerPointerDown(registration);
  }
  return registration;
}

function cleanupPointerDownEffect(registration: PointerDownRegistration | null): void {
  if (registration) {
    unregisterPointerDown(registration);
  }
}

function runStoredPointerDownCleanup(
  registrationRef: RefObject<PointerDownRegistration | null>,
): void {
  cleanupPointerDownEffect(registrationRef.current);
  registrationRef.current = null;
}

type PointDateFieldProps = {
  id: string;
  name?: string;
  value: string;
  disabled?: boolean;
  centerPlaceholderWithButton?: boolean;
  onChange: (value: string) => void;
};

export const PointDateField = ({
  id,
  name = 'date',
  value,
  disabled = false,
  centerPlaceholderWithButton = false,
  onChange,
}: PointDateFieldProps) => {
  const t = useTranslate();
  const { locale } = useLocale();
  const dayPickerLocale = getDayPickerLocale(locale);
  const popoverId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const { occupiedDates, isLoading, refreshOccupiedDates } = useOccupiedDates();
  const selectedDate = parseDateDisplay(value);
  const inputClassName = getInputClassName(centerPlaceholderWithButton);
  const calendarAriaControls = getCalendarAriaControls(isOpen, popoverId);
  const layoutRegistrationRef = useRef<LayoutEffectRegistration | null>(null);
  const pointerDownRegistrationRef = useRef<PointerDownRegistration | null>(null);

  const cleanupStoredLayoutEffect = useCallback(function cleanupStoredLayoutEffect(): void {
    runStoredLayoutCleanup(layoutRegistrationRef);
  }, []);

  const cleanupStoredPointerDownEffect = useCallback(
    function cleanupStoredPointerDownEffect(): void {
      runStoredPointerDownCleanup(pointerDownRegistrationRef);
    },
    [],
  );

  const closeCalendar = useCallback(function closeCalendar(): void {
    setIsOpen(false);
  }, []);

  const openCalendar = useCallback(
    function openCalendar(): void {
      if (!disabled) {
        setIsOpen(true);
        const refreshTask = refreshOccupiedDates();
        handleRefreshOccupiedDatesTask(refreshTask);
      }
    },
    [disabled, refreshOccupiedDates],
  );

  const updatePopoverPosition = useCallback(function updatePopoverPosition(): void {
    const input = inputRef.current;
    if (input) {
      const rect = input.getBoundingClientRect();
      const gap = 6;
      const viewportPadding = 8;
      const popoverWidth = Math.min(POPOVER_WIDTH, window.innerWidth - viewportPadding * 2);
      let left = rect.left;

      if (left + popoverWidth > window.innerWidth - viewportPadding) {
        left = window.innerWidth - viewportPadding - popoverWidth;
      }
      if (left < viewportPadding) {
        left = viewportPadding;
      }

      setPopoverStyle({
        top: rect.bottom + gap,
        left,
        width: popoverWidth,
      });
    }
  }, []);

  useEffect(
    function subscribeLayout(): () => void {
      layoutRegistrationRef.current = runLayoutEffect(isOpen, updatePopoverPosition);
      return cleanupStoredLayoutEffect;
    },
    [isOpen, updatePopoverPosition, cleanupStoredLayoutEffect],
  );

  useEffect(
    function subscribePointerDown(): () => void {
      pointerDownRegistrationRef.current = runPointerDownEffect(
        isOpen,
        containerRef,
        closeCalendar,
      );
      return cleanupStoredPointerDownEffect;
    },
    [isOpen, closeCalendar, cleanupStoredPointerDownEffect],
  );

  const handleTriggerClick = function handleTriggerClick(): void {
    if (isOpen) {
      closeCalendar();
    } else {
      openCalendar();
    }
  };

  const handleSelect = function handleSelect(date: Date | undefined): void {
    if (date) {
      const displayValue = formatDateDisplay(date);
      onChange(displayValue);
      closeCalendar();
    }
  };

  const handleInputChange = function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const formattedValue = formatDateDisplayInput(event.target.value);
    onChange(formattedValue);
  };

  const isOccupiedDate = useCallback(
    function checkOccupiedDate(date: Date): boolean {
      const isoDate = formatDateIso(date);
      return occupiedDates.has(isoDate);
    },
    [occupiedDates],
  );

  return (
    <div className="coords-field coords-field--date" ref={containerRef}>
      <label htmlFor={id}>{t('dateField.label')}</label>
      <div className="point-date-control">
        <div className={inputClassName} ref={inputRef}>
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
            aria-controls={calendarAriaControls}
            onChange={handleInputChange}
            onFocus={openCalendar}
          />
          <button
            type="button"
            className="point-date-trigger"
            disabled={disabled}
            aria-label={t('dateField.openCalendarAria')}
            aria-expanded={isOpen}
            aria-controls={calendarAriaControls}
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
              classNames={{
                [UI.Root]: 'rdp-root',
                [UI.DayButton]: 'rdp-day_button',
              }}
              modifiers={{
                occupied: isOccupiedDate,
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
  );
};
