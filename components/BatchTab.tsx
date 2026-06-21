import { type ChangeEvent, type RefObject, useCallback, useRef, useState } from 'react'
import { MultipointUpload } from '@/components/MultipointUpload'
import { useTranslate } from '@/hooks/useLocale'
import { requireAuthBeforeAction } from '@/lib/require_auth'

type BatchTabProps = {
  isUploading: boolean
  isLoggedIn: boolean
  onRequireAuth: () => void
  onMultipointUpload: (input: { files: File[]; date: string }) => void
}

function handleMultipointPick(
  isLoggedIn: boolean,
  onRequireAuth: () => void,
  multipointInputRef: RefObject<HTMLInputElement | null>,
) {
  if (requireAuthBeforeAction({ isLoggedIn, onRequireAuth })) {
    multipointInputRef.current?.click()
  }
}

function handleMultipointChange(
  event: ChangeEvent<HTMLInputElement>,
  listDate: string,
  onMultipointUpload: (input: { files: File[]; date: string }) => void,
) {
  const selectedFiles = Array.from(event.target.files ?? [])
  event.target.value = ''
  if (selectedFiles.length > 0) {
    onMultipointUpload({ files: selectedFiles, date: listDate })
  }
}

export const BatchTab = function batchTab({
  isUploading,
  isLoggedIn,
  onRequireAuth,
  onMultipointUpload,
}: BatchTabProps) {
  const t = useTranslate()
  const [listDate, setListDate] = useState('')
  const multipointInputRef = useRef<HTMLInputElement>(null)

  let multipointButtonText: string
  if (isUploading) {
    multipointButtonText = t('common.uploading')
  } else {
    multipointButtonText = t('common.upload')
  }

  const onMultipointPick = useCallback(
    function onMultipointPick() {
      handleMultipointPick(isLoggedIn, onRequireAuth, multipointInputRef)
    },
    [isLoggedIn, onRequireAuth],
  )

  const onMultipointChange = useCallback(
    function onMultipointChange(event: ChangeEvent<HTMLInputElement>) {
      handleMultipointChange(event, listDate, onMultipointUpload)
    },
    [listDate, onMultipointUpload],
  )

  return (
    <MultipointUpload
      isUploading={isUploading}
      listDate={listDate}
      multipointButtonText={multipointButtonText}
      batchHint={t('points.batchHint')}
      sectionAriaLabel={t('points.batchSectionAria')}
      multipointInputRef={multipointInputRef as RefObject<HTMLInputElement>}
      onListDateChange={setListDate}
      onMultipointPick={onMultipointPick}
      onMultipointChange={onMultipointChange}
    />
  )
}
