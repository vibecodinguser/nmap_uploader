import { useLocale } from '@/hooks/useLocale'
import { BUILTIN_ICON_VIEWBOX, BUILTIN_ICONS, type BuiltinIcon } from '@/lib/notes/icons'
import type { NoteIcon } from '@/lib/notes/model/types'

/**
 * Глиф встроенной иконки.
 *
 * Рисуется из того же реестра, что и картинка для карты: реестр хранит фигуры
 * данными, поэтому одна и та же иконка выглядит одинаково в списке и на карте.
 * Толщина обводки здесь тоньше карты: в панели иконка мелкая.
 */
export const BuiltinIconGlyph = ({
  icon,
  size = BUILTIN_ICON_VIEWBOX,
}: {
  icon: BuiltinIcon
  size?: number
}) => (
  <svg
    width={size}
    height={size}
    viewBox={`0 0 ${BUILTIN_ICON_VIEWBOX} ${BUILTIN_ICON_VIEWBOX}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {icon.shapes.map((shape) => {
      const Tag = shape.tag as 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon'
      // Фигуры внутри иконки неизменны и не переупорядочиваются: id фигуры
      // однозначен, потому что повторяющихся тегов в глифе нет.
      return (
        <Tag
          key={`${icon.id}-${shape.tag}-${shape.attrs.d ?? shape.attrs.cx ?? ''}`}
          {...shape.attrs}
        />
      )
    })}
  </svg>
)

const isSameIcon = (left: NoteIcon | null, right: NoteIcon | null): boolean =>
  left?.kind === right?.kind && left?.value === right?.value

/**
 * Выбор иконки заметки: встроенный набор и «без иконки».
 *
 * Сетка, а не выпадающий список: иконку выбирают глазами, а не по названию.
 * Своя картинка появится отдельным шагом — для неё нужен выбор файла.
 */
export const IconPicker = ({
  value,
  onChange,
  label,
}: {
  value: NoteIcon | null
  onChange: (icon: NoteIcon | null) => void
  label: string
}) => {
  const { t } = useLocale()

  return (
    <fieldset className="notes-panel__field-group">
      <legend className="notes-panel__field-group-title">{label}</legend>
      <div className="notes-panel__icons">
        <button
          type="button"
          className="notes-panel__icon-choice notes-panel__icon-choice--none"
          data-active={value === null}
          aria-pressed={value === null}
          aria-label={t('notesPanel.iconNone')}
          title={t('notesPanel.iconNone')}
          onClick={() => onChange(null)}
        >
          ×
        </button>
        {BUILTIN_ICONS.map((icon) => {
          const candidate: NoteIcon = { kind: 'builtin', value: icon.id }
          const active = isSameIcon(value, candidate)
          return (
            <button
              key={icon.id}
              type="button"
              className="notes-panel__icon-choice"
              data-active={active}
              data-icon-id={icon.id}
              aria-pressed={active}
              aria-label={icon.id}
              title={icon.id}
              onClick={() => onChange(candidate)}
            >
              <BuiltinIconGlyph icon={icon} />
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
