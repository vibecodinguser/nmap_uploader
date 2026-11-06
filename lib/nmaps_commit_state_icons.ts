/**
 * Иконки состояний коммита и ролей в разметке Народной карты.
 *
 * В CSS редактора классов `.nk-icon_id_commit-*` и `.nk-icon_id_moderator`
 * нет: приложение вставляет внутрь `<span class="nk-icon …">` готовую
 * инлайн-SVG. Без неё иконка остаётся пустым квадратом, поэтому разметку
 * храним здесь и переиспользуем в фильтре ленты и в наблюдении за объектами.
 */

export interface NmapsIcon {
  /** Классы span-обёртки. */
  className: string
  /** Содержимое: инлайн-SVG. */
  svgMarkup: string
}

/** Собирает классы в порядке, который использует редактор. */
const stateIconClass = (idClass: string): string =>
  `nk-icon ${idClass} nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state`

/** Иконки статусов правки — те же, что рисует редактор. */
export const COMMIT_STATE_ICONS = {
  published: {
    className: stateIconClass('nk-icon_id_commit-published'),
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g fill="none" fill-rule="evenodd"><circle cx="11" cy="11" r="10" fill="#8fcb69"/><path fill="#fff" d="m16.255 6.922-5.659 7.308 1.406 1.089 5.659-7.308zM5.578 10.413l-1.239 1.274L8.054 15.3l5.609-7.291-1.409-1.084-4.392 5.709z"/></g></svg>',
  },
  green: {
    className: stateIconClass('nk-icon_id_commit-approved'),
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g fill="none" fill-rule="evenodd"><circle cx="11" cy="11" r="10" fill="#8fcb69"/><path fill="#fff" d="m7.92 10.446-1.24 1.275 3.716 3.612 5.609-7.291-1.41-1.084-4.391 5.709z"/></g></svg>',
  },
  yellow: {
    className: stateIconClass('nk-icon_id_commit-pending'),
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g fill="none" fill-rule="evenodd"><circle cx="11" cy="11" r="10" fill="#fc5"/><path fill="#fff" d="M12 5h-2v6.535l4.277 2.852 1.11-1.664L12 10.465z"/></g></svg>',
  },
  red: {
    className: stateIconClass('nk-icon_id_commit-rejected'),
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g fill="none" fill-rule="evenodd"><circle cx="11" cy="11" r="10" fill="#ff6464"/><path fill="#fff" d="m8.172 6.757 7.07 7.071-1.414 1.415-7.07-7.071z"/><path fill="#fff" d="m15.243 8.172-7.071 7.07-1.415-1.414 7.071-7.07z"/></g></svg>',
  },
} as const satisfies Record<string, NmapsIcon>

export type CommitStateIconId = keyof typeof COMMIT_STATE_ICONS

/** Иконка модератора рядом с именем автора правки. */
export const MODERATOR_ICON: NmapsIcon = {
  className: 'nk-icon nk-icon_id_moderator nk-icon_align_auto nk-user-name-view__icon',
  svgMarkup:
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><path fill="#fc0" d="M2 2h14l5 9-5 9H2z"/><path fill="#664c0e" d="M6 15V7h2.7l1.3 6 1.3-6H14v8h-2V9l-1.3 6H9.3L8 9v6z"/></svg>',
}

/**
 * Статус правки → иконка.
 *
 * `approveStatus` приходит из API (`published`, `approved`, `pending`,
 * `rejected`), но в старых записях встречаются и цвета фильтра.
 */
export const resolveCommitStateIcon = (approveStatus: string): CommitStateIconId => {
  switch (approveStatus) {
    case 'published':
      return 'published'
    case 'approved':
    case 'green':
      return 'green'
    case 'rejected':
    case 'red':
      return 'red'
    default:
      return 'yellow'
  }
}
