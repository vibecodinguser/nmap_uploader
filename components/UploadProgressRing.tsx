import { useTranslate } from '@/hooks/useLocale'

const progressRadius = 52
const progressSize = 120
const progressStroke = 6
const progressCenter = progressSize / 2
const progressCircumference = 2 * Math.PI * progressRadius

type UploadProgressRingProps = {
  progress: number
  isActive: boolean
}

function clampProgress(value: number): number {
  let result = value
  if (result < 0) {
    result = 0
  }
  if (result > 100) {
    result = 100
  }
  return result
}

function getProgressRingClassName(isActive: boolean): string {
  let className = 'upload-progress-ring'
  if (isActive) {
    className += ' is-active'
  }
  return className
}

function getStrokeOffset(progress: number): number {
  const progressRatio = progress / 100
  return progressCircumference * (1 - progressRatio)
}

export const UploadProgressRing = ({ progress, isActive }: UploadProgressRingProps) => {
  const t = useTranslate()
  const clampedProgress = clampProgress(progress)
  const strokeOffset = getStrokeOffset(clampedProgress)
  const roundedProgress = Math.round(clampedProgress)

  return (
    <div
      className={getProgressRingClassName(isActive)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={roundedProgress}
      aria-label={t('upload.progressAria')}
    >
      <svg
        className="upload-progress-svg"
        viewBox={`0 0 ${progressSize} ${progressSize}`}
        aria-hidden="true"
        focusable="false"
      >
        <g transform={`rotate(-90 ${progressCenter} ${progressCenter})`}>
          <circle
            className="upload-progress-track"
            cx={progressCenter}
            cy={progressCenter}
            r={progressRadius}
            fill="none"
            strokeWidth={progressStroke}
          />
          <circle
            className="upload-progress-indicator"
            cx={progressCenter}
            cy={progressCenter}
            r={progressRadius}
            fill="none"
            strokeWidth={progressStroke}
            strokeLinecap="round"
            strokeDasharray={progressCircumference}
            strokeDashoffset={strokeOffset}
          />
        </g>
      </svg>
      <span className="upload-progress-percent" aria-hidden="true">
        {roundedProgress}%
      </span>
    </div>
  )
}
