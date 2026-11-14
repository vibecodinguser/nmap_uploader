import { isFilledKind, type NoteKind } from './types'

/**
 * Палитра заметок.
 *
 * Цвета подобраны одной насыщенностью: на карте с тысячами объектов случайные
 * оттенки неразличимы. Свой цвет пользователь всё равно может выбрать пипеткой.
 */
export const NOTE_PALETTE = [
  '#e96b7c',
  '#f25767',
  '#ff8c42',
  '#ffb020',
  '#c2b400',
  '#5aa845',
  '#2f9e6e',
  '#1a8cff',
  '#4f6dd6',
  '#8a5cd6',
  '#c44fa0',
  '#7a7a7a',
] as const

export const DEFAULT_NOTE_COLOR = NOTE_PALETTE[7]

export const HATCH_PATTERNS = ['diagonal', 'backDiagonal', 'grid', 'dots', 'horizontal'] as const

export const DEFAULT_HATCH = {
  pattern: 'diagonal',
  color: '#3d3d3d',
  width: 2,
} as const

export const NOTE_TEXT_COLOR = '#1f1f1f'

/** Прозрачность по умолчанию зависит от вида: заливка есть только у площадных. */
export const defaultOpacity = (kind: NoteKind): number => (isFilledKind(kind) ? 0.85 : 1)

export const NOTE_STROKE_WIDTH_MIN = 1
export const NOTE_STROKE_WIDTH_MAX = 8
export const NOTE_OPACITY_MIN = 0.05
export const NOTE_OPACITY_MAX = 1
