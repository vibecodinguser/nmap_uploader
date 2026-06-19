import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { useTranslate } from '@/hooks/useLocale';
import {
  DEFAULT_STROKE_COLOR,
  getEffectiveStrokeColor,
  normalizeStrokeColor,
  STROKE_COLOR_STORAGE_KEY,
  toStrokeColorInputValue,
} from '@/lib/stroke_color';
import { notifyMapTabsAboutStrokeColor } from '@/lib/stroke_color_notify';
import { getStoredStrokeColorRaw, setStoredStrokeColorRaw } from '@/lib/stroke_color_settings';

type ApplyStatus = 'idle' | 'success' | 'error';
type ApplyRawValue = (raw: string) => void;
type StorageChanges = Record<string, { newValue?: unknown }>;
type StorageChangeListener = (changes: StorageChanges, area: string) => void;
type LoadedSetter = (loaded: boolean) => void;
type ApplyStatusSetter = (status: ApplyStatus) => void;
type InputValueSetter = (value: string) => void;
type EffectiveColorSetter = (color: string) => void;
type ValidationErrorSetter = (error: string | null) => void;
type ApplyingSetter = (value: boolean) => void;

type LoadEffectContext = {
  applyRawValue: ApplyRawValue;
  setLoaded: LoadedSetter;
};

type StrokeColorInputChangeSetters = {
  setApplyStatus: ApplyStatusSetter;
  setInputValue: InputValueSetter;
  setValidationError: ValidationErrorSetter;
  setEffectiveColor: EffectiveColorSetter;
};

type ExecuteStrokeColorApplyParams = {
  trimmed: string;
  setIsApplying: ApplyingSetter;
  setApplyStatus: ApplyStatusSetter;
  setEffectiveColor: EffectiveColorSetter;
  setValidationError: ValidationErrorSetter;
};

function applyRawStrokeColor(raw: string, applyRawValue: ApplyRawValue): void {
  applyRawValue(raw);
}

function updateStrokeColorState(
  input: string,
  setInputValue: InputValueSetter,
  setEffectiveColor: EffectiveColorSetter,
  setValidationError: ValidationErrorSetter,
): void {
  const effectiveColor = getEffectiveStrokeColor(input);
  setInputValue(input);
  setEffectiveColor(effectiveColor);
  setValidationError(null);
}

async function loadStoredStrokeColor(context: LoadEffectContext): Promise<void> {
  try {
    const raw = await getStoredStrokeColorRaw();
    applyRawStrokeColor(raw, context.applyRawValue);
  } finally {
    context.setLoaded(true);
  }
}

function onStrokeColorLoadSettled(): void {
  // Promise completion handler; result is intentionally ignored.
}

function handleStrokeColorLoad(task: Promise<void>): void {
  task.then(onStrokeColorLoadSettled);
}

function readStrokeColorStorageValue(changes: StorageChanges): string {
  let result = '';
  const nextValue = changes[STROKE_COLOR_STORAGE_KEY]?.newValue;
  if (typeof nextValue === 'string') {
    result = nextValue;
  }
  return result;
}

function applyStrokeColorStorageChange(
  changes: StorageChanges,
  applyRawValue: ApplyRawValue,
): void {
  const hasChange = STROKE_COLOR_STORAGE_KEY in changes;
  if (hasChange) {
    const nextValue = readStrokeColorStorageValue(changes);
    applyRawValue(nextValue);
  }
}

function handleStrokeColorStorageChange(
  applyRawValue: ApplyRawValue,
  changes: StorageChanges,
  area: string,
): void {
  if (area === 'local') {
    applyStrokeColorStorageChange(changes, applyRawValue);
  }
}

function unsubscribeStrokeColorStorage(listener: StorageChangeListener): void {
  browser.storage.onChanged.removeListener(listener);
}

function subscribeStrokeColorStorage(applyRawValue: ApplyRawValue): () => void {
  const listener = handleStrokeColorStorageChange.bind(
    undefined,
    applyRawValue,
  ) as StorageChangeListener;
  browser.storage.onChanged.addListener(listener);
  return unsubscribeStrokeColorStorage.bind(undefined, listener);
}

function resolveApplyStatus(ok: boolean): ApplyStatus {
  let result: ApplyStatus = 'error';
  if (ok) {
    result = 'success';
  }
  return result;
}

function onStrokeColorApplyError(error: unknown): void {
  console.warn('[nmap_uploader] stroke color apply failed:', error);
}

function canApplyStrokeColor(trimmed: string): boolean {
  let result = true;
  if (trimmed) {
    const normalized = normalizeStrokeColor(trimmed);
    result = Boolean(normalized);
  }
  return result;
}

function applyStrokeColorInputChange(
  value: string,
  validationMessage: string,
  setters: StrokeColorInputChangeSetters,
): void {
  setters.setApplyStatus('idle');
  setters.setInputValue(value);

  const trimmed = value.trim();
  if (trimmed) {
    const normalized = normalizeStrokeColor(value);
    if (normalized) {
      setters.setValidationError(null);
      setters.setEffectiveColor(normalized);
    } else {
      setters.setValidationError(validationMessage);
    }
  } else {
    setters.setValidationError(null);
    setters.setEffectiveColor(DEFAULT_STROKE_COLOR);
  }
}

async function executeStrokeColorApply(params: ExecuteStrokeColorApplyParams): Promise<void> {
  const canProceed = canApplyStrokeColor(params.trimmed);
  if (canProceed) {
    params.setIsApplying(true);
    params.setApplyStatus('idle');
    try {
      const nextEffectiveColor = await setStoredStrokeColorRaw(params.trimmed);
      const result = await notifyMapTabsAboutStrokeColor(nextEffectiveColor);
      const nextStatus = resolveApplyStatus(result.ok);
      params.setEffectiveColor(nextEffectiveColor);
      params.setValidationError(null);
      params.setApplyStatus(nextStatus);
    } catch (error: unknown) {
      onStrokeColorApplyError(error);
      params.setApplyStatus('error');
    } finally {
      params.setIsApplying(false);
    }
  }
}

export const useStrokeColor = () => {
  const t = useTranslate();
  const strokeColorValidationMessage = t('settings.strokeColorValidation');
  const [inputValue, setInputValue] = useState('');
  const [effectiveColor, setEffectiveColor] = useState(DEFAULT_STROKE_COLOR);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const applyRawValue = useCallback(function applyRawValue(raw: string): void {
    const input = toStrokeColorInputValue(raw);
    updateStrokeColorState(input, setInputValue, setEffectiveColor, setValidationError);
  }, []);

  useEffect(
    function strokeColorLoadEffect() {
      const loadTask = loadStoredStrokeColor({ applyRawValue, setLoaded: setIsLoaded });
      handleStrokeColorLoad(loadTask);
    },
    [applyRawValue],
  );

  useEffect(
    function strokeColorStorageEffect() {
      return subscribeStrokeColorStorage(applyRawValue);
    },
    [applyRawValue],
  );

  const handleInputChange = useCallback(
    function handleInputChange(value: string): void {
      applyStrokeColorInputChange(value, strokeColorValidationMessage, {
        setApplyStatus,
        setInputValue,
        setValidationError,
        setEffectiveColor,
      });
    },
    [strokeColorValidationMessage],
  );

  const handleApply = useCallback(
    async function handleApply(): Promise<void> {
      const trimmed = inputValue.trim();
      await executeStrokeColorApply({
        trimmed,
        setIsApplying,
        setApplyStatus,
        setEffectiveColor,
        setValidationError,
      });
    },
    [inputValue],
  );

  const canApply = isLoaded && !validationError && !isApplying;

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
  };
};
