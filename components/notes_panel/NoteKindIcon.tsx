import type { NoteKind } from '@/lib/notes/model/types'

/**
 * Размер глифа вида заметки.
 *
 * Один на весь интерфейс: иконка вида в строке списка, в фильтрах и в выборе
 * фигуры должна быть одного размера, иначе элементы выглядят из разных
 * наборов. 22 px — размер строки списка.
 */
const NOTE_KIND_ICON_SIZE = 22

/**
 * Иконка строки списка.
 *
 * В списке всегда рисуется глиф вида фигуры, даже если у заметки выбрана своя
 * иконка: в строке важно быстро понять, точка это, линия или полигон, а
 * собственная иконка эту роль не выполняет — у неё нет связи с видом. На карте
 * своя иконка остаётся, там она и нужна.
 */
export const NoteRowIcon = ({
  kind,
  size = NOTE_KIND_ICON_SIZE,
}: {
  kind: NoteKind
  size?: number
}) => <NoteKindIcon kind={kind} size={size} />

/**
 * Иконки видов заметки в списке.
 *
 * Простые контурные глифы: список из тысяч строк не должен тянуть за собой
 * тяжёлые иллюстрации.
 */
const PATHS: Record<NoteKind, string> = {
  Point: 'M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z',
  Line: 'M4 19 9 8l5 6 6-11',
  Polygon: 'M4 8l8-4 8 6-3 10H7z',
  Square: 'M4 5h16v14H4z',
  Circle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
}

export const NoteKindIcon = ({
  kind,
  size = NOTE_KIND_ICON_SIZE,
}: {
  kind: NoteKind
  size?: number
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {kind === 'Point' ? (
      <>
        <path d={PATHS.Point} />
        <circle cx="12" cy="11" r="2.2" />
      </>
    ) : (
      <path d={PATHS[kind]} />
    )}
  </svg>
)
