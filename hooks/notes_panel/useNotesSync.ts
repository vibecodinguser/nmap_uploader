import { useCallback, useEffect, useRef } from 'react'
import { browser } from 'wxt/browser'
import { geometryFromDrawCoords } from '@/lib/notes/model/geometry'
import type { NoteGeometry } from '@/lib/notes/model/types'
import {
  type DrawableNoteKind,
  isDrawableNoteKind,
  NOTES_DRAW_FINISHED_ACTION,
  NOTES_LOAD_ACTION,
  NOTES_SELECT_ACTION,
  NOTES_SNAPSHOT_ACTION,
  type NotesLoadResponse,
  type NotesSnapshot,
} from '@/lib/notes/protocol'
import { PERMISSION_REQUIRED } from '@/lib/notes/storage/errors'
import { NOTES_PANEL_OPENED_MESSAGE, NOTES_PANEL_SHOW_NOTE_MESSAGE } from '@/lib/notes_panel/host'
import { YANDEX_PERMISSIONS_CHANGED_ACTION } from '@/lib/notes_permission/protocol'
import { requestYandexAccess } from '@/lib/yandex/disk_settings'
import { useNotesAutoReload } from './useNotesAutoReload'
import type { NotesPanelStore } from './useNotesPanelState'

/**
 * Загрузка снимка и подписки панели.
 *
 * Панель живёт в постоянно смонтированном iframe: без подписки на вход в
 * Яндекс и на возврат вкладки в фокус она навсегда осталась бы в том состоянии,
 * в котором открылась.
 */
export const useNotesSync = (
  store: NotesPanelStore,
  createNote: (kind: DrawableNoteKind, geometry: NoteGeometry) => void,
) => {
  const { dispatch } = store
  const createNoteRef = useRef(createNote)
  useEffect(() => {
    createNoteRef.current = createNote
  }, [createNote])

  /**
   * Режим рисования в изменяемой ссылке.
   *
   * `NOTES_DRAW_FINISHED` приходит в панель дважды: напрямую от content script
   * (`runtime.sendMessage` из content script получают все страницы расширения,
   * включая этот iframe) и ещё раз от background, который пересылает событие
   * вкладкам и панели. Ссылка, а не состояние: гасить режим нужно в момент
   * первого сообщения, иначе второе, пришедшее в той же пачке, успеет создать
   * ещё одну заметку.
   */
  const drawingKindRef = useRef(store.state.drawingKind)
  drawingKindRef.current = store.state.drawingKind

  /**
   * Разрешён ли автоматический вход.
   *
   * Панель открылась — намерение увидеть заметки явное, поэтому окно входа
   * показывается сразу, без промежуточной кнопки «Войти». Но ровно один раз за
   * открытие: иначе отменённый вход всплывал бы снова при каждом возврате
   * вкладки в фокус, а явный выход из аккаунта — при следующем перечитывании.
   */
  const autoLoginArmedRef = useRef(true)
  const loginRef = useRef<() => void>(() => {})
  /**
   * Была ли хоть одна загрузка с момента монтирования.
   *
   * Панель создаётся при первом открытии и сразу грузит снимок, поэтому
   * первое `NOTES_PANEL_OPENED` не должно запускать вторую загрузку — иначе
   * два ответа `AUTH_REQUIRED` пришли бы одновременно и второй успел бы
   * показать «Войти» поверх уже открытого окна входа.
   */
  const hasLoadedOnceRef = useRef(false)

  // Загрузка: при монтировании, после входа и по кнопке «Повторить».
  const loadNotes = useCallback(
    (options: { silent?: boolean } = {}) => {
      if (!options.silent) dispatch({ type: 'statusChanged', status: 'loading' })

      browser.runtime
        .sendMessage({ action: NOTES_LOAD_ACTION })
        .then((response: unknown) => {
          hasLoadedOnceRef.current = true
          const payload = response as NotesLoadResponse | undefined
          if (payload?.ok) {
            autoLoginArmedRef.current = false
            dispatch({ type: 'loaded', snapshot: payload.snapshot })
            return
          }

          const status =
            payload?.error === 'AUTH_REQUIRED'
              ? 'auth'
              : payload?.error === PERMISSION_REQUIRED
                ? 'permission'
                : 'error'
          const shouldAutoLogin = status === 'auth' && autoLoginArmedRef.current
          autoLoginArmedRef.current = false
          if (shouldAutoLogin) {
            loginRef.current()
            return
          }
          dispatch({ type: 'statusChanged', status })
        })
        .catch(() => {
          hasLoadedOnceRef.current = true
          autoLoginArmedRef.current = false
          dispatch({ type: 'statusChanged', status: 'error' })
        })
    },
    [dispatch],
  )

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useNotesAutoReload(store, loadNotes)

  /** Вход прямо из панели: токена нет, а карта открыта. */
  const login = useCallback(() => {
    dispatch({ type: 'statusChanged', status: 'loading' })
    browser.runtime
      .sendMessage({ action: 'login' })
      .then(() => loadNotes({ silent: true }))
      .catch(() => dispatch({ type: 'statusChanged', status: 'auth' }))
  }, [dispatch, loadNotes])

  useEffect(() => {
    loginRef.current = login
  }, [login])

  /**
   * Разрешения браузера на Яндекс: спрашиваем их под клик, затем загружаем.
   *
   * Жест пользователя обязателен и не переживает сетевых запросов, поэтому
   * порядок строгий: `permissions.request` первым, загрузка — после ответа
   * диалога. Если разрешения не дали, панель остаётся в том же состоянии и
   * предлагает попробовать снова.
   */
  const grantPermission = useCallback(() => {
    // Разрешения выдали ради заметок: если токена нет, вход запускается сам,
    // как и после ответа на диалог с кнопки в тулбаре.
    autoLoginArmedRef.current = true
    dispatch({ type: 'statusChanged', status: 'loading' })
    void (async () => {
      try {
        const granted = await requestYandexAccess()
        if (!granted) {
          autoLoginArmedRef.current = false
          dispatch({ type: 'statusChanged', status: 'permission' })
          return
        }
        loadNotes({ silent: true })
      } catch {
        autoLoginArmedRef.current = false
        dispatch({ type: 'statusChanged', status: 'permission' })
      }
    })()
  }, [dispatch, loadNotes])

  // Снимки и события карты.
  useEffect(() => {
    const handleMessage = (message: Record<string, unknown>) => {
      switch (message.action) {
        case NOTES_SNAPSHOT_ACTION: {
          const next = message.snapshot as NotesSnapshot | undefined
          if (next?.manifest) dispatch({ type: 'merged', snapshot: next })
          break
        }
        case NOTES_SELECT_ACTION: {
          const noteId = typeof message.noteId === 'string' ? message.noteId : null
          dispatch({ type: 'noteSelected', noteId })
          break
        }
        case NOTES_DRAW_FINISHED_ACTION: {
          // Ждём результат только если действительно рисуем: без этой проверки
          // одно нажатие давало две заметки — сообщение приходит по двум каналам.
          if (!drawingKindRef.current) break
          drawingKindRef.current = null

          const kind = message.kind
          const coords = message.coords
          dispatch({ type: 'drawingStopped' })
          if (isDrawableNoteKind(kind) && Array.isArray(coords)) {
            const geometry = geometryFromDrawCoords(kind, coords as [number, number][])
            if (geometry) createNoteRef.current(kind, geometry)
          }
          break
        }
        case YANDEX_PERMISSIONS_CHANGED_ACTION: {
          // Доступ выдали в настройках или из оверлея над кнопкой, пока панель
          // стояла в «Разрешить доступ»: перечитываем и, если токена нет,
          // сразу входим — как после ответа на диалог с самой кнопки.
          if (message.granted === true && store.state.status === 'permission') {
            autoLoginArmedRef.current = true
            loadNotes({ silent: true })
          }
          break
        }
        default:
          break
      }
    }

    const handleWindowMessage = (event: MessageEvent) => {
      const data = event.data as { action?: string; noteId?: string } | null
      if (data?.action === NOTES_PANEL_SHOW_NOTE_MESSAGE && typeof data.noteId === 'string') {
        dispatch({ type: 'noteSelected', noteId: data.noteId })
        return
      }
      if (data?.action === NOTES_PANEL_OPENED_MESSAGE) {
        // Панель открыли: это новое явное намерение увидеть заметки, значит
        // автоматическому входу снова можно сработать один раз.
        autoLoginArmedRef.current = true
        /*
         * Кнопка заметок открывает список, а не последнюю карточку (ADR 0008).
         * Без сброса панель могла остаться в свойствах заметки, которой уже
         * нет в снимке, и тогда не рисуется ни список, ни карточка.
         * «Редактировать» присылает выбор сразу следом, и он побеждает.
         */
        dispatch({ type: 'noteSelected', noteId: null })
        // Первая загрузка уже идёт с монтирования панели — вторая не нужна.
        if (hasLoadedOnceRef.current) loadNotes({ silent: true })
      }
    }

    browser.runtime.onMessage.addListener(handleMessage)
    window.addEventListener('message', handleWindowMessage)
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage)
      window.removeEventListener('message', handleWindowMessage)
    }
  }, [dispatch, loadNotes])

  return { loadNotes, login, grantPermission }
}
