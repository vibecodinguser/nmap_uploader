/**
 * Сервис аутентификации и работы с учетной записью Яндекс для background.
 */
import { resetNotesSession } from '@/lib/background/notes/guard'
import { runBackgroundTask } from '@/lib/background/tasks'
import { getErrorMessage } from '@/lib/errors'
import { getBackgroundLocale, type Locale } from '@/lib/i18n'
import {
  type AuthPayload,
  buildAuthPayload,
  clearAuth,
  ensureYandexAuth,
  getStoredAuth,
  hasYandexPermissions,
  listExistingDateFolders,
} from '@/lib/yandex/client'
import {
  type AuthMessageResponse,
  getBackgroundTranslator,
  handleYandexAuthFailure,
  handleYandexAuthSuccess,
} from './auth_message_response_helpers'

export * from './auth_message_response_helpers'

type AuthMessageOptions = {
  interactive: boolean
  sendResponse: (response: AuthMessageResponse) => void
  logLabel: string
  cancelError?: string
  /** Язык вызвавшей панели; без него — язык браузера. */
  locale?: unknown
}

const resolveAuthLocale = (locale: unknown): Locale => getBackgroundLocale({ locale })

const processYandexAuthMessage = async ({
  interactive,
  sendResponse,
  logLabel,
  cancelError,
  locale,
}: AuthMessageOptions): Promise<void> => {
  try {
    const auth = await ensureYandexAuth({ interactive })
    const payload = await buildAuthPayload(auth)
    await handleYandexAuthSuccess(payload, sendResponse, cancelError)
  } catch (error: unknown) {
    await handleYandexAuthFailure(error, sendResponse, logLabel, resolveAuthLocale(locale))
  }
}

export const handleYandexAuthMessage = ({
  interactive,
  sendResponse,
  logLabel,
  cancelError,
  locale,
}: AuthMessageOptions): void => {
  const authTask = processYandexAuthMessage({
    interactive,
    sendResponse,
    logLabel,
    cancelError,
    locale,
  })
  runBackgroundTask(authTask, logLabel)
}

export const processGetAuth = async (
  sendResponse: (response: AuthPayload | { user: null; avatarDataUrl: null }) => void,
): Promise<void> => {
  try {
    // Токен без разрешений браузера бесполезен: userinfo, за которым идёт
    // `buildAuthPayload`, вернёт сетевую ошибку. Отвечаем «гость» и лишь
    // читаем кэш пользователя — без сети и без входного окна (ADR 0022).
    const auth = (await hasYandexPermissions()) ? await getStoredAuth() : null
    const payload = await buildAuthPayload(auth)
    sendResponse(payload)
  } catch {
    sendResponse({ user: null, avatarDataUrl: null })
  }
}

export const processLogin = async (
  sendResponse: (response: AuthMessageResponse) => void,
  locale?: unknown,
): Promise<void> => {
  const t = getBackgroundTranslator(resolveAuthLocale(locale))
  const authCancelledMessage = t('auth.authCancelled')
  await processYandexAuthMessage({
    interactive: true,
    sendResponse,
    logLabel: 'login',
    cancelError: authCancelledMessage,
    locale,
  })
}

export const processLoginAccessDenied = async (
  sendResponse: (response: AuthMessageResponse) => void,
  locale?: unknown,
): Promise<void> => {
  const t = getBackgroundTranslator(resolveAuthLocale(locale))
  const accessDeniedMessage = t('common.accessDenied')
  sendResponse({
    ok: false,
    user: null,
    avatarDataUrl: null,
    error: accessDeniedMessage,
  })
}

export const processLogout = async (
  sendResponse: (response: { ok: boolean }) => void,
): Promise<void> => {
  try {
    await clearAuth({ explicit: true })
    // Заметки прошлого аккаунта не должны остаться ни в памяти, ни в кэше:
    // иначе после входа другим пользователем панель показала бы чужой снимок.
    await resetNotesSession()
    sendResponse({ ok: true })
  } catch (error: unknown) {
    console.error('[yamapper] logout failed:', error)
    sendResponse({ ok: false })
  }
}

export const processListOccupiedDates = async (
  sendResponse: (response: { ok: boolean; dates: string[]; error?: string }) => void,
  locale?: unknown,
): Promise<void> => {
  try {
    // Без разрешений Яндекса календарь остаётся пустым: список занятых дат —
    // подсказка, а не отказ, и запрос на него впустую ходил бы в сеть.
    const auth = (await hasYandexPermissions()) ? await getStoredAuth() : null
    if (auth) {
      const dates = await listExistingDateFolders({ token: auth.token })
      sendResponse({ ok: true, dates })
    } else {
      sendResponse({ ok: true, dates: [] })
    }
  } catch (error: unknown) {
    console.error('[yamapper] listOccupiedDates failed:', error)
    const t = getBackgroundTranslator(resolveAuthLocale(locale))
    const folderReadErrorFallback = t('auth.folderReadError')
    sendResponse({
      ok: false,
      dates: [],
      error: getErrorMessage(error, folderReadErrorFallback),
    })
  }
}
