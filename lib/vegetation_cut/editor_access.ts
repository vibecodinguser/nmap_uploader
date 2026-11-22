/**
 * Доступ к собственному редактору НЯК.
 *
 * Редактор Народной карты — не `ymaps.geometryEditor`: объект растительности
 * открывается «активностью» приложения (класс с `start`, `onStart`,
 * `onViewAttrsRequest`, `stop`), которая живёт в webpack-бандле `app-bundle`.
 * У стандартного `ymaps.geometryEditor` для таких объектов `startEditing`
 * вообще не вызывается, поэтому перехватывать надо активности.
 *
 * Классы активностей не экспортируются поимённо: модуль отдаёт их как значения
 * экспорта, а экземпляры создаёт фабрика. Поэтому перехватываем базовый класс
 * по форме прототипа и подписываемся на `start` / `stop`.
 */

export const WEBPACK_CHUNK_NAME = 'webpackChunknmaps'

const HOOK_MARKER = '__nmapVegetationCutActivityHooked__'

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
const ensureRegistry = (
  Class: ActivityClass,
  allowInheritedStart = false,
): ActivityRegistry | null => {
  const proto = Class.prototype
  const existing = readRegistry(proto)
  if (existing) return existing

  const hasOwn = (name: string): boolean => Object.hasOwn(proto, name)

  /*
   * Подкласс без собственного `start` наследует уже обёрнутый метод: второй хук
   * дал бы двойное срабатывание, поэтому такие классы обычно пропускаем.
   *
   * Исключение — активности из DI-контейнера: там классы создаются напрямую, и
   * у них `start` почти всегда унаследован (минификатор сводит его к базовому).
   * В этом случае создаём собственную обёртку поверх унаследованного метода —
   * она срабатывает один раз, потому что предок не обёрнут.
   */
  const inheritedStart = proto.start
  if (!hasOwn('start') && (!allowInheritedStart || typeof inheritedStart !== 'function')) {
    return null
  }

  if (typeof inheritedStart !== 'function') return null

  const registry: ActivityRegistry = { hooks: [] }

  proto.start = function (this: unknown, ...args: unknown[]) {
    const result = Reflect.apply(inheritedStart, this, args)
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
  options: { allowInheritedStart?: boolean } = {},
): (() => void) | null => {
  const registry = ensureRegistry(Class, options.allowInheritedStart === true)
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

/** Проходит по значениям экспорта модуля и подписывается на найденные активности. */
export const hookModuleExports = (moduleExports: unknown, hooks: ActivityHooks): boolean => {
  let hooked = false

  const visit = (value: unknown, depth: number): void => {
    if (isActivityClass(value)) {
      hooked = subscribeActivityClass(value, hooks) !== null || hooked
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

/** Webpack-require: по id отдаёт exports модуля (из кэша, если он уже выполнен). */
type WebpackRequire = {
  (id: string | number): unknown
  m?: Record<string, unknown>
}

/**
 * Достаёт webpack-require активного runtime.
 *
 * Рантайм вызывает третий элемент чанка как функцию и передаёт ей свой
 * `require`. Пустой чанк с такой функцией — единственный способ получить
 * `require` снаружи, не выполняя чужих модулей.
 */
const captureWebpackRequire = (chunks: unknown[]): WebpackRequire | null => {
  let captured: WebpackRequire | null = null
  try {
    const probe = (require: WebpackRequire): void => {
      captured = require
    }
    chunks.push([[`__nmap_require_probe_${Date.now()}`], {}, probe])
  } catch {
    return null
  }
  return captured
}

const looksLikeActivityClass = (value: unknown): value is ActivityClass => {
  if (typeof value !== 'function') return false
  const proto = (value as ActivityClass).prototype
  return Boolean(
    proto &&
      typeof proto.start === 'function' &&
      typeof proto.onStart === 'function' &&
      typeof proto.onViewAttrsRequest === 'function' &&
      typeof proto.isStarted === 'function',
  )
}

/**
 * Подписывается на создание активностей через DI-контейнер.
 *
 * Классы редакторов не экспортируются из модулей: модуль отдаёт только
 * фабрику/сервис, а сами классы регистрируются внутри и создаются через
 * `di-container.instantiate`. Поэтому единственная надёжная точка — обёрнуть
 * `instantiate` и подписаться на `start` конкретного созданного класса.
 *
 * Возвращает число подписанных классов.
 */
export const subscribeActivityInstances = (
  globalObject: Record<string, unknown>,
  chunkName: string,
  hooks: ActivityHooks,
  unsubscribers: Set<() => void>,
): number => {
  const chunks = globalObject[chunkName]
  if (!Array.isArray(chunks)) return 0

  const require = captureWebpackRequire(chunks)
  const modules = require?.m
  if (!require || !modules) return 0

  const container = findDiContainer(require, modules)
  if (!container) return 0

  const unsubscribersForClasses = new Set<() => void>()
  const originalInstantiate = container.instantiate
  let subscribed = 0

  container.instantiate = function (Class: unknown, args?: unknown[]) {
    const result = Reflect.apply(originalInstantiate, this, [Class, args])
    if (looksLikeActivityClass(Class)) {
      const unsubscribe = subscribeActivityClass(Class, hooks, { allowInheritedStart: true })
      if (unsubscribe && !unsubscribersForClasses.has(unsubscribe)) {
        unsubscribersForClasses.add(unsubscribe)
        unsubscribers.add(unsubscribe)
        subscribed += 1
      }
    }
    return result
  }

  unsubscribers.add(() => {
    container.instantiate = originalInstantiate
  })

  // Подписки появятся при создании активностей, но сам хук уже стоит:
  // возвращаем 1, чтобы состояние отличалось от «не поймали ничего».
  return 1
}

type DiContainerLike = {
  instantiate: (Class: unknown, args?: unknown[]) => unknown
  get?: (name: string) => unknown
  registerType?: (...args: unknown[]) => unknown
  registerProvider?: (...args: unknown[]) => unknown
}

const isDiContainer = (value: unknown): value is DiContainerLike => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.instantiate === 'function' &&
    typeof candidate.get === 'function' &&
    typeof candidate.registerType === 'function' &&
    typeof candidate.registerProvider === 'function'
  )
}

/**
 * Ищет DI-контейнер среди уже выполненных модулей.
 *
 * Контейнер — синглтон модуля (объект, а не класс), поэтому `require` отдаёт
 * тот же экземпляр, которым пользуется приложение.
 */
const findDiContainer = (
  require: WebpackRequire,
  modules: Record<string, unknown>,
): DiContainerLike | null => {
  for (const id of Object.keys(modules)) {
    let moduleExports: unknown
    try {
      moduleExports = require(id)
    } catch {
      continue
    }
    if (!moduleExports || typeof moduleExports !== 'object') continue
    for (const value of Object.values(moduleExports as Record<string, unknown>)) {
      if (isDiContainer(value)) return value
    }
  }
  return null
}

export type InstallActivityHookOptions = {
  globalObject?: Record<string, unknown>
  /** Подменяется в тестах: реальная подписка на webpack-чанки НЯК. */
  observe?: ObserveWebpackModulesFn
  chunkName?: string
  /**
   * Сообщает, сколько классов активностей уже обёрнуто.
   *
   * Ноль означает, что наблюдатель стоит, но модули НЯК ещё не проходили через
   * него: тогда редактор откроется мимо хука, и это видно по состоянию.
   */
  onWrapped?: (count: number) => void
}

/**
 * Подписывается на загрузку модулей НЯК и перехватывает активности редактора.
 *
 * Ставить хук нужно в MAIN world на `document_start`: активности создаются
 * позже, но классы объявляются при исполнении бандла, и до этого момента
 * прототип должен быть уже обёрнут.
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
  let wrapped = 0

  const unsubscribeModules = observe(globalObject, chunkName, (moduleExports) => {
    const before = unsubscribers.size
    hookModuleExportsWithUnsubscribe(moduleExports, hooks, unsubscribers)
    const added = unsubscribers.size - before
    if (added > 0) {
      wrapped += added
      options.onWrapped?.(wrapped)
    }
  })

  // Модули, объявленные до нас, через `push` уже не пройдут — забираем их
  // из кэша webpack. Без этого хук молчит, если бандл загрузился раньше
  // content script (обычный случай: `<script>` в `<head>`).
  if (wrapped === 0) {
    wrapped += subscribeActivityInstances(globalObject, chunkName, hooks, unsubscribers)
    if (wrapped > 0) options.onWrapped?.(wrapped)
  }

  return () => {
    unsubscribeModules()
    for (const unsubscribe of unsubscribers) {
      unsubscribe()
    }
    unsubscribers.clear()
  }
}

/** Как `hookModuleExports`, но складывает отписки, чтобы снять их при остановке. */
const hookModuleExportsWithUnsubscribe = (
  moduleExports: unknown,
  hooks: ActivityHooks,
  unsubscribers: Set<() => void>,
): boolean => {
  let hooked = false

  const visit = (value: unknown, depth: number): void => {
    if (isActivityClass(value)) {
      const unsubscribe = subscribeActivityClass(value, hooks)
      if (unsubscribe) {
        unsubscribers.add(unsubscribe)
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
