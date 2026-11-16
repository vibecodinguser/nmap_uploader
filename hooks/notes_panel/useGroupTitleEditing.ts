import { useEffect, useRef, useState } from 'react'

/**
 * Переименование группы прямо в заголовке.
 *
 * Фокус ставится вручную: `autofocus` в разметке перехватывает внимание даже
 * когда пользователь просто пролистал список. Пустое имя и имя без изменений
 * не сохраняются — заголовок возвращается к прежнему.
 */
export const useGroupTitleEditing = ({
  title,
  onRename,
}: {
  title: string
  onRename?: (name: string) => void
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isEditing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  const start = (): void => {
    setDraft(title)
    setIsEditing(true)
  }

  const cancel = (): void => {
    setDraft(title)
    setIsEditing(false)
  }

  const commit = (): void => {
    setIsEditing(false)
    const next = draft.trim()
    if (!next || next === title) {
      setDraft(title)
      return
    }
    onRename?.(next)
  }

  return { isEditing, draft, inputRef, start, cancel, commit, setDraft }
}
