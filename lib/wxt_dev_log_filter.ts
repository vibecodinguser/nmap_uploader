/**
 * Фильтр служебных сообщений WXT в консоли браузера.
 *
 * WXT печатает по строке на каждый content script при каждой пересборке
 * («Reloading content script: …»), а для скриптов, зарегистрированных в
 * рантайме (НСПД, `registration: 'runtime'`), — ещё и «Content script is not
 * registered yet, nothing to reload»: их нет в списке, пока пользователь не
 * выдал доступ к домену.
 *
 * Почему фильтр именно здесь. Эти строки печатает внутренний логгер WXT,
 * вшитый в собранный `background.js`. Опция `logger` в `wxt.config.ts` на него
 * не влияет: она относится только к сообщениям сборки в терминале. Поэтому
 * единственная точка перехвата — `console` во время выполнения фона.
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

const WRAPPED_MARKER = '__nmapWxtLogFilterInstalled'

type MarkedConsole = Console & { [WRAPPED_MARKER]?: boolean }

/**
 * Обернуть `console.log` и `console.info` фильтром.
 *
 * Вызывается при загрузке background, до того как WXT начнёт обрабатывать
 * сообщения dev-сервера. В production WXT эти строки и так не печатает, а
 * подменять консоль в релизе незачем — поэтому фильтр работает только при
 * запуске через `wxt dev` (`COMMAND === 'serve'`).
 */
export const installWxtDevLogFilter = (consoleObject: Console = console): void => {
  if (import.meta.env.COMMAND === 'build') return

  const target = consoleObject as MarkedConsole
  if (target[WRAPPED_MARKER]) return
  target[WRAPPED_MARKER] = true

  for (const method of ['log', 'info'] as const) {
    const original = consoleObject[method].bind(consoleObject)
    consoleObject[method] = (...args: unknown[]) => {
      if (shouldSilenceWxtLog(args)) return
      original(...args)
    }
  }
}
