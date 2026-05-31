import { flushSync } from 'react-dom'
import { waitForNextFrame } from '@/lib/upload_logs'

export const beginUploadSession = async ({
  isUploadingRef,
  onBegin,
}: {
  isUploadingRef: { current: boolean }
  onBegin: () => void
}): Promise<boolean> => {
  if (isUploadingRef.current) return false

  isUploadingRef.current = true
  flushSync(onBegin)
  await waitForNextFrame()
  return true
}

export const endUploadSession = ({
  isUploadingRef,
  onEnd,
}: {
  isUploadingRef: { current: boolean }
  onEnd: () => void
}) => {
  isUploadingRef.current = false
  onEnd()
}
