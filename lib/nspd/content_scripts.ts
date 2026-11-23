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
  setStoredNspdButtonEnabled,
} from '@/lib/nspd/nspd_button'

export { NSPD_COLLECTOR_SCRIPT_ID, NSPD_INTERCEPTOR_SCRIPT_ID }

const NSPD_ORIGINS = [...NSPD_HOST_PATTERNS]

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
    console.warn('[nmap_uploader] nspd permissions.contains failed:', error)
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
    console.warn('[nmap_uploader] nspd permissions.request failed:', error)
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
 * Регистрирует недостающие скрипты НСПД.
 *
 * Идемпотентна и устойчива к гонке: панель настроек и background могут
 * синхронизировать состояние одновременно. Если браузер отклонил пакет
 * («Duplicate script ID»), перечитываем список и регистрируем только остаток.
 */
export const registerNspdContentScripts = async (): Promise<void> => {
  const registeredIds = await getRegisteredNspdIds()
  const toRegister = NSPD_REGISTERED_SCRIPTS.filter((script) => !registeredIds.includes(script.id))
  if (toRegister.length === 0) return

  try {
    await browser.scripting.registerContentScripts(toRegister)
  } catch (error: unknown) {
    // Гонка с другим контекстом: часть скриптов уже успели зарегистрировать,
    // и браузер отклонил весь пакет. Перечитываем и досоздаём остаток —
    // но только если он реально остался, иначе это настоящая ошибка.
    const idsAfterFailure = await getRegisteredNspdIds()
    const stillMissing = toRegister.filter((script) => !idsAfterFailure.includes(script.id))

    if (stillMissing.length === 0) return
    if (stillMissing.length === toRegister.length) throw error

    await browser.scripting.registerContentScripts(stillMissing)
  }
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
 * выдаётся. Поэтому при явно сохранённой настройке пропажа доступа её выключает
 * (иначе тумблер обещал бы работающую кнопку), а при отсутствии сохранённого
 * значения кнопка остаётся включённой — скрипты просто не регистрируются, пока
 * пользователь не разрешит доступ. При недоступном API состояние не трогаем:
 * иначе сбой чтения разрешений молча менял бы настройку.
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
    if (access === 'denied' && stored === true) {
      await setStoredNspdButtonEnabled(false)
      await unregisterNspdContentScripts()
      return
    }
    // Доступ не выдан, но настройку пользователь не включал: кнопку оставляем
    // включённой, скрипты — снятыми.
    await unregisterNspdContentScripts()
  })

const runNspdSync = (enabled: boolean): void => {
  void syncNspdContentScripts(enabled).catch((error: unknown) => {
    console.warn('[nmap_uploader] syncNspdContentScripts failed:', error)
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

const handlePermissionsRemoved = (removed: { origins?: string[] }): void => {
  const origins = removed.origins ?? []
  const lostNspdAccess = origins.some((origin) => NSPD_ORIGINS.includes(origin))
  if (!lostNspdAccess) return

  runNspdSync(false)
  void setStoredNspdButtonEnabled(false).catch((error: unknown) => {
    console.warn('[nmap_uploader] disable nspd after access revoke failed:', error)
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
    console.warn('[nmap_uploader] sync nspd after access grant failed:', error)
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
    console.warn('[nmap_uploader] syncNspdContentScriptsFromStorage failed:', error)
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
