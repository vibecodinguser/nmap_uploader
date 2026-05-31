import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import {
  DEFAULT_STROKE_COLOR,
  getEffectiveStrokeColor,
  normalizeStrokeColor,
  STROKE_COLOR_STORAGE_KEY,
  toStrokeColorInputValue,
} from '@/lib/stroke_color'
import { notifyMapTabsAboutStrokeColor } from '@/lib/stroke_color_notify'
import { getStoredStrokeColorRaw, setStoredStrokeColorRaw } from '@/lib/stroke_color_settings'

type ApplyStatus = 'idle' | 'success' | 'error'

export const useStrokeColor = () => {
  const [inputValue, setInputValue] = useState('')
  const [effectiveColor, setEffectiveColor] = useState(DEFAULT_STROKE_COLOR)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle')
  const [isLoaded, setIsLoaded] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const applyRawValue = useCallback((raw: string) => {
    const input = toStrokeColorInputValue(raw)
    setInputValue(input)
    setEffectiveColor(getEffectiveStrokeColor(input))
    setValidationError(null)
  }, [])

  useEffect(() => {
    getStoredStrokeColorRaw()
      .then(applyRawValue)
      .finally(() => setIsLoaded(true))
  }, [applyRawValue])

  useEffect(() => {
    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local' || !(STROKE_COLOR_STORAGE_KEY in changes)) return

      const nextValue = changes[STROKE_COLOR_STORAGE_KEY]?.newValue
      applyRawValue(typeof nextValue === 'string' ? nextValue : '')
    }

    browser.storage.onChanged.addListener(handleStorageChange)
    return () => browser.storage.onChanged.removeListener(handleStorageChange)
  }, [applyRawValue])

  const handleInputChange = (value: string) => {
    setApplyStatus('idle')
    setInputValue(value)

    if (!value.trim()) {
      setValidationError(null)
      setEffectiveColor(DEFAULT_STROKE_COLOR)
      return
    }

    const normalized = normalizeStrokeColor(value)
    if (!normalized) {
      setValidationError('Введите цвет в формате RGB или RRGGBB')
      return
    }

    setValidationError(null)
    setEffectiveColor(normalized)
  }

  const handleApply = async () => {
    const trimmed = inputValue.trim()
    if (trimmed && !normalizeStrokeColor(trimmed)) return

    setIsApplying(true)
    setApplyStatus('idle')
    try {
      const nextEffectiveColor = await setStoredStrokeColorRaw(trimmed)
      const result = await notifyMapTabsAboutStrokeColor(nextEffectiveColor)
      setEffectiveColor(nextEffectiveColor)
      setValidationError(null)
      setApplyStatus(result.ok ? 'success' : 'error')
    } catch (error: unknown) {
      console.warn('[nmap_uploader] stroke color apply failed:', error)
      setApplyStatus('error')
    } finally {
      setIsApplying(false)
    }
  }

  const canApply = isLoaded && !validationError && !isApplying

  return {
    inputValue,
    effectiveColor,
    validationError,
    applyStatus,
    isLoaded,
    isApplying,
    canApply,
    handleInputChange,
    handleApply,
  }
}
