import { useLocale } from '@/hooks/useLocale'
import { requestCloseSettingsPopup } from '@/lib/settings_popup_notify'

/**
 * Шапка панели — как нативная шапка боковой панели редактора
 * (`.nk-sidebar-header-view`): заголовок по центру и иконка закрытия справа.
 *
 * Классы повторяют нативные, но их стили живут в CSS редактора, недоступном в
 * iframe панели, поэтому вид задаётся в `uploader.css` теми же числами, что
 * намерены у редактора: высота 46px (`12px` отступа + строка `22px`),
 * заголовок `16px/22px` шириной `312px` со сдвигом `32px`, иконка `22px`.
 *
 * Пользователя (аватар, имя, «Выйти») здесь нет: он уже показан в шапке
 * самого редактора, и дублировать его незачем.
 *
 * Кнопка закрытия нужна потому, что попап перекрывает карту, а закрыть его
 * иначе можно только повторным кликом по кнопке в шапке редактора — то есть
 * уйти из попапа, чтобы его убрать.
 *
 * Закрытие идёт через `requestCloseSettingsPopup`: попап живёт в DOM страницы
 * карты, а не в самой панели, поэтому панель посылает `postMessage` родителю,
 * и хост попапа убирает узел. Напрямую убрать родительский iframe страница
 * расширения не может — она в другом документе.
 */
export const Header = () => {
  const { t } = useLocale()

  return (
    <header className="sidepanel-header nk-sidebar-header-view nk-grid nk-section nk-section_level_1">
      <div className="header-title nk-sidebar-header-view__title nk-sidebar-header-view__title_centered nk-grid__col nk-grid__col_shift_1 nk-grid__col_span_10">
        {t('settings.title')}
      </div>

      <button
        type="button"
        className="header-close-btn nk-icon nk-icon_id_close nk-icon_align_auto nk-icon_interactive"
        title={t('header.closeSidebar')}
        aria-label={t('header.closeSidebar')}
        onClick={requestCloseSettingsPopup}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          aria-hidden="true"
          focusable="false"
          className="header-close-icon"
        >
          <path
            d="M6 6 16 16M16 6 6 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </header>
  )
}
