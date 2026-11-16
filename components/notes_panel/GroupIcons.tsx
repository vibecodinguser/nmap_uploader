/**
 * Иконки заголовка группы.
 *
 * Нарисованы вручную, а не взяты из набора `lucide-react`: стрелка должна
 * совпадать по размеру со строкой заметки, а карандаш — с остальными
 * действиями строки. Разметка зафиксирована тестами и CSS панели.
 */
export const Chevron = ({ collapsed }: { collapsed: boolean }) => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="notes-panel__group-chevron"
    data-collapsed={collapsed}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export const PencilIcon = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />
  </svg>
)
