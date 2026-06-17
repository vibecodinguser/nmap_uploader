import { useTranslate } from '@/hooks/useLocale'

type UploadProgressRingProps = {
  progress: number
  isActive: boolean
}

export const UploadProgressRing = ({ progress, isActive }: UploadProgressRingProps) => {
  const t = useTranslate()
  const clampedProgress = Math.min(100, Math.max(0, progress))
  const strokeOffset = 2 * Math.PI * 52 - (clampedProgress / 100) * 2 * Math.PI * 52
  const PROGRESS_RADIUS = 52
  const PROGRESS_SIZE = 120
  const PROGRESS_STROKE = 6
  const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS

  return (
    <div
      className={isActive ? 'upload-progress-ring is-active' : 'upload-progress-ring'}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clampedProgress)}
      aria-label={t('upload.progressAria')}
    >
      <svg
        className="upload-progress-svg"
        viewBox={`0 0 ${PROGRESS_SIZE} ${PROGRESS_SIZE}`}
        aria-hidden="true"
        focusable="false"
      >
        <g transform={`rotate(-90 ${PROGRESS_SIZE / 2} ${PROGRESS_SIZE / 2})`}>
          <circle
            className="upload-progress-track"
            cx={PROGRESS_SIZE / 2}
            cy={PROGRESS_SIZE / 2}
            r={PROGRESS_RADIUS}
            fill="none"
            strokeWidth={PROGRESS_STROKE}
          />
          <circle
            className="upload-progress-indicator"
            cx={PROGRESS_SIZE / 2}
            cy={PROGRESS_SIZE / 2}
            r={PROGRESS_RADIUS}
            fill="none"
            strokeWidth={PROGRESS_STROKE}
            strokeLinecap="round"
            strokeDasharray={PROGRESS_CIRCUMFERENCE}
            strokeDashoffset={strokeOffset}
          />
        </g>
      </svg>
      <span className="upload-progress-percent" aria-hidden="true">
        {Math.round(clampedProgress)}%
      </span>
    </div>
  )
}
