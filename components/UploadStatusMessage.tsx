import type { UploadStatus } from '@/lib/upload_logs';
import { getUploadStatusClassName } from '@/lib/upload_status_ui';

type UploadStatusMessageProps = {
  status: UploadStatus;
};

export const UploadStatusMessage = ({ status }: UploadStatusMessageProps) => (
  <p className={getUploadStatusClassName(status.level)} aria-live="polite">
    {status.message}
  </p>
);
