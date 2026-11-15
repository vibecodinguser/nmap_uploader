import { useEffect, useRef } from 'react'
import { useLocale } from '@/hooks/useLocale'
import type { DrawableNoteKind } from '@/lib/notes/messages'
import { NoteKindIcon } from './NoteKindIcon'

type ShapeOption = {
  kind: DrawableNoteKind
  labelKey:
    | 'notesPanel.kindPoint'
    | 'notesPanel.kindLine'
    | 'notesPanel.kindPolygon'
    | 'notesPanel.kindSquare'
    | 'notesPanel.kindCircle'
  /** Как фигура рисуется: кликами по вершинам или протяжкой. */
  hintKey: 'notesPanel.drawHintClicks' | 'notesPanel.drawHintDrag'
}

const SHAPES: ShapeOption[] = [
  { kind: 'Point', labelKey: 'notesPanel.kindPoint', hintKey: 'notesPanel.drawHintClicks' },
  { kind: 'Line', labelKey: 'notesPanel.kindLine', hintKey: 'notesPanel.drawHintClicks' },
  { kind: 'Polygon', labelKey: 'notesPanel.kindPolygon', hintKey: 'notesPanel.drawHintClicks' },
  { kind: 'Square', labelKey: 'notesPanel.kindSquare', hintKey: 'notesPanel.drawHintDrag' },
  { kind: 'Circle', labelKey: 'notesPanel.kindCircle', hintKey: 'notesPanel.drawHintDrag' },
]

/** Мини-туралка «создать»: вид фигуры. */
export const ShapePicker = ({
  onPick,
  onCancel,
  busy,
}: {
  onPick: (kind: DrawableNoteKind) => void
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
      {SHAPES.map(({ kind, labelKey, hintKey }) => (
        <button
          key={kind}
          type="button"
          role="menuitem"
          className="notes-panel__shape-item"
          data-kind={kind}
          title={t(hintKey)}
          disabled={busy}
          onClick={() => onPick(kind)}
        >
          <span className="notes-panel__shape-item-icon" aria-hidden="true">
            <NoteKindIcon kind={kind} size={16} />
          </span>
          {t(labelKey)}
        </button>
      ))}
    </div>
  )
}
