import assert from 'node:assert/strict';
import { HttpResponse, http } from 'msw';
import { describe, it } from 'vitest';
import { createNmapOutputTemplate } from '@/lib/nmap_index';
import {
  downloadIndexJson,
  ensureStorageFolders,
  listExistingDateFolders,
  resolveFolderPath,
  uploadIndexJson,
  verifyDiskAccess,
  YANDEX_DISK_FOLDER,
} from '@/lib/yandex/client';
import { server } from '@/tests/setup/vitest.setup';
import {
  getCreatedPaths,
  seedIndexJson,
  simulateParentNotFoundOnPut,
} from '@/tests/setup/yandex_handlers';

const DISK_API = 'https://cloud-api.yandex.net/v1/disk';
const token = 'test-token';
const baseFolderPath = `/${YANDEX_DISK_FOLDER}`;
const targetDate = '2026-05-24';
const testLongitude = 37.6;
const testLatitude = 55.7;
const testCoords: [number, number] = [testLongitude, testLatitude];

function isDateFolderPath(path: string): boolean {
  return path.startsWith(`${baseFolderPath}/`);
}

function respondWithEvilUploadHref() {
  return HttpResponse.json({ href: 'https://evil.com/upload' });
}

function respondWithEvilDownloadHref() {
  return HttpResponse.json({ href: 'https://evil.com/download' });
}

const evilUploadHandler = http.get(`${DISK_API}/resources/upload`, respondWithEvilUploadHref);
const evilDownloadHandler = http.get(`${DISK_API}/resources/download`, respondWithEvilDownloadHref);

function assertPathCreated(paths: string[], path: string): void {
  const exists = paths.includes(path);
  assert.ok(exists);
}

function assertHasDateFolder(paths: string[]): void {
  const hasDateFolder = paths.some(isDateFolderPath);
  assert.ok(hasDateFolder);
}

async function callExpiredToken(): Promise<void> {
  await verifyDiskAccess({ token: 'expired-token' });
}

async function uploadDefaultData(): Promise<void> {
  const data = createNmapOutputTemplate();
  await uploadIndexJson({ token, data, targetDate });
}

async function downloadDefaultDate(): Promise<void> {
  await downloadIndexJson({ token, targetDate });
}

async function accessOk(): Promise<void> {
  await verifyDiskAccess({ token });
}

async function expiredTokenError(): Promise<void> {
  await assert.rejects(callExpiredToken, {
    message: /Выйдите и войдите/,
  });
}

async function foldersCreatePaths(): Promise<void> {
  await ensureStorageFolders({ token });

  const createdPaths = getCreatedPaths();
  assertPathCreated(createdPaths, '/Приложения');
  assertPathCreated(createdPaths, baseFolderPath);
  assertHasDateFolder(createdPaths);
}

async function foldersIdempotent(): Promise<void> {
  await ensureStorageFolders({ token });
  const pathsAfterFirstCall = getCreatedPaths();

  await ensureStorageFolders({ token });

  const pathsAfterSecondCall = getCreatedPaths();
  assert.deepEqual(pathsAfterSecondCall, pathsAfterFirstCall);
}

async function foldersParentNotFound(): Promise<void> {
  simulateParentNotFoundOnPut(baseFolderPath);

  await ensureStorageFolders({ token });

  const createdPaths = getCreatedPaths();
  assertPathCreated(createdPaths, '/Приложения');
  assertPathCreated(createdPaths, baseFolderPath);
}

function resolveFolderDate(): void {
  const folderPath = resolveFolderPath({ targetDate });
  const expectedPath = `${YANDEX_DISK_FOLDER}/${targetDate}`;
  assert.equal(folderPath, expectedPath);
}

async function listDatesEmpty(): Promise<void> {
  const result = await listExistingDateFolders({ token });
  assert.deepEqual(result, []);
}

async function listDatesExisting(): Promise<void> {
  const data = createNmapOutputTemplate();
  await uploadIndexJson({ token, data, targetDate });
  await uploadIndexJson({ token, data, targetDate: '2026-06-01' });

  const result = await listExistingDateFolders({ token });
  assert.deepEqual(result, ['2026-05-24', '2026-06-01']);
}

async function downloadNull(): Promise<void> {
  const result = await downloadIndexJson({ token, targetDate });
  assert.equal(result, null);
}

async function downloadExisting(): Promise<void> {
  const existing = createNmapOutputTemplate();
  existing.points.point1 = { coords: testCoords, desc: 'test' };
  seedIndexJson(existing);

  const result = await downloadIndexJson({ token, targetDate });

  assert.deepEqual(result, existing);
}

async function uploadIndex(): Promise<void> {
  const data = createNmapOutputTemplate();
  data.paths.path1 = [testCoords];

  await uploadIndexJson({ token, data, targetDate });

  const downloaded = await downloadIndexJson({ token, targetDate });
  assert.deepEqual(downloaded, data);
}

async function rejectEvilUpload(): Promise<void> {
  server.use(evilUploadHandler);

  await assert.rejects(uploadDefaultData, {
    message: /Недопустимый URL/,
  });
}

async function rejectEvilDownload(): Promise<void> {
  const seed = createNmapOutputTemplate();
  seedIndexJson(seed);
  server.use(evilDownloadHandler);

  await assert.rejects(downloadDefaultDate, {
    message: /Недопустимый URL/,
  });
}

function yandexDiskTests(): void {
  it('verifyDiskAccess: успешная проверка токена', accessOk);
  it('verifyDiskAccess: 401 для просроченного токена', expiredTokenError);
  it('ensureStorageFolders: создаёт «Приложения», базовую и дневную папки', foldersCreatePaths);
  it('ensureStorageFolders: идемпотентен при повторном вызове', foldersIdempotent);
  it(
    'ensureStorageFolders: при 409 DiskPathDoesntExistsError создаёт родителя и повторяет',
    foldersParentNotFound,
  );
  it('resolveFolderPath: добавляет дату в путь', resolveFolderDate);
  it('listExistingDateFolders: возвращает пустой список, если папок с датами нет', listDatesEmpty);
  it('listExistingDateFolders: возвращает даты существующих папок', listDatesExisting);
  it('downloadIndexJson: возвращает null, если index.json отсутствует', downloadNull);
  it('downloadIndexJson: скачивает существующий index.json', downloadExisting);
  it('uploadIndexJson: загружает index.json на Диск', uploadIndex);
  it('uploadIndexJson: отклоняет подменённый href вне доменов Яндекс.Диска', rejectEvilUpload);
  it('downloadIndexJson: отклоняет подменённый href вне доменов Яндекс.Диска', rejectEvilDownload);
}

describe('Yandex Disk', yandexDiskTests);
