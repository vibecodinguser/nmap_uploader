import { type ChangeEvent, type SubmitEvent, useCallback, useState } from 'react';
import { ManualPointUpload } from '@/components/ManualPointUpload';
import { useTranslate } from '@/hooks/useLocale';
import { requireAuthBeforeAction } from '@/lib/require_auth';

type ManualTabProps = {
  isUploading: boolean;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
  onManualUpload: (input: {
    description: string;
    latitude: string;
    longitude: string;
    date: string;
  }) => void;
};

export function ManualTab({
  isUploading,
  isLoggedIn,
  onRequireAuth,
  onManualUpload,
}: ManualTabProps) {
  const t = useTranslate();
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [manualDate, setManualDate] = useState('');

  const isManualSubmitDisabled = isUploading || !latitude.trim() || !longitude.trim();

  let manualSubmitButtonText;
  if (isUploading) {
    manualSubmitButtonText = t('common.sending');
  } else {
    manualSubmitButtonText = t('common.upload');
  }

  const handleDescriptionChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(event.currentTarget.value);
  }, []);

  const handleLatitudeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setLatitude(event.target.value);
  }, []);

  const handleLongitudeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setLongitude(event.target.value);
  }, []);

  const handleManualSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!isManualSubmitDisabled && requireAuthBeforeAction({ isLoggedIn, onRequireAuth })) {
        onManualUpload({
          description,
          latitude,
          longitude,
          date: manualDate,
        });
      }
    },
    [
      isManualSubmitDisabled,
      isLoggedIn,
      onRequireAuth,
      onManualUpload,
      description,
      latitude,
      longitude,
      manualDate,
    ],
  );

  return (
    <ManualPointUpload
      isUploading={isUploading}
      description={description}
      latitude={latitude}
      longitude={longitude}
      manualDate={manualDate}
      isManualSubmitDisabled={isManualSubmitDisabled}
      manualSubmitButtonText={manualSubmitButtonText}
      manualHint={t('points.manualHint')}
      latitudeLabel={t('points.latitude')}
      longitudeLabel={t('points.longitude')}
      descriptionPlaceholder={t('points.descriptionPlaceholder')}
      descriptionAriaLabel={t('points.descriptionAria')}
      sectionAriaLabel={t('points.manualSectionAria')}
      onDescriptionChange={handleDescriptionChange}
      onLatitudeChange={handleLatitudeChange}
      onLongitudeChange={handleLongitudeChange}
      onManualDateChange={setManualDate}
      onManualSubmit={handleManualSubmit}
    />
  );
}
