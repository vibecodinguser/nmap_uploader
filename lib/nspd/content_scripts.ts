/**
 * Динамическая регистрация content scripts НСПД.
 *
 * Скрипты для nspd.gov.ru не объявляются в манифесте: иначе доступ к домену стал бы
 * обязательным разрешением, и браузер отключал бы расширение при каждом обновлении.
 * Вместо этого доступ запрашивается в рантайме (`permissions.request`), а скрипты
 * регистрируются через `scripting.registerContentScripts`, пока функция включена.
 */
import { browser } from 'wxt/browser'
import { NSPD_HOST_PATTERNS } from '@/lib/manifest/nspd_optional_hosts'
import {
  NSPD_COLLECTOR_SCRIPT_ID,
  NSPD_CONTENT_SCRIPTS,
  NSPD_INTERCEPTOR_SCRIPT_ID,
  type NspdContentScriptDescriptor,
} from '@/lib/nspd/content_script_descriptors'
import {
  NSPD_BUTTON_ENABLED_STORAGE_KEY,
  readStoredNspdButtonEnabled,
} from '@/lib/nspd/nspd_button'

export { NSPD_COLLECTOR_SCRIPT_ID, NSPD_INTERCEPTOR_SCRIPT_ID }

export const NSPD_ORIGINS = [...NSPD_HOST_PATTERNS]

type RegisteredNspdScript = {
  id: string
  js: string[]
  matches: string[]
  runAt: NspdContentScriptDescriptor['runAt']
  allFrames: boolean
  world: NspdContentScriptDescriptor['world']
}

/** Описание для `scripting.registerContentScripts`, собранное из общих дескрипторов. */
export const NSPD_REGISTERED_SCRIPTS: RegisteredNspdScript[] = NSPD_CONTENT_SCRIPTS.map(
  (script) => ({
    id: script.id,
    js: [script.js],
    matches: [...script.matches],
    runAt: script.runAt,
    allFrames: script.allFrames,
    world: script.world,
  }),
)

const NSPD_SCRIPT_IDS = NSPD_REGISTERED_SCRIPTS.map((script) => script.id)

const isNspdScriptId = (id: string): boolean => NSPD_SCRIPT_IDS.includes(id)

/** Состояние доступа к домену НСПД: `unknown` — API недоступен или бросил ошибку. */
export type NspdAccessState = 'granted' | 'denied' | 'unknown'

const readNspdAccessState = async (): Promise<NspdAccessState> => {
  try {
    const granted = await browser.permissions.contains({ origins: NSPD_ORIGINS })
    return granted ? 'granted' : 'denied'
  } catch (error: unknown) {
    console.warn('[yamapper] nspd permissions.contains failed:', error)
    return 'unknown'
  }
}

/** Выдан ли пользователем доступ к домену НСПД. */
export const hasNspdHostAccess = async (): Promise<boolean> =>
  (await readNspdAccessState()) === 'granted'

/**
 * Запрашивает доступ к домену НСПД.
 * Вызывать только из обработчика действия пользователя — иначе браузер отклонит запрос.
 */
export const requestNspdHostAccess = async (): Promise<boolean> => {
  try {
    return await browser.permissions.request({ origins: NSPD_ORIGINS })
  } catch (error: unknown) {
    console.warn('[yamapper] nspd permissions.request failed:', error)
    return false
  }
}

const getRegisteredNspdIds = async (): Promise<string[]> => {
  const registered = await browser.scripting.getRegisteredContentScripts()
  return registered.map((script) => script.id).filter(isNspdScriptId)
}

/**
 * Очередь синхронизаций.
 *
 * Регистрация — не атомарная операция: панель настроек и background могут
 * синхронизировать состояние одновременно, и тогда оба вызова видят «скриптов
 * нет» и оба пытаются их зарегистрировать. Внутри одного контекста очередь
 * убирает гонку полностью; между контекстами страхует обработка дубликата.
 */
let syncQueue: Promise<void> = Promise.resolve()

const enqueueSync = (task: () => Promise<void>): Promise<void> => {
  const next = syncQueue.then(task, task)
  syncQueue = next.catch(() => {})
  return next
}

/**
 * Отличает гонку от настоящей ошибки: так браузер сообщает, что id занят.
 *
 * Формулировка у Chromium и Firefox одна и та же — «Duplicate script ID '…'»,
 * поэтому сверка по тексту здесь надёжнее, чем попытка угадать по коду ошибки.
 */
const isDuplicateScriptIdError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes('duplicate script id')
}

/**
 * Пробует зарегистрировать скрипты и возвращает те, которых так и нет.
 *
 * Список перечитывается после отказа: часть пакета мог успеть поставить другой
 * контекст. Ошибку, не похожую на дубликат, пробрасывает сразу — её нельзя
 * вылечить повторной регистрацией.
 */
const tryRegisterNspdScripts = async (
  scripts: RegisteredNspdScript[],
): Promise<RegisteredNspdScript[]> => {
  try {
    await browser.scripting.registerContentScripts(scripts)
    return []
  } catch (error: unknown) {
    const registeredIds = await getRegisteredNspdIds()
    const stillMissing = scripts.filter((script) => !registeredIds.includes(script.id))
    if (stillMissing.length === 0) return []
    if (!isDuplicateScriptIdError(error)) throw error
    return stillMissing
  }
}

/** Снимает регистрацию по id, не падая, если скриптов уже нет. */
const unregisterNspdScripts = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return
  try {
    await browser.scripting.unregisterContentScripts({ ids })
  } catch {
    // Скрипт мог исчезнуть вместе с отзывом доступа — цель всё равно достигнута.
  }
}

/**
 * Регистрирует недостающие скрипты НСПД.
 *
 * Идемпотентна и устойчива к гонке: панель настроек и background могут
 * синхронизировать состояние одновременно. Дубликат id от такого набега — не
 * сбой, а сигнал «этот скрипт уже ставит другой контекст», поэтому он никогда
 * не всплывает наружу: функция доводит состояние до нужного или бросает
 * настоящую ошибку.
 */
export const registerNspdContentScripts = async (): Promise<void> => {
  const registeredIds = await getRegisteredNspdIds()
  const missing = NSPD_REGISTERED_SCRIPTS.filter((script) => !registeredIds.includes(script.id))
  if (missing.length === 0) return

  const afterFirstAttempt = await tryRegisterNspdScripts(missing)
  if (afterFirstAttempt.length === 0) return

  // «Duplicate script ID» при пустом списке зарегистрированных значит, что id
  // держит другой контекст, а `getRegisteredContentScripts` ещё не показывает
  // его. Снимаем заявку и ставим заново — иначе гонка выглядела бы в панели
  // настроек как настоящий сбой сохранения.
  await unregisterNspdScripts(afterFirstAttempt.map((script) => script.id))
  const afterSecondAttempt = await tryRegisterNspdScripts(afterFirstAttempt)
  if (afterSecondAttempt.length === 0) return

  const ids = afterSecondAttempt.map((script) => script.id).join(', ')
  throw new Error(`Не удалось зарегистрировать content scripts НСПД: ${ids}`)
}

/** Снимает регистрацию скриптов НСПД. Идемпотентна. */
export const unregisterNspdContentScripts = async (): Promise<void> => {
  const ids = await getRegisteredNspdIds()
  if (ids.length === 0) return

  try {
    await browser.scripting.unregisterContentScripts({ ids })
  } catch (error: unknown) {
    const idsAfterFailure = await getRegisteredNspdIds()
    if (idsAfterFailure.length > 0) throw error
  }
}

/**
 * Приводит набор зарегистрированных скриптов в соответствие с настройкой и выдачей доступа.
 * Регистрация возможна только при выданном доступе к домену.
 */
export const syncNspdContentScripts = (enabled: boolean): Promise<void> =>
  enqueueSync(async () => {
    const shouldRegister = enabled && (await hasNspdHostAccess())
    if (shouldRegister) {
      await registerNspdContentScripts()
      return
    }
    await unregisterNspdContentScripts()
  })

/**
 * Дождаться, пока завершатся все запланированные синхронизации.
 *
 * Синхронизация запускается ещё и из слушателей (`storage.onChanged`,
 * `permissions.onRemoved`), где её результат никто не ждёт. Тестам и
 * диагностике нужна точка, в которой состояние уже устоялось.
 */
export const whenNspdSyncIdle = (): Promise<void> => syncQueue

/**
 * Синхронизирует скрипты с сохранённой настройкой.
 *
 * Кнопка по умолчанию включена, но доступ к домену необязательный и по себе не
 * выдаётся, поэтому включённая настройка без доступа означает «кнопка есть в
 * тулбаре, скрипты ждут разрешения» — не «выключить функцию».
 *
 * Раньше здесь настройка сбрасывалась в `false` при отсутствии доступа. Это
 * ломало обновление: у пользователя старый доступ к НСПД был обязательным и уже
 * выданным, а новая версия переносит его в необязательные — то есть при первом
 * запуске доступа ещё нет. Сброс выключал тумблер, пользователь видел
 * выключенную функцию и сайт без кнопки, а выдача доступа не включала её
 * обратно, потому что настройка уже стояла `false`.
 *
 * Настройку пользователя не меняем никогда: это его выбор, а не состояние
 * разрешений. При недоступном API разрешений состояние тоже не трогаем — иначе
 * сбой чтения молча выключал бы функцию.
 */
export const syncNspdContentScriptsFromStorage = (): Promise<void> =>
  enqueueSync(async () => {
    const stored = await readStoredNspdButtonEnabled()
    const enabled = stored ?? true
    if (!enabled) {
      await unregisterNspdContentScripts()
      return
    }

    const access = await readNspdAccessState()
    if (access === 'granted') {
      await registerNspdContentScripts()
      return
    }
    // Доступ не выдан: кнопку в тулбаре оставляем включённой, скрипты — снятыми.
    await unregisterNspdContentScripts()
  })

const runNspdSync = (enabled: boolean): void => {
  void syncNspdContentScripts(enabled).catch((error: unknown) => {
    console.warn('[yamapper] syncNspdContentScripts failed:', error)
  })
}

const handleStorageChange = (
  changes: Record<string, { newValue?: unknown }>,
  area: string,
): void => {
  if (area !== 'local' || !(NSPD_BUTTON_ENABLED_STORAGE_KEY in changes)) return
  const nextValue = changes[NSPD_BUTTON_ENABLED_STORAGE_KEY]?.newValue
  runNspdSync(nextValue === true)
}

/**
 * Отзыв доступа к НСПД — снимаем скрипты, но настройку не трогаем.
 *
 * Тумблер остаётся включённым: он про кнопку в тулбаре, а не про выданные
 * разрешения. Когда доступ вернут, скрипты зарегистрируются сами через
 * `permissions.onAdded`, и функция заработает без повторного включения.
 */
const handlePermissionsRemoved = (removed: { origins?: string[] }): void => {
  const origins = removed.origins ?? []
  const lostNspdAccess = origins.some((origin) => NSPD_ORIGINS.includes(origin))
  if (!lostNspdAccess) return

  void syncNspdContentScriptsFromStorage().catch((error: unknown) => {
    console.warn('[yamapper] sync nspd after access revoke failed:', error)
  })
}

/**
 * Доступ выдали в панели настроек — доводим регистрацию до конца.
 *
 * Панель регистрирует скрипты сама, сразу после `permissions.request()`, но
 * между контекстами возможна гонка. Повторная идемпотентная синхронизация
 * закрывает случай, когда вызов из панели упал.
 */
const handlePermissionsAdded = (added: { origins?: string[] }): void => {
  const origins = added.origins ?? []
  const gainedNspdAccess = origins.some((origin) => NSPD_ORIGINS.includes(origin))
  if (!gainedNspdAccess) return

  void syncNspdContentScriptsFromStorage().catch((error: unknown) => {
    console.warn('[yamapper] sync nspd after access grant failed:', error)
  })
}

/**
 * Подписывается на изменение настройки и отзыв доступа.
 *
 * Браузер очищает динамические content scripts при обновлении расширения,
 * поэтому `syncNspdContentScriptsFromStorage` дополнительно вызывается из
 * `runtime.onInstalled` и при старте background.
 */
export const initNspdContentScriptSync = (): (() => void) => {
  void syncNspdContentScriptsFromStorage().catch((error: unknown) => {
    console.warn('[yamapper] syncNspdContentScriptsFromStorage failed:', error)
  })

  browser.storage.onChanged.addListener(handleStorageChange)
  browser.permissions.onRemoved.addListener(handlePermissionsRemoved)
  browser.permissions.onAdded.addListener(handlePermissionsAdded)

  return () => {
    browser.storage.onChanged.removeListener(handleStorageChange)
    browser.permissions.onRemoved.removeListener(handlePermissionsRemoved)
    browser.permissions.onAdded.removeListener(handlePermissionsAdded)
  }
}
