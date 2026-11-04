/**
 * Единое описание content scripts НСПД.
 *
 * Используется и в `entrypoints/*.content.ts` при объявлении скрипта, и в рантайм-регистрации
 * (`lib/nspd/content_scripts.ts`), чтобы параметры запуска не разъезжались.
 * Модуль не импортирует `wxt/browser`: его читает сборка при генерации манифеста.
 */
import { NSPD_HOST_PATTERNS } from '@/lib/manifest/nspd_optional_hosts'

export const NSPD_COLLECTOR_SCRIPT_ID = 'nmap-nspd-collector'
export const NSPD_INTERCEPTOR_SCRIPT_ID = 'nmap-nspd-interceptor'

export type NspdContentScriptDescriptor = {
  id: string
  /** Путь к собранному файлу; нужен только для динамической регистрации. */
  js: string
  matches: readonly string[]
  runAt: 'document_start' | 'document_idle'
  allFrames: boolean
  world: 'ISOLATED' | 'MAIN'
}

export const NSPD_COLLECTOR_SCRIPT = {
  id: NSPD_COLLECTOR_SCRIPT_ID,
  js: 'content-scripts/nspd-collector.js',
  matches: NSPD_HOST_PATTERNS,
  runAt: 'document_idle',
  allFrames: true,
  world: 'ISOLATED',
} as const satisfies NspdContentScriptDescriptor

export const NSPD_INTERCEPTOR_SCRIPT = {
  id: NSPD_INTERCEPTOR_SCRIPT_ID,
  js: 'content-scripts/nspd-interceptor-main.js',
  matches: NSPD_HOST_PATTERNS,
  runAt: 'document_start',
  allFrames: true,
  world: 'MAIN',
} as const satisfies NspdContentScriptDescriptor

export const NSPD_CONTENT_SCRIPTS = [NSPD_COLLECTOR_SCRIPT, NSPD_INTERCEPTOR_SCRIPT] as const
