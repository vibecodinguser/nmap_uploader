import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'vitest'
import { createNmapOutputTemplate, type ProcessResult } from '@/lib/nmap_index'
import { type UploadLogEntry, uploadProcessedFilesToYandexDisk } from '@/lib/upload_service'
import { clearAuth, saveAuth } from '@/lib/yandex/client'

function createProcessResult(): ProcessResult {
  return {
    ...createNmapOutputTemplate(),
    metadata: [],
  }
}

function isUploadCompleteLog(log: UploadLogEntry): boolean {
  return log.message === 'Завершено: файл загружен'
}

function isAuthRefreshLog(log: UploadLogEntry): boolean {
  return log.message.includes('Выйдите и войдите')
}

function isDiskAccessErrorLog(log: UploadLogEntry): boolean {
  return log.message === 'Ошибка доступа к Диску'
}

async function saveDefaultAuth(): Promise<void> {
  await saveAuth({
    token: 'test-token',
    user: { id: '123', login: 'testuser' },
  })
}

async function uploadsSingleFileSuccessfully(): Promise<void> {
  const result = await uploadProcessedFilesToYandexDisk({
    files: [{ name: 'test.geojson', result: createProcessResult() }],
  })

  assert.equal(result.ok, true)
  assert.equal(result.processedCount, 1)

  const successLog = result.logs.find(isUploadCompleteLog)
  assert.notEqual(successLog, undefined)
}

async function returnsErrorWhenNoFiles(): Promise<void> {
  const result = await uploadProcessedFilesToYandexDisk({ files: [] })

  assert.equal(result.ok, false)

  const logs = result.logs
  const lastLog = logs[logs.length - 1]
  assert.ok(lastLog !== undefined)
  assert.equal(lastLog.message, 'Нет данных для загрузки')
}

async function returnsErrorWhenNotAuthenticated(): Promise<void> {
  await clearAuth()

  const result = await uploadProcessedFilesToYandexDisk({
    files: [{ name: 'test.geojson', result: createProcessResult() }],
  })

  assert.equal(result.ok, false)

  const logs = result.logs
  const lastLog = logs[logs.length - 1]
  assert.ok(lastLog !== undefined)
  assert.equal(lastLog.message, 'Необходима авторизация. Войдите через Яндекс ID')
}

async function expiredTokenError(): Promise<void> {
  await saveAuth({
    token: 'expired-token',
    user: { id: '1', login: 'expired' },
  })

  const result = await uploadProcessedFilesToYandexDisk({
    files: [{ name: 'test.geojson', result: createProcessResult() }],
  })

  assert.equal(result.ok, false)

  const authErrorLog = result.logs.find(isAuthRefreshLog)
  assert.notEqual(authErrorLog, undefined)

  const diskAccessErrorLog = result.logs.find(isDiskAccessErrorLog)
  assert.equal(diskAccessErrorLog, undefined)
}

function diskUploadTests(): void {
  beforeEach(saveDefaultAuth)

  it('полный happy-path для одного файла', uploadsSingleFileSuccessfully)
  it('без файлов возвращает ошибку', returnsErrorWhenNoFiles)
  it('без авторизации возвращает ошибку', returnsErrorWhenNotAuthenticated)
  it('при недействительном токене возвращает конкретную ошибку доступа', expiredTokenError)
}

describe('uploadProcessedFilesToYandexDisk', diskUploadTests)
