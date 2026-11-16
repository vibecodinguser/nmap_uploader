import type { NoteKind } from '../model/types'

/**
 * Ключ перевода для названия вида заметки.
 *
 * Вид хранится в модели как `Point | Line | …`, а ключи локализации —
 * `notesPanel.kindPoint`: сопоставление нужно и свойствам, и автоимени, и
 * списку, поэтому живёт в одном месте.
 */
export type KindLabelKey =
  | 'notesPanel.kindPoint'
  | 'notesPanel.kindLine'
  | 'notesPanel.kindPolygon'
  | 'notesPanel.kindSquare'
  | 'notesPanel.kindCircle'

export const kindLabelKey = (kind: NoteKind): KindLabelKey =>
  `notesPanel.kind${kind}` as KindLabelKey
