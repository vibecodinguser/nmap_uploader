/**
 * Фильтр служебных сообщений WXT в dev-режиме.
 *
 * WXT на каждую пересборку печатает по строке на каждый content script
 * («Reloading content script: …») — при пятнадцати скриптах это пятнадцать
 * одинаковых строк. Для скриптов, которые регистрируются в рантайме (НСПД,
 * `registration: 'runtime'`), добавляется ещё и «Content script is not
 * registered yet, nothing to reload»: их нет в списке, пока пользователь не
 * выдал доступ к домену, и это нормальное состояние, а не ошибка.
 *
 * Фильтр вырезает ровно эти сообщения. Всё остальное — сборку, предупреждения,
 * ошибки — WXT печатает как обычно.
 */
const SILENCED_MESSAGE_PARTS = [
  'Reloading content script:',
  'Content script is not registered yet, nothing to reload',
] as const

/** Первый аргумент — текст сообщения WXT; остальные — объекты для отладки. */
export const shouldSilenceWxtLog = (args: readonly unknown[]): boolean => {
  const first = args[0]
  if (typeof first !== 'string') return false
  return SILENCED_MESSAGE_PARTS.some((part) => first.includes(part))
}
