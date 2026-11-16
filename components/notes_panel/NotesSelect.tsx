import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

export interface NotesSelectOption {
  value: string
  label: string
}

/** Пауза, после которой набор букв перестаёт считаться одним словом. */
const TYPEAHEAD_RESET_MS = 600

/** Зазор между кнопкой и списком — как у нативного попапа. */
const POPUP_GAP = 4

/** Предел высоты списка: выше — прокрутка, как у `nk-menu` в попапе. */
const POPUP_MAX_HEIGHT = 280

/** Отступ от края окна, чтобы список не прилипал к рамке. */
const VIEWPORT_MARGIN = 8

const clampIndex = (index: number, length: number): number =>
  Math.min(Math.max(index, 0), Math.max(length - 1, 0))

interface Anchor {
  left: number
  top: number
  bottom: number
  width: number
}

interface Placement {
  anchor: Anchor
  side: 'top' | 'bottom'
  /** Левый край уже с поправкой на ширину содержимого. */
  left: number
}

/**
 * Выпадающий список в духе нативного `nk-select` редактора.
 *
 * Панель живёт в отдельном iframe, поэтому классов `nk-*` в ней нет — рисунок
 * повторён по боевому CSS редактора:
 *
 *   `.nk-select__tick:after`     стрелка-маска 11×6, поворот на 180° при
 *                                открытии, `transition: transform .1s ease-out`
 *   `.nk-popup_theme_islands`    тень `0 0 0 1px rgb(0 0 0 / 10%)` плюс
 *                                `0 10px 20px -5px rgb(0 0 0 / 40%)`
 *   `@keyframes …_bottom_visible`
 *                                список выезжает снизу: `translateY(10px)` →
 *                                `translateY(0)` за 0.1s ease-out
 *   `.nk-menu_size_m`            13px, отступ пункта 13px, подсветка наведённого
 *   `.nk-menu-item_checked`      отмеченный пункт получает ту же галочку-маску,
 *                                что и чекбокс, в жёлобе на 13 px
 *
 * Одно отличие, осознанное: пункты выше нативных 24 px. Панель считается под
 * палец — как и чекбокс, рисунок сохранён, а размер увеличен.
 *
 * Список расширяется по содержимому, а не по кнопке: у нативного `nk-select`
 * попап шире кнопки, если в пунктах длинные названия — иначе группа с длинным
 * именем обрезалась бы многоточием. Ширину задаёт CSS (`width: max-content`),
 * а `left` считается уже по ней: если список вылезает за правый край, он
 * сдвигается влево.
 *
 * Список рисуется в портале на `body`, как `nk-popup` в редакторе, и это не
 * украшение: панель фильтров живёт внутри `.notes-panel__body` с
 * `overflow: hidden`, поэтому список, раскрытый вверх, обрезался бы его границей.
 * Координаты считаются от окна и пересчитываются при прокрутке и изменении
 * размера — иначе список отрывается от кнопки.
 *
 * Поведение — стандартный паттерн combobox + listbox: фокус остаётся на
 * кнопке, стрелки двигают подсветку через `aria-activedescendant`, Enter и
 * пробел выбирают, Escape и Tab закрывают без выбора.
 */
export const NotesSelect = ({
  id,
  label,
  value,
  options,
  onChange,
  block = false,
}: {
  id?: string
  label: string
  value: string
  options: readonly NotesSelectOption[]
  onChange: (value: string) => void
  /** Растянуть на всю ширину поля — для карточки объекта. */
  block?: boolean
}) => {
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const typeahead = useRef({ text: '', timer: 0 })

  const baseId = useId()
  const popupId = `${baseId}-popup`
  const optionId = (index: number): string => `${baseId}-option-${index}`

  const open = placement !== null
  const selectedIndex = options.findIndex((option) => option.value === value)
  const current = selectedIndex >= 0 ? options[selectedIndex] : options[0]

  /*
   * Замер положения.
   *
   * Ширину списка задаёт CSS (`width: max-content`), поэтому её приходится
   * читать из DOM уже после монтирования: без неё не посчитать `left`, и список
   * вылез бы за правый край окна.
   */
  const measure = useCallback((side?: 'top' | 'bottom'): Placement | null => {
    const button = buttonRef.current
    if (!button) return null

    const rect = button.getBoundingClientRect()
    const anchor: Anchor = {
      left: rect.left,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
    }

    const popup = popupRef.current
    const width = popup?.offsetWidth ?? anchor.width
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(anchor.left, window.innerWidth - width - VIEWPORT_MARGIN),
    )

    if (side) return { anchor, side, left }

    const height = Math.min(popup?.offsetHeight ?? 0, POPUP_MAX_HEIGHT)
    const spaceBelow = window.innerHeight - rect.bottom - POPUP_GAP
    const spaceAbove = rect.top - POPUP_GAP
    const fitsBelow = spaceBelow >= height
    return { anchor, side: fitsBelow || spaceBelow >= spaceAbove ? 'bottom' : 'top', left }
  }, [])

  const openMenu = useCallback(
    (index?: number) => {
      setActiveIndex(clampIndex(index ?? Math.max(selectedIndex, 0), options.length))
      // Первый замер — без списка: он ещё не смонтирован, высота неизвестна.
      // Направление уточнится в useLayoutEffect, когда список уже в DOM.
      setPlacement((previous) => previous ?? measure())
    },
    [measure, options.length, selectedIndex],
  )

  const closeMenu = useCallback((returnFocus: boolean) => {
    setPlacement(null)
    if (returnFocus) buttonRef.current?.focus()
  }, [])

  const commit = useCallback(
    (index: number) => {
      const option = options[index]
      if (!option) return
      onChange(option.value)
      closeMenu(true)
    },
    [closeMenu, onChange, options],
  )

  // Клик мимо списка закрывает его без выбора — как у нативного попапа.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null
      if (!target) return
      if (buttonRef.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      closeMenu(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [closeMenu, open])

  /*
   * Точное положение и направление считаем после монтирования списка: только
   * тогда известны его размеры. `useLayoutEffect` — чтобы список не успел
   * мигнуть не на той стороне и не на той ширине.
   */
  useLayoutEffect(() => {
    if (!open) return
    const next = measure()
    if (!next) return
    setPlacement((previous) =>
      previous &&
      previous.side === next.side &&
      previous.left === next.left &&
      previous.anchor.top === next.anchor.top &&
      previous.anchor.left === next.anchor.left &&
      previous.anchor.width === next.anchor.width
        ? previous
        : next,
    )
  }, [measure, open])

  // Прокрутка (в том числе внутри списка заметок) и смена размера сдвигают
  // кнопку: список должен ехать за ней, а не оставаться на месте.
  useEffect(() => {
    if (!open) return

    const update = (): void => {
      setPlacement((previous) => {
        const next = measure(previous?.side)
        if (!next) return previous
        if (
          previous &&
          previous.anchor.top === next.anchor.top &&
          previous.anchor.left === next.anchor.left &&
          previous.anchor.width === next.anchor.width &&
          previous.left === next.left
        ) {
          return previous
        }
        return next
      })
    }

    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [measure, open])

  // Подсветка не должна уезжать за край прокручиваемого списка.
  useEffect(() => {
    if (!open) return
    popupRef.current
      ?.querySelector(`[data-index='${activeIndex}']`)
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex, open])

  useEffect(() => () => window.clearTimeout(typeahead.current.timer), [])

  const move = (delta: number): void => {
    setActiveIndex((index) => clampIndex(index + delta, options.length))
  }

  /*
   * Набор с клавиатуры, как в нативном списке: буквы складываются в слово и
   * через TYPEAHEAD_RESET_MS начинают новое.
   */
  const onTypeahead = (key: string): void => {
    const state = typeahead.current
    window.clearTimeout(state.timer)
    state.timer = window.setTimeout(() => {
      state.text = ''
    }, TYPEAHEAD_RESET_MS)
    state.text += key.toLowerCase()

    const from = open ? activeIndex : Math.max(selectedIndex, 0)
    const found = options.findIndex(
      (option, index) => index > from && option.label.toLowerCase().startsWith(state.text),
    )
    const wrapped =
      found === -1
        ? options.findIndex((option) => option.label.toLowerCase().startsWith(state.text))
        : found

    if (wrapped === -1) return
    openMenu(wrapped)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (open) move(1)
        else openMenu(Math.max(selectedIndex, 0))
        break
      case 'ArrowUp':
        event.preventDefault()
        if (open) move(-1)
        else openMenu(Math.max(selectedIndex, 0))
        break
      case 'Home':
        if (!open) return
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        if (!open) return
        event.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (open) commit(activeIndex)
        else openMenu(Math.max(selectedIndex, 0))
        break
      case 'Escape':
        if (!open) return
        event.preventDefault()
        closeMenu(true)
        break
      case 'Tab':
        if (open) closeMenu(false)
        break
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          onTypeahead(event.key)
        }
    }
  }

  /*
   * Ширину списка не задаём: её определяет содержимое (`max-content`), а
   * `min-width` держит её не уже кнопки — как у нативного попапа, который
   * расширяется под длинное название группы.
   */
  const popupStyle = placement
    ? {
        left: placement.left,
        minWidth: placement.anchor.width,
        ...(placement.side === 'bottom'
          ? { top: placement.anchor.bottom + POPUP_GAP }
          : { bottom: window.innerHeight - placement.anchor.top + POPUP_GAP }),
      }
    : undefined

  return (
    <div
      className={`notes-panel__select${block ? ' notes-panel__select--block' : ''}`}
      data-open={open}
    >
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className="notes-panel__select-button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        aria-label={label}
        onClick={() => {
          if (open) closeMenu(true)
          else openMenu(Math.max(selectedIndex, 0))
        }}
        onKeyDown={onKeyDown}
      >
        <span className="notes-panel__select-text">{current?.label ?? ''}</span>
        <span className="notes-panel__select-tick" aria-hidden="true" />
      </button>

      {open &&
        popupStyle &&
        createPortal(
          <div
            ref={popupRef}
            id={popupId}
            className="notes-panel__select-popup"
            data-placement={placement.side}
            style={popupStyle}
            role="listbox"
            aria-label={label}
          >
            {options.map((option, index) => {
              const selected = option.value === value
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: фокус не покидает кнопку, клавиатуру обрабатывает она
                <div
                  key={option.value}
                  id={optionId(index)}
                  className="notes-panel__select-option"
                  data-index={index}
                  data-active={index === activeIndex}
                  data-selected={selected}
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(index)}
                >
                  <span className="notes-panel__select-check" aria-hidden="true" />
                  <span className="notes-panel__select-option-text">{option.label}</span>
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
