import { useEffect, useRef } from 'react'
import { useLocale } from '@/hooks/useLocale'

/** Мини-туралка «создать»: вид фигуры. */
export const ShapePicker = ({
  onPick,
  onCancel,
  busy,
}: {
  onPick: (kind: 'Point' | 'Line' | 'Polygon') => void
  onCancel: () => void
  busy: boolean
}) => {
  const { t } = useLocale()
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onCancel()
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [onCancel])

  return (
    <div className="notes-panel__shape-picker" ref={rootRef} role="menu">
      {(
        [
          ['Point', t('notesPanel.kindPoint')],
          ['Line', t('notesPanel.kindLine')],
          ['Polygon', t('notesPanel.kindPolygon')],
        ] as const
      ).map(([kind, label]) => (
        <button
          key={kind}
          type="button"
          role="menuitem"
          className="notes-panel__shape-item"
          disabled={busy}
          onClick={() => onPick(kind)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
