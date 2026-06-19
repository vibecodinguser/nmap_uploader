import { type ReactNode, useMemo, useState } from 'react';
import { BatchTab } from '@/components/BatchTab';
import { ManualTab } from '@/components/ManualTab';
import { TabBar } from '@/components/TabBar';
import { UploadStatusMessage } from '@/components/UploadStatusMessage';
import { useLocale, useTranslate } from '@/hooks/useLocale';
import type { PointUploadStatus } from '@/hooks/usePointUpload';

type PointSubTab = 'manual' | 'list';

type PointsTabProps = {
  isUploading: boolean;
  uploadStatus: PointUploadStatus | null;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
  onManualUpload: (input: {
    description: string;
    latitude: string;
    longitude: string;
    date: string;
  }) => void;
  onMultipointUpload: (input: { files: File[]; date: string }) => void;
};

export const PointsTab = function pointsTab({
  isUploading,
  uploadStatus,
  isLoggedIn,
  onRequireAuth,
  onManualUpload,
  onMultipointUpload,
}: PointsTabProps) {
  const t = useTranslate();
  const { locale } = useLocale();
  const [activeSubTab, setActiveSubTab] = useState<PointSubTab>('manual');

  const pointSubTabs = useMemo(
    function buildPointSubTabs() {
      return [
        { id: 'manual' as const, label: t('points.manualEntry') },
        { id: 'list' as const, label: t('points.batchUpload') },
      ];
    },
    [t],
  );

  let subTabContent: ReactNode;
  if (activeSubTab === 'manual') {
    subTabContent = (
      <ManualTab
        isUploading={isUploading}
        isLoggedIn={isLoggedIn}
        onRequireAuth={onRequireAuth}
        onManualUpload={onManualUpload}
      />
    );
  } else {
    subTabContent = (
      <BatchTab
        isUploading={isUploading}
        isLoggedIn={isLoggedIn}
        onRequireAuth={onRequireAuth}
        onMultipointUpload={onMultipointUpload}
      />
    );
  }

  let uploadStatusContent: ReactNode = null;
  if (uploadStatus) {
    uploadStatusContent = <UploadStatusMessage status={uploadStatus} />;
  }

  return (
    <div className="tab-panel points-tab" key={locale}>
      <TabBar
        tabs={pointSubTabs}
        activeId={activeSubTab}
        onChange={setActiveSubTab}
        ariaLabel={t('points.modeAria')}
        className="tabs point-tabs"
      />

      {subTabContent}
      {uploadStatusContent}
    </div>
  );
};
