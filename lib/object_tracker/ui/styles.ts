import { TRACKER_STYLES_ID } from './dom'

/**
 * Стили панели наблюдения.
 *
 * Цвета и состояния контролов приходят от нативных классов редактора
 * (`nk-button`, `nk-text-input`), поэтому панель выглядит и ведёт себя как
 * остальные элементы сайдбара, включая тёмную тему. Здесь только раскладка.
 */
export const TRACKER_STYLES = `
    #nmap-uploader-object-tracker-panel,
    .nmap-ot-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
      font-family: var(--nk-user-bar-font-family, "Yandex Sans Text", "YS Text", -apple-system, BlinkMacSystemFont, Arial, sans-serif);
      font-size: 13px;
      line-height: 1.35;
      color: inherit;
      /* Фон не задаём: панель наследует поверхность острова редактора. */
      background: transparent;
      box-sizing: border-box;
      width: 100%;
      min-height: 0;
      flex: 1 1 auto;
      overflow: auto;
      overscroll-behavior: contain;
    }
    #nmap-uploader-object-tracker-panel *,
    .nmap-ot-panel * {
      box-sizing: border-box;
    }
    #nmap-uploader-object-tracker-panel :focus-visible,
    .nmap-ot-panel :focus-visible {
      outline: 2px solid #ffdb4d;
      outline-offset: 1px;
    }

    #nmap-uploader-object-tracker-tab {
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    #nmap-uploader-object-tracker-tab.nmap-ot-tab-unread::after {
      content: '';
      display: inline-block;
      width: 6px;
      height: 6px;
      margin-left: 6px;
      border-radius: 50%;
      background: #ffdb4d;
      vertical-align: middle;
    }

    .nmap-ot-header {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .nmap-ot-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 28px;
    }
    .nmap-ot-title {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .nmap-ot-warning {
      padding: 8px 10px;
      border-radius: 4px;
      background: #fff4c2;
      color: #6b4d00;
      line-height: 1.4;
    }

    .nmap-ot-add {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .nmap-ot-add__label {
      color: #999999;
      font-size: 12px;
    }
    .nmap-ot-add__row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nmap-ot-add__field {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      align-items: center;
      height: 28px;
      padding: 0 10px;
    }
    /*
     * У нативного nk-text-input рамка нарисована в ::before на обёртке,
     * а у control свой padding 8px. Из-за этого input больше поля и смещён
     * внутрь: обводка на нём не совпадала бы с рамкой. Переносим обводку
     * на обёртку и гасим её на самом control.
     */
    .nmap-ot-add__field .nk-text-input__control {
      width: 100%;
      height: 100%;
      /* Нативное правило size_m даёт padding 8px — в поле высотой 28px он обрезает текст. */
      padding: 0 !important;
      color: inherit;
      font: inherit;
    }
    .nmap-ot-add__field .nk-text-input__control:focus,
    .nmap-ot-add__field .nk-text-input__control:focus-visible {
      outline: none !important;
    }
    .nmap-ot-add__field:focus-within {
      outline: 2px solid #ffdb4d;
      outline-offset: 1px;
    }
    .nmap-ot-add__submit {
      flex: 0 0 auto;
    }
    .nmap-ot-add__error {
      min-height: 16px;
      color: #e00000;
      font-size: 12px;
      line-height: 16px;
    }

    .nmap-ot-modes {
      display: flex;
      align-items: center;
      gap: 4px;
      border-bottom: 1px solid var(--border-color, #e6e6e6);
      padding-bottom: 8px;
      margin-top: -4px;
    }
    .nmap-ot-modes .nmap-ot-mode {
      border-radius: 4px;
      padding: 0 10px;
      height: 26px;
      color: inherit;
    }
    .nmap-ot-modes .nmap-ot-mode_active {
      background: rgba(0, 0, 0, 0.07);
      font-weight: 500;
    }

    .nmap-ot-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1 1 auto;
      min-height: 0;
    }
    .nmap-ot-empty {
      padding: 8px 0 12px;
      color: #999999;
    }

    .nmap-ot-commit,
    .nmap-ot-object {
      border: 1px solid var(--border-color, #e6e6e6);
      border-radius: 4px;
      padding: 8px 10px;
      background: transparent;
    }
    .nmap-ot-commit_new {
      border-color: #ffdb4d;
      background: rgba(255, 219, 77, 0.12);
    }
    .nmap-ot-commit__head {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 4px;
    }
    .nmap-ot-commit__date {
      color: #999999;
      font-size: 12px;
    }
    .nmap-ot-commit__object {
      color: #0055cc;
      text-decoration: none;
      font-weight: 500;
      word-break: break-word;
    }
    .nmap-ot-commit__object:hover {
      text-decoration: underline;
    }
    .nmap-ot-commit__action {
      margin-top: 2px;
    }
    .nmap-ot-commit__details {
      color: #999999;
      font-size: 12px;
      margin-top: 2px;
      word-break: break-word;
    }

    .nmap-ot-status,
    .nmap-ot-new-badge {
      display: inline-block;
      align-self: center;
      max-height: 18px;
      padding: 0 6px;
      border-radius: 9px;
      font-size: 11px;
      line-height: 18px;
      white-space: nowrap;
    }
    .nmap-ot-status {
      background: rgba(0, 0, 0, 0.07);
      color: inherit;
    }
    .nmap-ot-status-published,
    .nmap-ot-status-approved {
      background: #e5f5df;
      color: #2c6b1c;
    }
    .nmap-ot-status-pending {
      background: #fff3cd;
      color: #7a5b00;
    }
    .nmap-ot-status-rejected {
      background: #fde2e2;
      color: #9b1c1c;
    }
    .nmap-ot-new-badge {
      background: #ffdb4d;
      color: #000000;
    }

    .nmap-ot-object {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .nmap-ot-object__info {
      min-width: 0;
      flex: 1 1 auto;
    }
    .nmap-ot-object__title {
      color: #0055cc;
      text-decoration: none;
      font-weight: 500;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nmap-ot-object__title:hover {
      text-decoration: underline;
    }
    .nmap-ot-object__meta {
      color: #999999;
      font-size: 12px;
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .nmap-ot-object__remove {
      flex: 0 0 auto;
    }
    .nmap-ot-object__error {
      color: #e00000;
      font-size: 12px;
      margin: -4px 0 4px;
    }

    /*
     * Тёмная тема: редактор помечает её классом на .nk-page.
     *
     * Переменные islands задаём локально, чтобы кнопки и поля оставались
     * читаемыми, даже если тема не выставила их на своей поверхности.
     */
    .nk-page_color-scheme_dark #nmap-uploader-object-tracker-panel,
    .nk-page_color-scheme_dark .nmap-ot-panel {
      --control_theme_islands--bg-color: rgba(255, 255, 255, 0.08);
      --control_theme_islands--border-color: rgba(255, 255, 255, 0.3);
      --control_theme_islands--font-color: #ededed;
      --input_theme_islands__placeholder--font-color: #999999;
    }
    .nk-page_color-scheme_dark .nmap-ot-add__submit.nk-button_theme_islands.nk-button_view_action {
      --control_theme_islands--font-color: #000000;
    }

    /* Тёмная тема: редактор помечает её классом на .nk-page. */
    .nk-page_color-scheme_dark .nmap-ot-empty,
    .nk-page_color-scheme_dark .nmap-ot-commit__date,
    .nk-page_color-scheme_dark .nmap-ot-commit__details,
    .nk-page_color-scheme_dark .nmap-ot-object__meta,
    .nk-page_color-scheme_dark .nmap-ot-add__label {
      color: #999999;
    }
    .nk-page_color-scheme_dark .nmap-ot-commit__object,
    .nk-page_color-scheme_dark .nmap-ot-object__title {
      color: #8ab4ff;
    }
    .nk-page_color-scheme_dark .nmap-ot-commit,
    .nk-page_color-scheme_dark .nmap-ot-object {
      border-color: rgba(255, 255, 255, 0.18);
    }
    .nk-page_color-scheme_dark .nmap-ot-commit_new {
      border-color: #ffdb4d;
      background: rgba(255, 219, 77, 0.1);
    }
    .nk-page_color-scheme_dark .nmap-ot-warning {
      background: rgba(255, 219, 77, 0.16);
      color: #ffd76e;
    }
    .nk-page_color-scheme_dark .nmap-ot-add__error,
    .nk-page_color-scheme_dark .nmap-ot-object__error {
      color: #ff8080;
    }
    .nk-page_color-scheme_dark .nmap-ot-status {
      background: rgba(255, 255, 255, 0.14);
    }
    .nk-page_color-scheme_dark .nmap-ot-status-published,
    .nk-page_color-scheme_dark .nmap-ot-status-approved {
      background: rgba(143, 203, 105, 0.2);
      color: #a8e08a;
    }
    .nk-page_color-scheme_dark .nmap-ot-status-pending {
      background: rgba(252, 204, 74, 0.2);
      color: #ffd76e;
    }
    .nk-page_color-scheme_dark .nmap-ot-status-rejected {
      background: rgba(255, 100, 100, 0.2);
      color: #ff9b9b;
    }
    .nk-page_color-scheme_dark .nmap-ot-modes {
      border-bottom-color: rgba(255, 255, 255, 0.18);
    }
    .nk-page_color-scheme_dark .nmap-ot-modes .nmap-ot-mode_active {
      background: rgba(255, 255, 255, 0.14);
    }
    @media (prefers-color-scheme: dark) {
      .nk-page:not(.nk-page_color-scheme_light) .nmap-ot-commit__object,
      .nk-page:not(.nk-page_color-scheme_light) .nmap-ot-object__title {
        color: #8ab4ff;
      }
    }
`

/** Добавляет стили панели на страницу один раз. */
export const ensureTrackerStyles = (): void => {
  if (typeof document === 'undefined') {
    return
  }
  if (document.getElementById(TRACKER_STYLES_ID)) {
    return
  }
  const style = document.createElement('style')
  style.id = TRACKER_STYLES_ID
  style.textContent = TRACKER_STYLES
  document.head.appendChild(style)
}

/** Удаляет стили панели. */
export const removeTrackerStyles = (): void => {
  document.getElementById(TRACKER_STYLES_ID)?.remove()
}
