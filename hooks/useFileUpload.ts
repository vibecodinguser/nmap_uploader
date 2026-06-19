import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { useTranslate } from '@/hooks/useLocale';
import { processFile } from '@/lib/converters';
import { normalizeDisplayTargetDate } from '@/lib/date_format';
import { ProcessingError } from '@/lib/errors';
import { isAllowedFile } from '@/lib/formats';
import type { TranslateFn } from '@/lib/i18n';
import { invalidateOccupiedDatesCache } from '@/lib/occupied_dates_cache';
import {
  resolveReloadAfterUploadPreference,
  triggerEditorReloadIfNeeded,
} from '@/lib/reload_after_upload';
import {
  buildExpiredSessionLogs,
  ensureUploadAuth,
  hasUploadAuthError,
  prepareUploadLocale,
} from '@/lib/upload_auth_flow';
import { createUploadLog, deriveUploadStatus, type UploadStatus } from '@/lib/upload_logs';
import type { ProcessedFileInput, UploadLogEntry } from '@/lib/upload_service';
import { beginUploadSession, endUploadSession } from '@/lib/upload_session';

export type { UploadStatus } from '@/lib/upload_logs';

const normalizeTargetDate = normalizeDisplayTargetDate;

const UPLOAD_PROGRESS = {
  reset: 0,
  authStart: 5,
  conversionStart: 15,
  conversionEnd: 80,
  uploadStart: 85,
  complete: 100,
} as const;

type UploadingRef = { current: boolean };

type ProgressHandler = Dispatch<SetStateAction<number>>;

type NullableUploadStatusSetter = Dispatch<SetStateAction<UploadStatus | null>>;

type BooleanSetter = Dispatch<SetStateAction<boolean>>;

type NumberSetter = Dispatch<SetStateAction<number>>;

type UploadProcessedFileParams = {
  processed: ProcessedFileInput;
  targetDate?: string;
};

type ApplyFileUploadLogsParams = {
  priorLogs: UploadLogEntry[];
  uploadLogs: UploadLogEntry[];
  setUploadStatus: NullableUploadStatusSetter;
};

type SendConvertedFileParams = {
  processed: ProcessedFileInput;
  targetDate: string | undefined;
  conversionLogs: UploadLogEntry[];
  setProgress: NumberSetter;
  setUploadStatus: NullableUploadStatusSetter;
};

type AuthenticatedUploadParams = {
  file: File;
  targetDate: string | undefined;
  t: TranslateFn;
  onAuthenticated?(): void;
  setProgress: NumberSetter;
  setUploadStatus: NullableUploadStatusSetter;
};

type UseFileUploadOptions = {
  onAuthenticated?(): void;
};

type PerformUploadInput = {
  file: File;
  date: string;
};

type FileUploadSessionParams = {
  file: File;
  date: string;
  t: TranslateFn;
  onAuthenticated?(): void;
  isUploadingRef: UploadingRef;
  setIsUploading: BooleanSetter;
  setProgress: NumberSetter;
  setUploadStatus: NullableUploadStatusSetter;
};

function appendUploadLog(
  logs: UploadLogEntry[],
  level: UploadLogEntry['level'],
  message: string,
): void {
  const entry = createUploadLog(level, message);
  logs.push(entry);
}

function getConversionErrorMessage(error: unknown, t: TranslateFn): string {
  let message = t('common.unknownError');
  if (error instanceof ProcessingError) {
    message = error.message;
  }
  return message;
}

function getUploadErrorMessage(error: unknown, t: TranslateFn): string {
  let message = t('upload.uploadError');
  if (error instanceof Error) {
    message = error.message;
  }
  return message;
}

/** Конвертирует один файл в JSON-результат — без передачи бинарных данных в background. */
async function convertFileLocally(file: File, onProgress: ProgressHandler, t: TranslateFn) {
  const logs: UploadLogEntry[] = [];
  const conversionEnd = UPLOAD_PROGRESS.conversionEnd;
  let processed: ProcessedFileInput | null = null;

  if (isAllowedFile(file.name)) {
    const processingMessage = t('upload.processing', { file: file.name });
    appendUploadLog(logs, 'info', processingMessage);
    try {
      const buffer = await file.arrayBuffer();
      const result = await processFile({ name: file.name, buffer });
      const convertedMessage = t('upload.converted', { file: file.name });
      appendUploadLog(logs, 'success', `✓ ${convertedMessage}`);
      processed = { name: file.name, result };
    } catch (error) {
      const message = getConversionErrorMessage(error, t);
      appendUploadLog(logs, 'error', `✗ ${file.name}: ${message}`);
    }
  } else {
    const unsupportedMessage = t('upload.unsupportedFormat', { file: file.name });
    appendUploadLog(logs, 'error', `✗ ${unsupportedMessage}`);
  }

  onProgress(conversionEnd);
  return { processed, logs };
}

async function uploadProcessedFile({ processed, targetDate }: UploadProcessedFileParams) {
  return (await browser.runtime.sendMessage({
    action: 'uploadProcessedFiles',
    files: [processed],
    targetDate,
  })) as { logs?: UploadLogEntry[]; ok?: boolean };
}

async function applyFileUploadLogs({
  priorLogs,
  uploadLogs,
  setUploadStatus,
}: ApplyFileUploadLogsParams) {
  let logs: UploadLogEntry[];
  if (hasUploadAuthError(uploadLogs)) {
    logs = await buildExpiredSessionLogs({ priorLogs, uploadLogs });
  } else {
    logs = [...priorLogs, ...uploadLogs];
  }
  const status = deriveUploadStatus(logs);
  setUploadStatus(status);
}

function resolveUploadTargetDate(
  date: string,
  t: TranslateFn,
  setUploadStatus: NullableUploadStatusSetter,
): string | undefined {
  let targetDate: string | undefined;
  try {
    targetDate = normalizeTargetDate(date);
  } catch {
    setUploadStatus({ level: 'error', message: t('common.invalidDateFormat') });
    targetDate = undefined;
  }
  return targetDate;
}

function createBeginUploadHandler({
  setIsUploading,
  setProgress,
  setUploadStatus,
}: Pick<FileUploadSessionParams, 'setIsUploading' | 'setProgress' | 'setUploadStatus'>) {
  return function handleBeginUpload() {
    setIsUploading(true);
    setProgress(UPLOAD_PROGRESS.reset);
    setUploadStatus(null);
  };
}

function createFinishUploadHandler({
  setIsUploading,
}: Pick<FileUploadSessionParams, 'setIsUploading'>) {
  return function handleEndUpload() {
    setIsUploading(false);
  };
}

async function sendConvertedFile({
  processed,
  targetDate,
  conversionLogs,
  setProgress,
  setUploadStatus,
}: SendConvertedFileParams) {
  setProgress(UPLOAD_PROGRESS.uploadStart);
  const reloadAfterUpload = await resolveReloadAfterUploadPreference();
  const response = await uploadProcessedFile({ processed, targetDate });
  const uploadLogs = response.logs ?? [];

  setProgress(UPLOAD_PROGRESS.complete);
  await applyFileUploadLogs({
    priorLogs: conversionLogs,
    uploadLogs,
    setUploadStatus,
  });

  if (response.ok) {
    invalidateOccupiedDatesCache();
  }
  await triggerEditorReloadIfNeeded({ reloadAfterUpload, uploadOk: response.ok });
}

async function executeAuthenticatedFileUpload({
  file,
  targetDate,
  t,
  onAuthenticated,
  setProgress,
  setUploadStatus,
}: AuthenticatedUploadParams) {
  setProgress(UPLOAD_PROGRESS.authStart);
  const auth = await ensureUploadAuth({ onAuthenticated });
  if (auth.ok) {
    setProgress(UPLOAD_PROGRESS.conversionStart);
    const { processed, logs: conversionLogs } = await convertFileLocally(file, setProgress, t);
    if (processed) {
      await sendConvertedFile({
        processed,
        targetDate,
        conversionLogs,
        setProgress,
        setUploadStatus,
      });
    } else {
      setProgress(UPLOAD_PROGRESS.complete);
      const status = deriveUploadStatus(conversionLogs);
      setUploadStatus(status);
    }
  } else {
    setProgress(UPLOAD_PROGRESS.complete);
    setUploadStatus({ level: 'error', message: auth.message });
  }
}

async function runFileUpload({
  file,
  date,
  t,
  onAuthenticated,
  isUploadingRef,
  setIsUploading,
  setProgress,
  setUploadStatus,
}: FileUploadSessionParams) {
  await prepareUploadLocale();

  const targetDate = resolveUploadTargetDate(date, t, setUploadStatus);
  if (targetDate !== undefined) {
    const onBegin = createBeginUploadHandler({ setIsUploading, setProgress, setUploadStatus });
    const started = await beginUploadSession({ isUploadingRef, onBegin });
    if (started) {
      try {
        await executeAuthenticatedFileUpload({
          file,
          targetDate,
          t,
          onAuthenticated,
          setProgress,
          setUploadStatus,
        });
      } catch (error) {
        setProgress(UPLOAD_PROGRESS.complete);
        setUploadStatus({
          level: 'error',
          message: getUploadErrorMessage(error, t),
        });
      } finally {
        const onEnd = createFinishUploadHandler({ setIsUploading });
        endUploadSession({ isUploadingRef, onEnd });
      }
    }
  }
}

function performUpload({
  file,
  date,
  t,
  onAuthenticated,
  isUploadingRef,
  setIsUploading,
  setProgress,
  setUploadStatus,
}: FileUploadSessionParams) {
  return runFileUpload({
    file,
    date,
    t,
    onAuthenticated,
    isUploadingRef,
    setIsUploading,
    setProgress,
    setUploadStatus,
  });
}

export function useFileUpload({ onAuthenticated }: UseFileUploadOptions) {
  const t = useTranslate();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const isUploadingRef = useRef(false);

  const boundPerformUpload = useCallback(
    function boundPerformUpload({ file, date }: PerformUploadInput) {
      return performUpload({
        file,
        date,
        t,
        onAuthenticated,
        isUploadingRef,
        setIsUploading,
        setProgress,
        setUploadStatus,
      });
    },
    [onAuthenticated, t],
  );

  return {
    isUploading,
    progress,
    uploadStatus,
    performUpload: boundPerformUpload,
  };
}
