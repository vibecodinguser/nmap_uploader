import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

const GAP = 8
const MARGIN = 8

export type AnchoredTooltipProps = {
  label: string
  children: ReactNode
  className?: string
  disabled?: boolean
  onClick?: () => void
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max))

/**
 * Подсказка, которая всегда остаётся внутри видимой области.
 *
 * CSS-псевдоэлемент не умеет переворачиваться и обрезается границами
 * попапа, поэтому положение считается по фактическим размерам: над
 * элементом, а если сверху нет места — под ним.
 */
export const AnchoredTooltip = ({
  label,
  children,
  className,
  disabled = false,
  onClick,
}: AnchoredTooltipProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition({ visibility: 'hidden' })
      return
    }

    const anchor = anchorRef.current
    const tooltip = tooltipRef.current
    if (!anchor || !tooltip) return

    const anchorRect = anchor.getBoundingClientRect()
    const width = tooltip.offsetWidth
    const height = tooltip.offsetHeight
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = document.documentElement.clientHeight

    let top = anchorRect.top - GAP - height
    if (top < MARGIN) {
      top = anchorRect.bottom + GAP
    }
    if (top + height > viewportHeight - MARGIN) {
      top = Math.max(MARGIN, viewportHeight - MARGIN - height)
    }

    const left = clamp(
      anchorRect.left + anchorRect.width / 2 - width / 2,
      MARGIN,
      viewportWidth - MARGIN - width,
    )

    setPosition({ top, left, visibility: 'visible' })
  }, [isOpen, label])

  const show = useCallback(() => {
    if (!disabled) setIsOpen(true)
  }, [disabled])

  const hide = useCallback(() => setIsOpen(false), [])

  return (
    <span ref={anchorRef} className="notes-tooltip-anchor">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        disabled={disabled}
        className={className}
        aria-label={label}
      >
        {children}
      </button>
      {isOpen && (
        <span ref={tooltipRef} role="tooltip" className="notes-tooltip" style={position}>
          {label}
        </span>
      )}
    </span>
  )
}
