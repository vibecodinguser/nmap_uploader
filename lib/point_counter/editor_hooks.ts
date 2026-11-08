/**
 * Перехват редакторов геометрии НЯК.
 *
 * Редактор не оставляет следов в DOM, поэтому единственный способ узнать, что пользователь
 * открыл объект на редактирование, — патч прототипов `geometryEditor.Base` и
 * `geometryEditor.MultiGeometry`. Здесь же живёт ожидание загрузки `ymaps`.
 */

import {
  markGeometryEditorDrawing,
  markGeometryEditorEditing,
  setEditorHooksReady,
} from './counter_source'
import type { GeometryEditorLike } from './editor_types'
import { DRAWING_STATE } from './editor_types'

export type EditorHookHandlers = {
  /** Запуск обычного (не составного) редактора. */
  onStart: (editor: GeometryEditorLike) => void
  /** Запуск составного редактора (`MultiGeometry`). */
  onMultiStart?: (editor: GeometryEditorLike) => void
  /** Остановка любого редактора. */
  onStop: (editor: GeometryEditorLike) => void
}

const BASE_HOOK_MARKER = '__nmapPointCounterEditorHooked__'
const MULTI_HOOK_MARKER = '__nmapPointCounterMultiEditorHooked__'

type HookRegistry = { handlers: EditorHookHandlers }

/** Редакторы, за состоянием которых уже следим. */
const trackedEditors = new WeakSet<object>()

/**
 * Следит за состоянием конкретного редактора: редактирует / рисует.
 * Нужно, чтобы canvas-подсчёт включался только при активном рисовании.
 */
const trackEditorState = (editor: GeometryEditorLike): void => {
  if (!editor || typeof editor !== 'object') return

  const isDrawing = (): boolean => editor.state?.get?.(DRAWING_STATE) === true

  if (trackedEditors.has(editor)) {
    markGeometryEditorDrawing(editor, isDrawing())
    return
  }
  trackedEditors.add(editor)

  markGeometryEditorDrawing(editor, isDrawing())

  const events = editor.state?.events
  if (!events || typeof events.add !== 'function') return

  try {
    events.add('change', () => {
      markGeometryEditorDrawing(editor, isDrawing())
    })
  } catch {
    // Состояние могло быть уничтожено вместе с редактором
  }
}

/**
 * Пока составной редактор запускает дочерние, их запуск не должен трактоваться
 * как запуск обычного одиночного редактора.
 */
let multiStartupDepth = 0

const installEditorHook = (
  Base: unknown,
  marker: string,
  handlers: EditorHookHandlers,
  selectStart: (current: EditorHookHandlers) => ((editor: GeometryEditorLike) => void) | undefined,
): boolean => {
  if (typeof Base !== 'function') return false

  const proto = (Base as { prototype?: Record<string, unknown> }).prototype
  if (!proto) return false

  const existingRegistry = proto[marker] as HookRegistry | undefined
  if (existingRegistry) {
    existingRegistry.handlers = handlers
    setEditorHooksReady(true)
    return true
  }

  const originalStart = proto.startEditing
  const originalStop = proto.stopEditing
  if (typeof originalStart !== 'function' || typeof originalStop !== 'function') return false

  const originalStartDrawing = proto.startDrawing
  const registry: HookRegistry = { handlers }
  proto[marker] = registry

  const notifyStart = (editor: GeometryEditorLike): void => {
    markGeometryEditorEditing(editor, true)
    trackEditorState(editor)
    const handler = selectStart(registry.handlers)
    if (!handler) return
    try {
      handler(editor)
    } catch {
      // Подсчёт не должен ломать запуск редактора
    }
  }

  proto.startEditing = function (this: GeometryEditorLike, ...args: unknown[]) {
    const result = Reflect.apply(originalStart, this, args)
    notifyStart(this)
    return result
  }

  if (typeof originalStartDrawing === 'function') {
    proto.startDrawing = function (this: GeometryEditorLike, ...args: unknown[]) {
      const result = Reflect.apply(originalStartDrawing, this, args)
      notifyStart(this)
      return result
    }
  }

  proto.stopEditing = function (this: GeometryEditorLike, ...args: unknown[]) {
    markGeometryEditorEditing(this, false)
    try {
      registry.handlers.onStop(this)
    } catch {
      // Подсчёт не должен ломать остановку редактора
    }
    return Reflect.apply(originalStop, this, args)
  }

  setEditorHooksReady(true)

  return true
}

/**
 * Патчит прототип базового редактора геометрии, чтобы получать экземпляры одиночных редакторов.
 * Возвращает true, если прототип уже был обработан (или обработан сейчас).
 */
export const hookGeometryEditorPrototype = (Base: unknown, handlers: EditorHookHandlers): boolean =>
  installEditorHook(Base, BASE_HOOK_MARKER, handlers, (current) => (editor) => {
    if (multiStartupDepth > 0) return
    current.onStart(editor)
  })

/**
 * Патчит прототип составного редактора (`MultiGeometry`), чтобы знать о многочастных объектах.
 * Возвращает true, если прототип уже был обработан (или обработан сейчас).
 */
export const hookMultiGeometryPrototype = (
  MultiGeometry: unknown,
  handlers: EditorHookHandlers,
): boolean => {
  if (typeof MultiGeometry !== 'function') return false

  const proto = (MultiGeometry as { prototype?: Record<string, unknown> }).prototype
  if (!proto) return false

  const existingRegistry = proto[MULTI_HOOK_MARKER] as HookRegistry | undefined
  if (existingRegistry) {
    existingRegistry.handlers = handlers
    setEditorHooksReady(true)
    return true
  }

  const originalStart = proto.startEditing
  const originalStop = proto.stopEditing
  if (typeof originalStart !== 'function' || typeof originalStop !== 'function') return false

  const originalStartDrawing = proto.startDrawing
  const registry: HookRegistry = { handlers }
  proto[MULTI_HOOK_MARKER] = registry

  const notifyStart = (editor: GeometryEditorLike): void => {
    markGeometryEditorEditing(editor, true)
    trackEditorState(editor)
    try {
      registry.handlers.onMultiStart?.(editor)
    } catch {
      // Подсчёт не должен ломать запуск редактора
    }
  }

  const runDuringMultiStartup = <T>(action: () => T): T => {
    multiStartupDepth += 1
    try {
      return action()
    } finally {
      multiStartupDepth -= 1
    }
  }

  proto.startEditing = function (this: GeometryEditorLike, ...args: unknown[]) {
    const result = runDuringMultiStartup(() => Reflect.apply(originalStart, this, args))
    notifyStart(this)
    return result
  }

  if (typeof originalStartDrawing === 'function') {
    proto.startDrawing = function (this: GeometryEditorLike, ...args: unknown[]) {
      const result = runDuringMultiStartup(() => Reflect.apply(originalStartDrawing, this, args))
      notifyStart(this)
      return result
    }
  }

  proto.stopEditing = function (this: GeometryEditorLike, ...args: unknown[]) {
    markGeometryEditorEditing(this, false)
    try {
      registry.handlers.onStop(this)
    } catch {
      // Подсчёт не должен ломать остановку редактора
    }
    return Reflect.apply(originalStop, this, args)
  }

  setEditorHooksReady(true)

  return true
}

export type YmapsModulesLike = {
  require?: (
    modules: string[],
    successCallback: (...modules: unknown[]) => void,
    errorCallback?: () => void,
  ) => void
}

export const EDITOR_HOOK_POLL_MS = 500
export const EDITOR_HOOK_TIMEOUT_MS = 30_000

const defaultGetYmaps = (): unknown => (globalThis as Record<string, unknown>).ymaps

/**
 * Дожидается загрузки ymaps и подписывается на запуск редакторов геометрии.
 * Возвращает функцию очистки.
 */
export const installGeometryEditorHook = (
  handlers: EditorHookHandlers,
  options: {
    getYmaps?: () => unknown
    pollMs?: number
    timeoutMs?: number
  } = {},
): (() => void) => {
  const getYmaps = options.getYmaps ?? defaultGetYmaps
  const pollMs = options.pollMs ?? EDITOR_HOOK_POLL_MS
  const timeoutMs = options.timeoutMs ?? EDITOR_HOOK_TIMEOUT_MS

  let cancelled = false
  let hooked = false
  let requested = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const startedAt = Date.now()

  const requestHook = (ymaps: unknown): void => {
    if (requested || hooked) return
    const modules = (ymaps as { modules?: YmapsModulesLike } | null)?.modules
    if (!modules || typeof modules.require !== 'function') return

    requested = true
    try {
      modules.require(
        ['geometryEditor.Base', 'geometryEditor.MultiGeometry'],
        (Base, MultiGeometry) => {
          if (cancelled) return
          const baseHooked = hookGeometryEditorPrototype(Base, handlers)
          const multiHooked = hookMultiGeometryPrototype(MultiGeometry, handlers)
          hooked = baseHooked || multiHooked
          if (!hooked) requested = false
        },
      )
    } catch {
      requested = false
    }
  }

  const poll = (): void => {
    if (cancelled || hooked) return

    const ymaps = getYmaps()
    if (ymaps) requestHook(ymaps)

    if (cancelled || hooked) return
    if (Date.now() - startedAt >= timeoutMs) return

    timer = setTimeout(poll, pollMs)
  }

  poll()

  return () => {
    cancelled = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
}
