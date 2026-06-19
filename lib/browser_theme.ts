import { isFirefox, isYandexBrowser } from './browser';

const CHROME_DARK_SURFACE = '#3c3c3c';

const CHROME_DARK_SURFACE_VARS = {
  '--dark-surface': CHROME_DARK_SURFACE,
  '--dark-header-bg': CHROME_DARK_SURFACE,
  '--dark-header-bg-blur': CHROME_DARK_SURFACE,
} as const;

const BROWSER_THEME_VAR_KEYS = Object.keys(CHROME_DARK_SURFACE_VARS);

const clearBrowserThemeVars = (el: HTMLElement): void => {
  for (const key of BROWSER_THEME_VAR_KEYS) {
    el.style.removeProperty(key);
  }
};

/** Помечает корень панели для Firefox-токенов в CSS. */
export const markFirefoxThemeTarget = (el: HTMLElement): void => {
  if (isFirefox()) {
    el.classList.add('browser-firefox');
  }
};

/** Применяет цвета тёмной темы Chrome (не Yandex, не Firefox — у Firefox свои токены в CSS). */
export const applyBrowserThemeVars = (el: HTMLElement, isDark: boolean): void => {
  clearBrowserThemeVars(el);
  markFirefoxThemeTarget(el);

  if (isDark && !isYandexBrowser() && !isFirefox()) {
    for (const [key, value] of Object.entries(CHROME_DARK_SURFACE_VARS)) {
      el.style.setProperty(key, value);
    }
  }
};
