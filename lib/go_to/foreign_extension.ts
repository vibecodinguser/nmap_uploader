/**
 * Диагностика похожего расширения «Расширение Народной карты».
 *
 * Оно создаёт кнопку `#goToButton` и меню `#goToLinksMenu`. Мы больше не
 * используем эти id, поэтому работаем независимо, но сообщаем в консоль:
 * это сильно ускоряет разбор следующих похожих конфликтов.
 */

const FOREIGN_GOTO_SELECTORS = ['#goToButton', '#goToLinksMenu'] as const

let warned = false

export const hasForeignGoToExtension = (): boolean =>
  FOREIGN_GOTO_SELECTORS.some((selector) => document.querySelector(selector) !== null)

/** Пишет одно предупреждение за жизнь страницы, если найдено чужое расширение. */
export const warnIfForeignGoToExtensionDetected = (): void => {
  if (warned || !hasForeignGoToExtension()) {
    return
  }
  warned = true
  console.warn(
    '[nmap_uploader] обнаружено расширение с похожей функцией (goToButton/goToLinksMenu); элементы go-to работают независимо',
  )
}
