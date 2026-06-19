import type { ChangeEvent, Ref } from 'react';
import { PointDateField } from '@/components/PointDateField';

type MultipointUploadProps = {
  isUploading: boolean;
  listDate: string;
  multipointButtonText: string;
  batchHint: string;
  sectionAriaLabel: string;
  multipointInputRef: Ref<HTMLInputElement>;
  onListDateChange: (date: string) => void;
  onMultipointPick: () => void;
  onMultipointChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function multipointUpload({
  isUploading,
  listDate,
  multipointButtonText,
  batchHint,
  sectionAriaLabel,
  multipointInputRef,
  onListDateChange,
  onMultipointPick,
  onMultipointChange,
}: MultipointUploadProps) {
  return (
    <section className="points-section" aria-label={sectionAriaLabel}>
      <div className="manual-upload-container">
        <div className="coords-row--list">
          <PointDateField
            id="multipoint_date"
            value={listDate}
            disabled={isUploading}
            onChange={onListDateChange}
          />
          <button
            type="button"
            className="submit-btn--outline"
            disabled={isUploading}
            onClick={onMultipointPick}
          >
            {multipointButtonText}
          </button>
        </div>

        <input
          ref={multipointInputRef}
          type="file"
          accept=".txt"
          multiple
          hidden
          disabled={isUploading}
          onChange={onMultipointChange}
        />

        <p className="points-section-subtitle">{batchHint}</p>
      </div>
    </section>
  );
}

export const MultipointUpload = multipointUpload;
