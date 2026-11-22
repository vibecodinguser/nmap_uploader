/**
 * Доступ к собственному редактору НЯК.
 *
 * Редактор Народной карты — не `ymaps.geometryEditor`: объект растительности
 * открывается «активностью» приложения (класс с `start`, `onStart`,
 * `onViewAttrsRequest`, `stop`), которая живёт в webpack-бандле `app-bundle`.
 * У стандартного `ymaps.geometryEditor` для таких объектов `startEditing`
 * вообще не вызывается, поэтому перехватывать надо активности.
 *
 * Классы конкретных редакторов из модулей не экспортируются, но базовый класс
 * активности экспортируется, и `start`/`stop` объявлены именно на нём. Поэтому
 * достаточно узнать базовый класс по форме прототипа и обернуть его методы:
 * все редакторы наследуют обёртку.
 */

export const WEBPACK_CHUNK_NAME = 'webpackChunknmaps'

const HOOK_MARKER = '__nmapCutActivityHooked__'

/**
 * Реестр подписок живёт на прототипе в мире страницы, а не в замыкании скрипта.
 *
 * Это принципиально: при перезагрузке расширения старая копия content script
 * умирает, но обёрнутый прототип остаётся. Если хранить подписки в замыкании,
 * новая копия не сможет ни перехватить класс повторно (маркер уже стоит), ни
 * заменить мёртвые обработчики — и инструмент молча перестанет работать.
 * Обёртка читает реестр при каждом вызове, поэтому новая копия просто
 * подменяет в нём подписки.
 */
type ActivityRegistry = { hooks: ActivityHooks[] }

type ActivityPrototype = {
  start?: (...args: unknown[]) => unknown
  stop?: (...args: unknown[]) => unknown
  onStart?: (...args: unknown[]) => unknown
  onViewAttrsRequest?: () => unknown
  isStarted?: () => boolean
  [HOOK_MARKER]?: ActivityRegistry | true
}

type ActivityClass = { prototype: ActivityPrototype }

export type ActivityHooks = {
  /** Активность запущена и сообщила, что она активна. */
  onStart: (activity: unknown) => void
  /** Активность остановлена (закрытие редактора, смена объекта). */
  onStop: (activity: unknown) => void
}

/**
 * Базовый класс активности узнаётся по набору методов, а не по имени: имена
 * в бандле минифицированы, а набор методов стабилен и описан в самом редакторе.
 */
export const isActivityClass = (value: unknown): value is ActivityClass => {
  if (typeof value !== 'function') return false
  const proto = (value as ActivityClass).prototype
  return Boolean(
    proto &&
      typeof proto.start === 'function' &&
      typeof proto.stop === 'function' &&
      typeof proto.onStart === 'function' &&
      typeof proto.onViewAttrsRequest === 'function' &&
      typeof proto.isStarted === 'function',
  )
}

const readRegistry = (proto: ActivityPrototype): ActivityRegistry | null => {
  const marker = proto[HOOK_MARKER]
  return marker && typeof marker === 'object' && Array.isArray(marker.hooks) ? marker : null
}

/** Вызывает подписки, не давая одной сломанной остановить остальные. */
const dispatchStart = (registry: ActivityRegistry, activity: unknown): void => {
  for (const hooks of [...registry.hooks]) {
    try {
      hooks.onStart(activity)
    } catch {
      // Инструмент не должен ломать запуск редактора
    }
  }
}

const dispatchStop = (registry: ActivityRegistry, activity: unknown): void => {
  for (const hooks of [...registry.hooks]) {
    try {
      hooks.onStop(activity)
    } catch {
      // Инструмент не должен ломать остановку редактора
    }
  }
}

/**
 * Оборачивает `start`/`stop` один раз и возвращает реестр.
 *
 * Повторный вызов для уже обёрнутого класса реестр не создаёт, а возвращает
 * существующий: обёртка при вызове читает актуальный список подписок.
 */
const ensureRegistry = (Class: ActivityClass): ActivityRegistry | null => {
  const proto = Class.prototype
  const existing = readRegistry(proto)
  if (existing) return existing

  const hasOwn = (name: string): boolean => Object.hasOwn(proto, name)

  // Подкласс без собственного `start` наследует уже обёрнутый метод: второй
  // хук дал бы двойное срабатывание.
  const originalStart = proto.start
  if (!hasOwn('start') || typeof originalStart !== 'function') return null

  const registry: ActivityRegistry = { hooks: [] }

  proto.start = function (this: unknown, ...args: unknown[]) {
    const result = Reflect.apply(originalStart, this, args)
    const current = readRegistry(proto)
    if (!current) return result
    const self = this as { isStarted?: () => boolean }
    if (typeof self.isStarted !== 'function' || self.isStarted()) {
      dispatchStart(current, this)
    }
    return result
  }

  if (hasOwn('stop')) {
    const originalStop = proto.stop
    if (typeof originalStop === 'function') {
      proto.stop = function (this: unknown, ...args: unknown[]) {
        const current = readRegistry(proto)
        if (current) dispatchStop(current, this)
        return Reflect.apply(originalStop, this, args)
      }
    }
  }

  proto[HOOK_MARKER] = registry
  return registry
}

/**
 * Подписывает набор обработчиков на класс активности.
 * Возвращает функцию отписки или `null`, если это не активность.
 */
export const subscribeActivityClass = (
  Class: ActivityClass,
  hooks: ActivityHooks,
): (() => void) | null => {
  const registry = ensureRegistry(Class)
  if (!registry) return null

  // Один и тот же класс может встретиться в нескольких модулях: подписка
  // должна остаться одна, иначе `start` вызовет обработчик несколько раз.
  if (!registry.hooks.includes(hooks)) {
    registry.hooks.push(hooks)
  }

  return () => {
    const index = registry.hooks.indexOf(hooks)
    if (index >= 0) registry.hooks.splice(index, 1)
  }
}

/**
 * Проходит по значениям экспорта модуля и подписывается на найденные активности.
 *
 * Отписки складываются в `unsubscribers`, если он передан: так хук снимается
 * при остановке инструмента.
 */
export const hookModuleExports = (
  moduleExports: unknown,
  hooks: ActivityHooks,
  unsubscribers?: Set<() => void>,
): boolean => {
  let hooked = false

  const visit = (value: unknown, depth: number): void => {
    if (isActivityClass(value)) {
      const unsubscribe = subscribeActivityClass(value, hooks)
      if (unsubscribe) {
        unsubscribers?.add(unsubscribe)
        hooked = true
      }
      return
    }
    if (depth >= 2 || !value || typeof value !== 'object') return
    let values: unknown[]
    try {
      values = Object.values(value as Record<string, unknown>)
    } catch {
      return
    }
    for (const item of values) visit(item, depth + 1)
  }

  visit(moduleExports, 0)
  return hooked
}

export type ObserveWebpackModulesFn = (
  globalObject: Record<string, unknown>,
  chunkName: string,
  onModule: (exports: unknown, moduleId: string) => void,
) => () => void

export type InstallActivityHookOptions = {
  globalObject?: Record<string, unknown>
  /** Подменяется в тестах: реальная подписка на webpack-чанки НЯК. */
  observe?: ObserveWebpackModulesFn
  chunkName?: string
  /**
   * Сообщает, сколько классов активностей уже обёрнуто.
   *
   * Пока вызова не было, модули НЯК через наблюдатель не проходили: редактор
   * откроется мимо хука, и это видно по состоянию инструмента.
   */
  onWrapped?: (count: number) => void
}

/**
 * Подписывается на загрузку модулей НЯК и перехватывает активности редактора.
 *
 * Хук ставится в MAIN world на `document_start`: `app.js` подгружается в конце
 * `<body>`, поэтому скрипт успевает раньше и видит модуль базового класса в
 * момент исполнения.
 *
 * Если скрипт попал в уже загруженную вкладку (Firefox подставляет скрипты в
 * открытые вкладки при обновлении расширения), модули исполнены и хук не
 * встанет до перезагрузки вкладки. Искать класс среди исполненных модулей мы
 * не пытаемся: у рантайма нет открытого кэша, а `require` исполнил бы модули,
 * которые страница ещё не запускала.
 */
export const installActivityHook = (
  hooks: ActivityHooks,
  options: InstallActivityHookOptions = {},
): (() => void) => {
  const globalObject = options.globalObject ?? (globalThis as Record<string, unknown>)
  const chunkName = options.chunkName ?? WEBPACK_CHUNK_NAME
  const observe = options.observe
  if (!observe) return () => {}

  const unsubscribers = new Set<() => void>()

  const unsubscribeModules = observe(globalObject, chunkName, (moduleExports) => {
    const before = unsubscribers.size
    hookModuleExports(moduleExports, hooks, unsubscribers)
    if (unsubscribers.size > before) {
      options.onWrapped?.(unsubscribers.size)
    }
  })

  return () => {
    unsubscribeModules()
    for (const unsubscribe of unsubscribers) {
      unsubscribe()
    }
    unsubscribers.clear()
  }
}
