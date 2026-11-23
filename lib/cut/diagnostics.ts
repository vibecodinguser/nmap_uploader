/**
 * Диагностика инструмента разреза: метка состояния на `<html>` и журнал
 * запусков активностей.
 *
 * Имена атрибута, ключа журнала и флага — внешний контракт: на них ссылаются
 * ADR 0013/0015 и `docs/nmaps-editor-internals.md`. Менять их нельзя, даже
 * если инструмент теперь режет не только растительность.
 */

/**
 * Метка состояния на `<html>`: по ней из консоли видно, дошёл ли инструмент до
 * каждого этапа. Без неё «кнопки нет» одинаково выглядит и когда скрипт не
 * загружен, и когда редактор не поймали.
 *
 * Значения:
 * - `loaded` — скрипт исполнился, хук ещё не поставлен;
 * - `hooked:<N>` — хук активностей установлен, перехвачено N классов;
 * - `idle` — редактор закрыт;
 * - `other:<категория>` — открыт редактор объекта, который не режем;
 * - `wait:<категория>` — объект открыт, но редактор ещё не готов резать;
 * - `unsupported:commands` — у редактора не нашёлся менеджер команд, разрез
 *   нельзя было бы отменить, поэтому инструмент выключен;
 * - `ready:<категория>:<элементов>` — кнопка доступна.
 *
 * Атрибут живёт, пока работает скрипт, и снимается при остановке.
 */
export const CUT_STATE_ATTR = 'data-nmap-veg-cut'

/**
 * Журнал запусков активностей для разбора проблем: последние 50 записей.
 * Ведётся только при включённой отладке (`CUT_DEBUG_FLAG`).
 */
export const CUT_LOG_KEY = '__nmapVegCutLog'

/** Ключ `localStorage`: значение `'1'` включает журнал и подробный лог. */
export const CUT_DEBUG_FLAG = 'nmap-veg-cut-debug'

export type CutLogEntry = {
  categoryId: string | null
  elementCategoryId: string | null
  elementRoleId: string | null
  elements: number
  canCut: boolean
  attrsKeys: string[] | null
}

const MAX_LOG_ENTRIES = 50

export const setCutState = (state: string): void => {
  try {
    document.documentElement.setAttribute(CUT_STATE_ATTR, state)
  } catch {
    // Документ мог быть уже выгружен
  }
}

export const clearCutState = (): void => {
  try {
    document.documentElement.removeAttribute(CUT_STATE_ATTR)
  } catch {
    // Документ мог быть уже выгружен
  }
}

export const isDebugEnabled = (): boolean => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(CUT_DEBUG_FLAG) === '1'
  } catch {
    // Хранилище может быть недоступно (настройки приватности)
    return false
  }
}

export const appendLogEntry = (entry: CutLogEntry): void => {
  try {
    const target = globalThis as Record<string, unknown>
    const log = Array.isArray(target[CUT_LOG_KEY]) ? (target[CUT_LOG_KEY] as CutLogEntry[]) : []
    log.push(entry)
    if (log.length > MAX_LOG_ENTRIES) {
      log.splice(0, log.length - MAX_LOG_ENTRIES)
    }
    target[CUT_LOG_KEY] = log
  } catch {
    // Журнал не должен ломать инструмент
  }
}
