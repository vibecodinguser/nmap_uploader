/**
 * Нативные элементы управления редактора.
 */

/**
 * Нативная кнопка редактора.
 *
 * Текст обязан лежать в `.nk-button__text`: у нативной кнопки поверхность
 * нарисована в `:before`, и без позиционированной обёртки текст уходит под неё.
 */
export const createNativeButton = (className: string, label: string): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `nk-button nk-button_theme_islands nk-button_size_m ${className}`
  const text = document.createElement('span')
  text.className = 'nk-button__text'
  text.textContent = label
  button.appendChild(text)
  return button
}
