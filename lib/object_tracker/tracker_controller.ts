import { browser } from 'wxt/browser'
import {
  type BatchTransport,
  createFetchTransport,
  getGeoObjectCall,
  getObjectCommitsCall,
  isMissingObjectError,
  parseCommitsResult,
  parseGeoObjectResult,
} from './batch_api'
import { getCsrfToken, hasCsrfToken, resetCsrfToken } from './csrf_token'
import { buildReadMarks, mergeCachedCommits, pollTrackedObjects } from './poller'
import {
  clampIntervalMinutes,
  forgetObjectLocalState,
  getTrackerLocalState,
  getTrackerSettings,
  isValidObjectId,
  normalizeObjectId,
  setCachedCommits,
  setReadMarks,
  setTrackedObjects,
  TRACKER_ENABLED_KEY,
  TRACKER_INTERVAL_KEY,
  TRACKER_OBJECTS_KEY,
} from './storage'
import { MAX_TRACKED_OBJECTS, type ObjectCommit, type TrackedObject } from './types'
import { renderPanel, type TrackerViewMode, type TrackerViewModel } from './ui/dom'
import { ObjectTrackerSidebar } from './ui/mount'

export interface TrackerControllerOptions {
  /** Транспорт подменяется в тестах. */
  transport?: BatchTransport
  /** Источник текущего токена подменяется в тестах. */
  getToken?: () => string
}
const BADGE_BACKGROUND = '#ffdb4d'
const BADGE_TEXT_COLOR = '#000000'
const BADGE_MAX_DIGITS = 3

type ActionApi = {
  setBadgeText?: (details: { text: string }) => Promise<void> | void
  setBadgeBackgroundColor?: (details: { color: string }) => Promise<void> | void
  setBadgeTextColor?: (details: { color: string }) => Promise<void> | void
}

/** В MV3 бейдж — `action`, в MV2 (Firefox) — `browserAction`. */
const getActionApi = (): ActionApi | null => {
  const candidate = browser as unknown as { action?: ActionApi; browserAction?: ActionApi }
  return candidate.action ?? candidate.browserAction ?? null
}

/** Ставит число новых правок на иконку расширения. */
export const setTrackerBadge = async (count: number): Promise<void> => {
  const action = getActionApi()
  if (!action?.setBadgeText) {
    return
  }

  const text = count > 0 ? String(count).slice(0, BADGE_MAX_DIGITS) : ''
  try {
    await action.setBadgeText({ text })
    if (count > 0) {
      await action.setBadgeBackgroundColor?.({ color: BADGE_BACKGROUND })
      await action.setBadgeTextColor?.({ color: BADGE_TEXT_COLOR })
    }
  } catch (error: unknown) {
    console.warn('[nmap_uploader] object tracker badge failed:', error)
  }
}

/**
 * Управляет наблюдением за историей объектов: настройки, опрос, интерфейс, бейдж.
 */
export class ObjectTrackerController {
  private readonly transport: BatchTransport
  private readonly getToken: () => string
  private readonly sidebar: ObjectTrackerSidebar

  private settingsEnabled = false
  private intervalMinutes = 30
  private objects: TrackedObject[] = []
  private commitsByObject: Record<string, ObjectCommit[]> = {}
  private readMarks: Record<string, string> = {}
  private errors: Record<string, string> = {}
  private newCommitIds = new Set<string>()
  private isRefreshing = false
  private mode: TrackerViewMode = 'feed'
  private timer: ReturnType<typeof setInterval> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private started = false
  private storageListener: ((changes: Record<string, unknown>, area: string) => void) | null = null

  constructor(options?: TrackerControllerOptions) {
    this.transport = options?.transport ?? createFetchTransport(fetch)
    this.getToken = options?.getToken ?? getCsrfToken
    this.sidebar = new ObjectTrackerSidebar({
      onActivate: () => {
        void this.handleTabOpened()
      },
    })
  }

  /** Запускает контроллер: читает настройки и монтирует UI, если функция включена. */
  public async start(): Promise<void> {
    if (this.started) {
      return
    }
    this.started = true

    this.attachStorageListener()
    await this.reloadSettings()

    this.scheduleTimer()
    this.scheduleHeartbeat()
  }

  public stop(): void {
    this.started = false
    this.clearTimer()
    this.clearHeartbeat()
    this.detachStorageListener()
    this.sidebar.unmount()
    void setTrackerBadge(0)
  }

  /** Перечитывает настройки из хранилища и применяет их. */
  public async reloadSettings(): Promise<void> {
    const settings = await getTrackerSettings()
    const wasEnabled = this.settingsEnabled

    this.settingsEnabled = settings.enabled
    this.intervalMinutes = clampIntervalMinutes(settings.intervalMinutes)
    this.objects = settings.objects

    const local = await getTrackerLocalState()
    this.readMarks = local.readMarks
    this.commitsByObject = local.cachedCommits

    if (this.settingsEnabled && !wasEnabled) {
      this.mount()
      await this.refresh()
    } else if (!this.settingsEnabled && wasEnabled) {
      this.sidebar.unmount()
      void setTrackerBadge(0)
    }

    this.scheduleTimer()
    this.render()
  }

  /** Опрашивает историю всех объектов и обновляет интерфейс. */
  public async refresh(): Promise<void> {
    if (!this.settingsEnabled || this.isRefreshing || this.objects.length === 0) {
      this.render()
      return
    }

    this.isRefreshing = true
    this.render()

    try {
      if (!this.getToken()) {
        this.errors = { '*': 'NO_TOKEN' }
        this.render()
        return
      }

      const result = await pollTrackedObjects(
        { transport: this.transport, token: this.getToken() },
        this.objects,
        this.readMarks,
      )

      if (result.tokenRejected) {
        resetCsrfToken()
        this.errors = { '*': 'TOKEN_REJECTED' }
        this.render()
        return
      }

      this.errors = result.errors
      this.commitsByObject = mergeCachedCommits(this.commitsByObject, result.commitsByObject)
      this.newCommitIds = new Set(result.newCommits.map((commit) => commit.id))

      // Дотягиваем название и категорию: без категории в карточке серый placeholder.
      if (Object.keys(result.enrichedObjects).length > 0) {
        this.objects = this.objects.map((object) => {
          const details = result.enrichedObjects[object.id]
          if (!details) {
            return object
          }
          const fallbackTitle = object.title === object.id || object.title === ''
          return {
            ...object,
            title: fallbackTitle && details.title ? details.title : object.title,
            categoryId: object.categoryId ?? details.categoryId ?? undefined,
          }
        })
        await setTrackedObjects(this.objects)
      }

      await setCachedCommits(this.commitsByObject)
      await setTrackerBadge(result.newCommits.length)

      // Названия могли не сохраниться при добавлении — подтягиваем из истории.
      this.render()
    } catch (error: unknown) {
      console.warn('[nmap_uploader] object tracker refresh failed:', error)
      this.errors = { '*': 'FETCH_FAILED' }
      this.render()
    } finally {
      this.isRefreshing = false
      this.render()
    }
  }

  /** Добавляет объект: проверяет существование и запоминает последнюю правку. */
  public async addObject(rawId: string): Promise<{ ok: boolean; error?: string }> {
    const id = normalizeObjectId(rawId)

    if (!isValidObjectId(id)) {
      return { ok: false, error: 'INVALID_ID' }
    }
    if (this.objects.some((object) => object.id === id)) {
      return { ok: false, error: 'DUPLICATE' }
    }
    if (this.objects.length >= MAX_TRACKED_OBJECTS) {
      return { ok: false, error: 'LIMIT_REACHED' }
    }

    const token = this.getToken()
    if (!token) {
      return { ok: false, error: 'NO_TOKEN' }
    }

    try {
      const results = await this.transport([getGeoObjectCall(id), getObjectCommitsCall(id)], token)

      const info = parseGeoObjectResult(results[0])
      if (!info.exists) {
        return {
          ok: false,
          error: isMissingObjectError(info.errorType) ? 'MISSING_OBJECT' : 'CHECK_FAILED',
        }
      }

      const page = parseCommitsResult(results[1], id)
      const title = info.title ?? id

      this.objects = [
        ...this.objects,
        { id, title, categoryId: info.categoryId ?? undefined, addedAt: Date.now() },
      ]
      await setTrackedObjects(this.objects)

      // История до добавления не считается «новой».
      const latest = page.commits[0]
      if (latest) {
        this.readMarks = { ...this.readMarks, [id]: latest.id }
        await setReadMarks(this.readMarks)
      }

      this.commitsByObject = mergeCachedCommits(this.commitsByObject, { [id]: page.commits })
      await setCachedCommits(this.commitsByObject)

      this.errors = { ...this.errors }
      delete this.errors[id]

      this.render()
      return { ok: true }
    } catch (error: unknown) {
      console.warn('[nmap_uploader] object tracker add failed:', error)
      return { ok: false, error: 'FETCH_FAILED' }
    }
  }

  /** Убирает объект из наблюдения и чистит локальные данные. */
  public async removeObject(objectId: string): Promise<void> {
    this.objects = this.objects.filter((object) => object.id !== objectId)
    await setTrackedObjects(this.objects)

    const commitsByObject = { ...this.commitsByObject }
    delete commitsByObject[objectId]
    this.commitsByObject = commitsByObject

    const errors = { ...this.errors }
    delete errors[objectId]
    this.errors = errors

    await forgetObjectLocalState(objectId)
    this.render()
  }

  /** Текущее представление для отрисовки и тестов. */
  public getViewModel(): TrackerViewModel {
    return {
      mode: this.mode,
      objects: this.objects,
      commitsByObject: this.commitsByObject,
      newCommitIds: this.newCommitIds,
      errors: this.errors,
      isLoading: this.isRefreshing,
      hasToken: this.getToken().length > 0,
      intervalMinutes: this.intervalMinutes,
    }
  }

  /** Перерисовывает панель, если она смонтирована. */
  public render(): void {
    this.sidebar.setHasUnread(this.newCommitIds.size > 0)

    const panel = this.sidebar.getPanel()
    if (!panel) {
      return
    }

    renderPanel(panel, this.getViewModel(), {
      onAddObject: (id) => {
        void this.addObject(id)
      },
      onRemoveObject: (id) => {
        void this.removeObject(id)
      },
      onModeChange: (mode) => {
        this.mode = mode
        this.render()
      },
      onRefresh: () => {
        void this.refresh()
      },
      onMarkAllRead: () => {
        void this.markAllRead()
      },
    })
  }

  /** Отмечает всё прочитанным и сбрасывает бейдж. */
  public async markAllRead(): Promise<void> {
    this.readMarks = buildReadMarks(this.commitsByObject, this.readMarks)
    await setReadMarks(this.readMarks)
    this.newCommitIds = new Set()
    await setTrackerBadge(0)
    this.render()
  }

  private async handleTabOpened(): Promise<void> {
    await this.markAllRead()

    if (Object.keys(this.commitsByObject).length === 0) {
      await this.refresh()
    }
  }

  private mount(): void {
    if (!this.sidebar.mount()) {
      return
    }
    this.render()
  }

  private scheduleTimer(): void {
    this.clearTimer()

    if (!this.settingsEnabled) {
      return
    }

    const intervalMs = Math.max(1, this.intervalMinutes) * 60 * 1000
    this.timer = setInterval(() => {
      void this.refresh()
    }, intervalMs)
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** Следит за тем, чтобы вкладка оставалась смонтированной после перерисовок панели. */
  private scheduleHeartbeat(): void {
    this.clearHeartbeat()

    this.heartbeatTimer = setInterval(() => {
      if (!this.settingsEnabled) {
        return
      }
      if (!this.sidebar.isMounted()) {
        this.mount()
        return
      }
      // Индикатор вкладки пересчитываем после перерисовок и ресайза панели.
      this.sidebar.syncSelection()
    }, 1000)
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private attachStorageListener(): void {
    if (this.storageListener) {
      return
    }

    const listener = (changes: Record<string, unknown>, area: string): void => {
      const relevant =
        TRACKER_ENABLED_KEY in changes ||
        TRACKER_INTERVAL_KEY in changes ||
        TRACKER_OBJECTS_KEY in changes
      if (!relevant) {
        return
      }
      if (area !== 'sync' && area !== 'local') {
        return
      }
      void this.reloadSettings()
    }

    this.storageListener = listener
    browser.storage.onChanged.addListener(listener)
  }

  private detachStorageListener(): void {
    if (!this.storageListener) {
      return
    }
    browser.storage.onChanged.removeListener(this.storageListener)
    this.storageListener = null
  }
}

/** Проверяет, есть ли перехваченный токен: используется в UI-подсказке. */
export const isTrackerReady = (): boolean => hasCsrfToken()
