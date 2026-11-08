/**
 * Иконки блока создания заметки.
 *
 * Повторяют манеру нативных иллюстраций редактора (`nk-geoobject-icon`):
 * холст 38×38, плоские заливки из палитры Народной карты, боковая тень и
 * красные вершины у геометрии.
 */

/** Палитра нативных иллюстраций редактора. */
export const NOTES_ICON_PALETTE = {
  accent: '#ffdb4d',
  accentDark: '#e0b93c',
  marker: '#e96b7c',
  markerDark: '#f25767',
  surface: '#e0dacd',
  surfaceDark: '#c2bbad',
  surfaceDeep: '#9c9689',
  line: '#1a8cff',
  ink: '#6b6b6b',
  white: '#ffffff',
} as const

/** Плитка «Заметки»: жёлтая обложка, белые страницы и закладка. */
export const NOTES_TILE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
  <path fill="${NOTES_ICON_PALETTE.surfaceDark}" d="M12 5h18a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H12z"/>
  <path fill="${NOTES_ICON_PALETTE.white}" d="M14 7h16a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H14z"/>
  <path fill="${NOTES_ICON_PALETTE.surfaceDark}" d="M17 12h9v1.4h-9zM17 16h9v1.4h-9zM17 20h6v1.4h-6z"/>
  <path fill="${NOTES_ICON_PALETTE.accent}" d="M6 4h17a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H6z"/>
  <path fill="${NOTES_ICON_PALETTE.accentDark}" d="M6 4h17a3 3 0 0 1 3 3v1.5H6z"/>
  <path fill="${NOTES_ICON_PALETTE.ink}" d="M6 9h4v1.6H6zM6 14h4v1.6H6zM6 19h4v1.6H6zM6 24h4v1.6H6z"/>
  <path fill="${NOTES_ICON_PALETTE.marker}" d="M21 4h4v8l-2-2-2 2z"/>
</svg>`

/** Нативная стрелка «Назад» из набора иконок редактора (иконка `back`). */
export const NOTES_BACK_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22"><path d="M13.44 3.646a.5.5 0 0 1 .706 0l.708.708a.5.5 0 0 1 0 .707l-5.586 5.585a.5.5 0 0 0 0 .708l5.586 5.585a.5.5 0 0 1 0 .707l-.708.708a.5.5 0 0 1-.707 0l-6.646-6.647a1 1 0 0 1 0-1.414z"/></svg>'
