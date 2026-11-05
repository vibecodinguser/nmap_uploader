import { TRACKER_STYLES_ID } from './dom'

/**
 * Стили панели наблюдения.
 *
 * Цвета берутся из CSS-переменных, которые выставляет `applyTrackerTheme`:
 * так панель одинаково работает и в светлой, и в тёмной теме редактора.
 */
export const TRACKER_STYLES = `
    #nmap-uploader-object-tracker-panel,
    .nmap-ot-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px 12px;
      font-family: var(--nk-user-bar-font-family, "Yandex Sans Text", "YS Text", -apple-system, BlinkMacSystemFont, Arial, sans-serif);
      font-size: 13px;
      line-height: 1.35;
      color: var(--nmap-ot-fg, #000000);
      background: var(--nmap-ot-bg, #ffffff);
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
    #nmap-uploader-object-tracker-panel a,
    .nmap-ot-panel a {
      color: var(--nmap-ot-link, #0055cc);
    }
    #nmap-uploader-object-tracker-panel :focus-visible,
    .nmap-ot-panel :focus-visible {
      outline: 2px solid var(--nmap-ot-link, #0055cc);
      outline-offset: 1px;
      border-radius: 4px;
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
      background: var(--nmap-ot-accent, #ffdb4d);
      vertical-align: middle;
    }

    .nmap-ot-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .nmap-ot-title {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nmap-ot-icon-button {
      flex: 0 0 auto;
      border: 1px solid var(--nmap-ot-border, rgba(0, 0, 0, 0.14));
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 12px;
      padding: 3px 10px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .nmap-ot-icon-button:hover:not(:disabled) {
      background: var(--nmap-ot-hover, rgba(0, 0, 0, 0.05));
    }
    .nmap-ot-icon-button:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .nmap-ot-warning {
      padding: 6px 8px;
      border-radius: 4px;
      background: var(--nmap-ot-warning-bg, #fff4c2);
      color: var(--nmap-ot-warning-fg, #6b4d00);
    }

    .nmap-ot-add {
      display: flex;
      gap: 6px;
    }
    .nmap-ot-add__input {
      flex: 1 1 auto;
      min-width: 0;
      border: 1px solid var(--nmap-ot-border, rgba(0, 0, 0, 0.14));
      border-radius: 4px;
      background: var(--nmap-ot-input-bg, #ffffff);
      color: inherit;
      padding: 4px 8px;
      font: inherit;
    }
    .nmap-ot-add__input::placeholder {
      color: var(--nmap-ot-muted, #666666);
    }
    .nmap-ot-add__input:focus {
      outline: none;
      border-color: var(--nmap-ot-link, #0055cc);
    }
    .nmap-ot-add__submit {
      flex: 0 0 auto;
      border: 0;
      border-radius: 4px;
      padding: 4px 12px;
      background: var(--nmap-ot-accent, #ffdb4d);
      color: var(--nmap-ot-accent-fg, #000000);
      font: inherit;
      cursor: pointer;
      transition: filter 0.15s ease;
    }
    .nmap-ot-add__submit:hover {
      filter: brightness(0.95);
    }
    .nmap-ot-add__error {
      min-height: 16px;
      color: var(--nmap-ot-error, #cc0000);
      font-size: 12px;
      line-height: 16px;
    }

    .nmap-ot-modes {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--nmap-ot-border, rgba(0, 0, 0, 0.14));
      padding-bottom: 6px;
    }
    .nmap-ot-mode {
      border: 0;
      background: transparent;
      color: var(--nmap-ot-muted, #666666);
      font: inherit;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .nmap-ot-mode:hover {
      background: var(--nmap-ot-hover, rgba(0, 0, 0, 0.05));
    }
    .nmap-ot-mode_active {
      background: var(--nmap-ot-selected-bg, rgba(0, 0, 0, 0.07));
      color: var(--nmap-ot-fg, #000000);
    }

    .nmap-ot-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1 1 auto;
      min-height: 0;
    }
    .nmap-ot-empty {
      padding: 12px 0;
      color: var(--nmap-ot-muted, #666666);
    }

    .nmap-ot-commit,
    .nmap-ot-object {
      border: 1px solid var(--nmap-ot-card-border, rgba(0, 0, 0, 0.1));
      border-radius: 6px;
      padding: 8px;
      background: var(--nmap-ot-card-bg, #ffffff);
      transition: background 0.15s ease;
    }
    .nmap-ot-commit_new {
      border-color: var(--nmap-ot-new-border, #ffdb4d);
      background: var(--nmap-ot-new-bg, #fffdf2);
    }
    .nmap-ot-commit__head {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 4px;
    }
    .nmap-ot-commit__date {
      color: var(--nmap-ot-muted, #666666);
      font-size: 12px;
    }
    .nmap-ot-status,
    .nmap-ot-new-badge {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 8px;
      white-space: nowrap;
    }
    .nmap-ot-status {
      background: var(--nmap-ot-selected-bg, rgba(0, 0, 0, 0.07));
      color: inherit;
    }
    .nmap-ot-status-published,
    .nmap-ot-status-approved {
      background: var(--nmap-ot-status-published-bg, #e5f5df);
      color: var(--nmap-ot-status-published-fg, #2c6b1c);
    }
    .nmap-ot-status-pending {
      background: var(--nmap-ot-status-pending-bg, #fff3cd);
      color: var(--nmap-ot-status-pending-fg, #7a5b00);
    }
    .nmap-ot-status-rejected {
      background: var(--nmap-ot-status-rejected-bg, #fde2e2);
      color: var(--nmap-ot-status-rejected-fg, #9b1c1c);
    }
    .nmap-ot-new-badge {
      background: var(--nmap-ot-accent, #ffdb4d);
      color: var(--nmap-ot-accent-fg, #000000);
    }
    .nmap-ot-commit__object {
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
      color: var(--nmap-ot-muted, #666666);
      font-size: 12px;
      margin-top: 2px;
      word-break: break-word;
    }

    .nmap-ot-object {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .nmap-ot-object__info {
      min-width: 0;
      flex: 1 1 auto;
    }
    .nmap-ot-object__title {
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
      color: var(--nmap-ot-muted, #666666);
      font-size: 12px;
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .nmap-ot-object__remove {
      flex: 0 0 auto;
      border: 1px solid var(--nmap-ot-border, rgba(0, 0, 0, 0.14));
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 12px;
      padding: 2px 8px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .nmap-ot-object__remove:hover {
      background: var(--nmap-ot-hover, rgba(0, 0, 0, 0.05));
    }
    .nmap-ot-object__error {
      color: var(--nmap-ot-error, #cc0000);
      font-size: 12px;
      margin: -4px 0 4px 8px;
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
