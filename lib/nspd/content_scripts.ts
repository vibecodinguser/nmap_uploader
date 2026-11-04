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
  getStoredNspdButtonEnabled,
  NSPD_BUTTON_ENABLED_STORAGE_KEY,
  setStoredNspdButtonEnabled,
} from '@/lib/nspd/nspd_button'

export const NSPD_COLLECTOR_SCRIPT_ID = 'nmap-nspd-collector'
export const NSPD_INTERCEPTOR_SCRIPT_ID = 'nmap-nspd-interceptor'

const NSPD_ORIGINS = [...NSPD_HOST_PATTERNS]

type RegisteredNspdScript = {
  id: string
  js: string[]
  matches: string[]
  runAt: 'document_start' | 'document_idle'
  allFrames: boolean
  world: 'ISOLATED' | 'MAIN'
}

/** Описание скриптов повторяет прежние записи `manifest.content_scripts`. */
export const NSPD_REGISTERED_SCRIPTS: RegisteredNspdScript[] = [
  {
    id: NSPD_COLLECTOR_SCRIPT_ID,
    js: ['content-scripts/nspd-collector.js'],
    matches: NSPD_ORIGINS,
    runAt: 'document_idle',
    allFrames: true,
    world: 'ISOLATED',
  },
  {
    id: NSPD_INTERCEPTOR_SCRIPT_ID,
    js: ['content-scripts/nspd-interceptor-main.js'],
    matches: NSPD_ORIGINS,
    runAt: 'document_start',
    allFrames: true,
    world: 'MAIN',
  },
]

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
 * Регистрирует недостающие скрипты НСПД.
 *
 * Идемпотентна и устойчива к гонке: панель настроек и background могут синхронизировать
 * состояние одновременно, и тогда один из вызовов получит «уже зарегистрирован».
 */
export const registerNspdContentScripts = async (): Promise<void> => {
  const registeredIds = await getRegisteredNspdIds()
  const toRegister = NSPD_REGISTERED_SCRIPTS.filter((script) => !registeredIds.includes(script.id))
  if (toRegister.length === 0) return

  try {
    await browser.scripting.registerContentScripts(toRegister)
  } catch (error: unknown) {
    const idsAfterFailure = await getRegisteredNspdIds()
    const stillMissing = toRegister.filter((script) => !idsAfterFailure.includes(script.id))
    if (stillMissing.length > 0) throw error
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
export const syncNspdContentScripts = async (enabled: boolean): Promise<void> => {
  const shouldRegister = enabled && (await hasNspdHostAccess())
  if (shouldRegister) {
    await registerNspdContentScripts()
    return
  }
  await unregisterNspdContentScripts()
}

/**
 * Синхронизирует скрипты с сохранённой настройкой.
 *
 * Если настройка включена, а доступа к домену нет (пользователь отозвал его или браузер
 * сбросил разрешение при обновлении), функция выключается — иначе тумблер обещал бы
 * работающую кнопку, которой нет. При недоступном API состояние не трогаем: иначе
 * сбой чтения разрешений молча выключал бы функцию.
 */
export const syncNspdContentScriptsFromStorage = async (): Promise<void> => {
  const enabled = await getStoredNspdButtonEnabled()
  if (!enabled) {
    await unregisterNspdContentScripts()
    return
  }

  const access = await readNspdAccessState()
  if (access === 'granted') {
    await registerNspdContentScripts()
    return
  }
  if (access === 'denied') {
    await setStoredNspdButtonEnabled(false)
    await unregisterNspdContentScripts()
  }
}

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
 * Подписывается на изменение настройки и отзыв доступа.
 *
 * Браузер очищает динамические content scripts при обновлении расширения,
 * поэтому `syncNspdContentScriptsFromStorage` дополнительно вызывается из
 * `runtime.onInstalled` и при старте background.
 */
export const initNspdContentScriptSync = (): void => {
  void syncNspdContentScriptsFromStorage().catch((error: unknown) => {
    console.warn('[nmap_uploader] syncNspdContentScriptsFromStorage failed:', error)
  })

  browser.storage.onChanged.addListener(handleStorageChange)
  browser.permissions.onRemoved.addListener(handlePermissionsRemoved)
}
