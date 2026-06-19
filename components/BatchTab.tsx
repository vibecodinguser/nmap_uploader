import { type ChangeEvent, type RefObject, useCallback, useRef, useState } from 'react';
import { MultipointUpload } from '@/components/MultipointUpload';
import { useTranslate } from '@/hooks/useLocale';
import { requireAuthBeforeAction } from '@/lib/require_auth';

type BatchTabProps = {
  isUploading: boolean;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
  onMultipointUpload: (input: { files: File[]; date: string }) => void;
};

export function BatchTab({
  isUploading,
  isLoggedIn,
  onRequireAuth,
  onMultipointUpload,
}: BatchTabProps) {
  const t = useTranslate();
  const [listDate, setListDate] = useState('');
  const multipointInputRef = useRef<HTMLInputElement>(null);

  let multipointButtonText;
  if (isUploading) {
    multipointButtonText = t('common.uploading');
  } else {
    multipointButtonText = t('common.upload');
  }

  const handleMultipointPick = useCallback(() => {
    if (requireAuthBeforeAction({ isLoggedIn, onRequireAuth })) {
      multipointInputRef.current?.click();
    }
  }, [isLoggedIn, onRequireAuth]);

  const handleMultipointChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      event.target.value = '';
      if (selectedFiles.length > 0) {
        onMultipointUpload({ files: selectedFiles, date: listDate });
      }
    },
    [listDate, onMultipointUpload],
  );

  return (
    <MultipointUpload
      isUploading={isUploading}
      listDate={listDate}
      multipointButtonText={multipointButtonText}
      batchHint={t('points.batchHint')}
      sectionAriaLabel={t('points.batchSectionAria')}
      multipointInputRef={multipointInputRef as RefObject<HTMLInputElement>}
      onListDateChange={setListDate}
      onMultipointPick={handleMultipointPick}
      onMultipointChange={handleMultipointChange}
    />
  );
}
