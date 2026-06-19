import { browser } from 'wxt/browser'
import { RELOAD_EDITOR_PAGE_ACTION } from '@/lib/reload_editor_page'
import { getStoredAuth } from '@/lib/yandex/client'

const LEGACY_RELOAD_AFTER_UPLOAD_STORAGE_KEY = 'reloadAfterUpload'

export const RELOAD_AFTER_UPLOAD_BY_USER_STORAGE_KEY = 'reloadAfterUploadByUser'

type ReloadAfterUploadByUser = Record<string, boolean>

const isReloadAfterUploadByUser = (value: unknown): value is ReloadAfterUploadByUser => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every((entry) => typeof entry === 'boolean')
}

const readReloadAfterUploadByUser = async (): Promise<ReloadAfterUploadByUser> => {
  const stored = await browser.storage.local.get(RELOAD_AFTER_UPLOAD_BY_USER_STORAGE_KEY)
  const value = stored[RELOAD_AFTER_UPLOAD_BY_USER_STORAGE_KEY]
  return isReloadAfterUploadByUser(value) ? value : {}
}

const writeReloadAfterUploadByUser = async (settings: ReloadAfterUploadByUser): Promise<void> => {
  await browser.storage.local.set({ [RELOAD_AFTER_UPLOAD_BY_USER_STORAGE_KEY]: settings })
}

const migrateLegacyReloadAfterUpload = async (userId: string): Promise<boolean | null> => {
  const legacy = await browser.storage.local.get(LEGACY_RELOAD_AFTER_UPLOAD_STORAGE_KEY)
  if (legacy[LEGACY_RELOAD_AFTER_UPLOAD_STORAGE_KEY] !== true) return null

  await setStoredReloadAfterUpload(userId, true)
  await browser.storage.local.remove(LEGACY_RELOAD_AFTER_UPLOAD_STORAGE_KEY)
  return true
}

export const getStoredReloadAfterUpload = async (userId: string): Promise<boolean> => {
  const normalizedUserId = userId.trim()
  if (!normalizedUserId) return false

  const settings = await readReloadAfterUploadByUser()
  return (
    settings[normalizedUserId] ?? (await migrateLegacyReloadAfterUpload(normalizedUserId)) ?? false
  )
}

export const setStoredReloadAfterUpload = async (
  userId: string,
  enabled: boolean,
): Promise<void> => {
  const normalizedUserId = userId.trim()
  if (!normalizedUserId) return

  const settings = await readReloadAfterUploadByUser()
  await writeReloadAfterUploadByUser({ ...settings, [normalizedUserId]: enabled })
}

export const resolveReloadAfterUploadPreference = async (): Promise<boolean> => {
  const auth = await getStoredAuth()
  const userId = auth?.user?.id?.trim()
  if (!userId) return false
  return getStoredReloadAfterUpload(userId)
}

export const triggerEditorReloadIfNeeded = async ({
  reloadAfterUpload,
  uploadOk,
}: {
  reloadAfterUpload: boolean
  uploadOk: boolean | undefined
}): Promise<void> => {
  if (!reloadAfterUpload || uploadOk !== true) return

  try {
    const response = (await browser.runtime.sendMessage({
      action: RELOAD_EDITOR_PAGE_ACTION,
    })) as { ok?: boolean } | undefined

    if (response?.ok !== true) {
      console.warn('[nmap_uploader] editor page reload failed: no map tabs found')
    }
  } catch (error: unknown) {
    console.warn('[nmap_uploader] editor page reload failed:', error)
  }
}

export const reloadEditorPage = async (): Promise<void> => {
  await triggerEditorReloadIfNeeded({ reloadAfterUpload: true, uploadOk: true })
}
