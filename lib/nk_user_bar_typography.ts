/** Типографика nk-user-bar-view на n.maps.yandex.ru (кнопка «Войти» / имя пользователя). */
export type NkUserBarTypography = {
  fontSize: string
  lineHeight: string
  fontWeight: string
  fontFamily: string
}

export const NK_USER_BAR_TYPOGRAPHY_FALLBACK: NkUserBarTypography = {
  fontSize: '13px',
  lineHeight: '16px',
  fontWeight: '400',
  fontFamily: 'YS Text, Arial, Helvetica, sans-serif',
}

const NK_USER_BAR_SELECTORS = [
  '.nk-user-bar-view__login',
  '.nk-user-bar-view__user-name',
  '.nk-user-bar-view__login-link',
  'a.nk-user-bar-view__login',
] as const

/** Считывает font-size/line-height с открытой страницы редактора. */
export const readNkUserBarTypography = (): NkUserBarTypography => {
  if (typeof document === 'undefined') {
    return NK_USER_BAR_TYPOGRAPHY_FALLBACK
  }

  for (const selector of NK_USER_BAR_SELECTORS) {
    const element = document.querySelector(selector)
    if (!(element instanceof HTMLElement)) continue

    const style = getComputedStyle(element)
    if (!style.fontSize || style.fontSize === '0px') continue

    return {
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      fontWeight: style.fontWeight,
      fontFamily: style.fontFamily,
    }
  }

  return NK_USER_BAR_TYPOGRAPHY_FALLBACK
}

/** CSS-переменные для shadow host / :root. */
export const buildNkUserBarCssVars = (
  typography: NkUserBarTypography = NK_USER_BAR_TYPOGRAPHY_FALLBACK,
): string => `
          --nk-user-bar-font-size: ${typography.fontSize};
          --nk-user-bar-line-height: ${typography.lineHeight};
          --nk-user-bar-font-weight: ${typography.fontWeight};
          --nk-user-bar-font-family: ${typography.fontFamily};
        `
