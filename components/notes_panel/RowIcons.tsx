import { Eye, EyeOff, LocateFixed, Trash2 } from 'lucide-react'

/**
 * Иконки действий в строке заметки.
 *
 * Классы повторяют нативные иконки редактора (`nk-icon`, `nk-icon_id_*`):
 * так размеры и отступы совпадают с остальными действиями карты. Сами глифы
 * рисуются из `lucide-react` — панель живёт в iframe, где CSS редактора нет.
 */
const NATIVE_ICON = 'nk-icon nk-icon_align_auto nk-icon_interactive'

export const ROW_ICON_CLASS = {
  hide: NATIVE_ICON,
  show: NATIVE_ICON,
  locate: `${NATIVE_ICON} nk-icon_id_center nk-tracker-settings-view__pos-by-bounds`,
  delete: `${NATIVE_ICON} nk-icon_id_delete-small nk-tracker-settings-view__delete`,
} as const

const SIZE = 16

export const VisibilityIcon = ({ hidden }: { hidden: boolean }) => (
  <span className={hidden ? ROW_ICON_CLASS.show : ROW_ICON_CLASS.hide} aria-hidden="true">
    {hidden ? <EyeOff size={SIZE} /> : <Eye size={SIZE} />}
  </span>
)

export const LocateIcon = () => (
  <span className={ROW_ICON_CLASS.locate} aria-hidden="true">
    <LocateFixed size={SIZE} />
  </span>
)

export const DeleteIcon = () => (
  <span className={ROW_ICON_CLASS.delete} aria-hidden="true">
    <Trash2 size={SIZE} />
  </span>
)
