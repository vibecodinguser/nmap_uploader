import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import { useTranslate } from '@/hooks/useLocale'
import { normalizeDisplayTargetDate } from '@/lib/date_format'
import type { TranslateFn } from '@/lib/i18n'
import { invalidateOccupiedDatesCache } from '@/lib/occupied_dates_cache'
import { areCoordinatesValid, createGeometryIndex } from '@/lib/point_uploader'
import {
  resolveReloadAfterUploadPreference,
  triggerEditorReloadIfNeeded,
} from '@/lib/reload_after_upload'
import {
  buildExpiredSessionLogs,
  ensureUploadAuth,
  hasUploadAuthError,
  prepareUploadLocale,
} from '@/lib/upload_auth_flow'
import { createUploadLog, deriveUploadStatus, type UploadStatus } from '@/lib/upload_logs'
import type { UploadLogEntry } from '@/lib/upload_service'
import { beginUploadSession, endUploadSession } from '@/lib/upload_session'

export type PointUploadStatus = UploadStatus

export type ManualPointInput = {
  description: string
  coords: number[][]
  geomType: string
  date: string
  note_time?: string
  note_desc?: string
}

type UploadingRef = { current: boolean }

type NullableUploadStatusSetter = Dispatch<SetStateAction<UploadStatus | null>>

type ApplyPointUploadLogsParams = {
  priorLogs: UploadLogEntry[]
  uploadLogs: UploadLogEntry[]
  setUploadStatus: NullableUploadStatusSetter
}

type UploadPointDataParams = {
  files: Array<{ name: string; result: ReturnType<typeof createGeometryIndex> }>
  targetDate?: string
}

type PointUploadExecuteResult = {
  priorLogs: UploadLogEntry[]
  uploadLogs: UploadLogEntry[]
  uploadOk: boolean | undefined
} | null

type RunPointUploadParams = {
  defaultErrorMessage: string
  execute: (reloadAfterUpload: boolean) => Promise<PointUploadExecuteResult>
  onAuthenticated?: () => void
  isUploadingRef: UploadingRef
  setIsUploading: Dispatch<SetStateAction<boolean>>
  setUploadStatus: NullableUploadStatusSetter
}

type ManualPointUploadParams = ManualPointInput & {
  t: TranslateFn
  runPointUpload: (
    params: Pick<RunPointUploadParams, 'defaultErrorMessage' | 'execute'>,
  ) => Promise<void>
  setUploadStatus: NullableUploadStatusSetter
}

type ManualPointUploadExecutionParams = {
  coords: number[][]
  geomType: string
  description: string
  targetDate: string | undefined
  note_time?: string
  note_desc?: string
  t: TranslateFn
}

const normalizeTargetDate = normalizeDisplayTargetDate

function _appendUploadLog(
  logs: UploadLogEntry[],
  level: UploadLogEntry['level'],
  message: string,
): void {
  const entry = createUploadLog(level, message)
  logs.push(entry)
}

function getUploadErrorMessage(error: unknown, defaultErrorMessage: string): string {
  let message = defaultErrorMessage
  if (error instanceof Error) {
    message = error.message
  }
  return message
}

async function uploadPointData({ files, targetDate }: UploadPointDataParams) {
  return (await browser.runtime.sendMessage({
    action: 'uploadProcessedFiles',
    files,
    targetDate,
  })) as { logs?: UploadLogEntry[]; ok?: boolean }
}

async function applyPointUploadLogs({
  priorLogs,
  uploadLogs,
  setUploadStatus,
}: ApplyPointUploadLogsParams) {
  let logs: UploadLogEntry[]
  if (hasUploadAuthError(uploadLogs)) {
    logs = await buildExpiredSessionLogs({ priorLogs, uploadLogs })
  } else {
    logs = [...priorLogs, ...uploadLogs]
  }
  const status = deriveUploadStatus(logs)
  setUploadStatus(status)
}

function resolveUploadTargetDate(
  date: string,
  t: TranslateFn,
  setUploadStatus: NullableUploadStatusSetter,
): string | undefined {
  let targetDate: string | undefined
  try {
    targetDate = normalizeTargetDate(date)
  } catch {
    const invalidDateMessage = t('common.invalidDateFormat')
    setUploadStatus({ level: 'error', message: invalidDateMessage })
    targetDate = undefined
  }
  return targetDate
}

function _parseCoordinate(value: string): number {
  const trimmed = value.trim()
  return Number.parseFloat(trimmed)
}

function createBeginUploadHandler({
  setIsUploading,
  setUploadStatus,
}: Pick<RunPointUploadParams, 'setIsUploading' | 'setUploadStatus'>) {
  return function handleBeginUpload() {
    setIsUploading(true)
    setUploadStatus(null)
  }
}

function createFinishUploadHandler({
  setIsUploading,
}: Pick<RunPointUploadParams, 'setIsUploading'>) {
  return function handleEndUpload() {
    setIsUploading(false)
  }
}

async function executeManualPointUpload({
  coords,
  geomType,
  description,
  targetDate,
  note_time,
  note_desc,
  t,
}: ManualPointUploadExecutionParams): Promise<PointUploadExecuteResult> {
  const preparingMessage = t('points.preparingPoint')
  const priorLogs = [createUploadLog('info', preparingMessage)]
  const trimmedDescription = description.trim()
  const pointData = createGeometryIndex({
    coords,
    geomType,
    description: trimmedDescription,
    note_time,
    note_desc,
  })
  const response = await uploadPointData({
    files: [{ name: 'manual-point', result: pointData }],
    targetDate,
  })

  return {
    priorLogs,
    uploadLogs: response.logs ?? [],
    uploadOk: response.ok,
  }
}

function bindManualPointUploadExecutor(params: ManualPointUploadExecutionParams) {
  return async function executeManualPointUploadBound(
    _reloadAfterUpload: boolean,
  ): Promise<PointUploadExecuteResult> {
    return executeManualPointUpload(params)
  }
}

async function runPointUpload({
  defaultErrorMessage,
  execute,
  onAuthenticated,
  isUploadingRef,
  setIsUploading,
  setUploadStatus,
}: RunPointUploadParams) {
  await prepareUploadLocale()

  const onBegin = createBeginUploadHandler({ setIsUploading, setUploadStatus })
  const started = await beginUploadSession({ isUploadingRef, onBegin })
  if (started) {
    try {
      const auth = await ensureUploadAuth({ onAuthenticated })
      if (auth.ok) {
        const reloadAfterUpload = await resolveReloadAfterUploadPreference()
        const result = await execute(reloadAfterUpload)
        if (result) {
          await applyPointUploadLogs({
            priorLogs: result.priorLogs,
            uploadLogs: result.uploadLogs,
            setUploadStatus,
          })
          if (result.uploadOk) {
            invalidateOccupiedDatesCache()
          }
          await triggerEditorReloadIfNeeded({
            reloadAfterUpload,
            uploadOk: result.uploadOk,
          })
        }
      } else {
        setUploadStatus({ level: 'error', message: auth.message })
      }
    } catch (error) {
      const message = getUploadErrorMessage(error, defaultErrorMessage)
      setUploadStatus({ level: 'error', message })
    } finally {
      const onEnd = createFinishUploadHandler({ setIsUploading })
      endUploadSession({ isUploadingRef, onEnd })
    }
  }
}

async function performManualPointUpload({
  description,
  coords,
  geomType,
  date,
  note_time,
  note_desc,
  t,
  runPointUpload: runUpload,
  setUploadStatus,
}: ManualPointUploadParams) {
  if (!Array.isArray(coords) || coords.length === 0) {
    const coordinatesMissingMessage = t('points.coordinatesMissing')
    setUploadStatus({ level: 'error', message: coordinatesMissingMessage })
  } else if (!coords.every((c) => areCoordinatesValid({ latitude: c[1], longitude: c[0] }))) {
    const outOfRangeMessage = t('points.coordinatesOutOfRange')
    setUploadStatus({ level: 'error', message: outOfRangeMessage })
  } else {
    const targetDate = resolveUploadTargetDate(date, t, setUploadStatus)
    if (targetDate !== undefined) {
      const defaultErrorMessage = t('points.pointUploadError')
      const execute = bindManualPointUploadExecutor({
        coords,
        geomType,
        description,
        note_time,
        note_desc,
        targetDate,
        t,
      })
      await runUpload({ defaultErrorMessage, execute })
    }
  }
}

export const usePointUpload = ({ onAuthenticated }: { onAuthenticated?: () => void }) => {
  const t = useTranslate()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<PointUploadStatus | null>(null)
  const isUploadingRef = useRef(false)

  const boundRunPointUpload = useCallback(
    function boundRunPointUpload(
      params: Pick<RunPointUploadParams, 'defaultErrorMessage' | 'execute'>,
    ) {
      return runPointUpload({
        ...params,
        onAuthenticated,
        isUploadingRef,
        setIsUploading,
        setUploadStatus,
      })
    },
    [onAuthenticated],
  )

  const boundPerformManualUpload = useCallback(
    function boundPerformManualUpload(input: ManualPointInput) {
      return performManualPointUpload({
        ...input,
        t,
        runPointUpload: boundRunPointUpload,
        setUploadStatus,
      })
    },
    [boundRunPointUpload, t],
  )

  return {
    isUploading,
    uploadStatus,
    performManualUpload: boundPerformManualUpload,
  }
}
