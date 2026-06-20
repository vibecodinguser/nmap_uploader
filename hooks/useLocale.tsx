import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { browser } from 'wxt/browser';
import {
  createTranslator,
  getStoredLocale,
  type Locale,
  setRuntimeLocale,
  type TranslateFn,
} from '@/lib/i18n';
import { setStoredLocale } from '@/lib/i18n/locale_storage';
import { DEFAULT_LOCALE, isLocale, LOCALE_STORAGE_KEY } from '@/lib/i18n/locale';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
};

type StorageChanges = Record<string, { newValue?: unknown }>;

type StorageChangeListener = (changes: StorageChanges, area: string) => void;

type LocaleSetter = (locale: Locale) => void;

const LocaleContext = createContext<LocaleContextValue | null>(null);

function applyLocaleChange(nextLocale: Locale, setLocaleState: LocaleSetter): void {
  setLocaleState(nextLocale);
  setRuntimeLocale(nextLocale);
}

async function loadStoredLocale(setLocaleState: LocaleSetter): Promise<void> {
  const storedLocale = await getStoredLocale();
  applyLocaleChange(storedLocale, setLocaleState);
}

function onStoredLocaleLoadError(error: unknown): void {
  console.warn('[nmap_uploader] locale load failed:', error);
}

function handleStoredLocaleLoad(task: Promise<void>): void {
  task.catch(onStoredLocaleLoadError);
}

function applyLocaleStorageChange(changes: StorageChanges, setLocaleState: LocaleSetter): void {
  const hasChange = LOCALE_STORAGE_KEY in changes;
  if (hasChange) {
    const nextLocale = changes[LOCALE_STORAGE_KEY]?.newValue;
    if (isLocale(nextLocale)) {
      applyLocaleChange(nextLocale, setLocaleState);
    }
  }
}

function handleLocaleStorageChange(
  setLocaleState: LocaleSetter,
  changes: StorageChanges,
  area: string,
): void {
  if (area === 'local') {
    applyLocaleStorageChange(changes, setLocaleState);
  }
}

function unsubscribeLocaleStorageChanges(listener: StorageChangeListener): void {
  browser.storage.onChanged.removeListener(listener);
}

function subscribeLocaleStorageChanges(setLocaleState: LocaleSetter): () => void {
  const listener = handleLocaleStorageChange.bind(
    undefined,
    setLocaleState,
  ) as StorageChangeListener;
  browser.storage.onChanged.addListener(listener);
  return unsubscribeLocaleStorageChanges.bind(undefined, listener);
}

function onStoredLocaleSaveComplete(): void {
  // Promise completion handler; result is intentionally ignored.
}

function handleStoredLocaleSave(task: Promise<void>): void {
  task.then(onStoredLocaleSaveComplete);
}

function createLocaleTranslator(locale: Locale): TranslateFn {
  return createTranslator(locale);
}

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(function localeLoadEffect() {
    const loadTask = loadStoredLocale(setLocaleState);
    handleStoredLocaleLoad(loadTask);
  }, []);

  useEffect(function localeStorageEffect() {
    return subscribeLocaleStorageChanges(setLocaleState);
  }, []);

  const setLocale = useCallback(function setLocale(nextLocale: Locale) {
    applyLocaleChange(nextLocale, setLocaleState);
    const saveTask = setStoredLocale(nextLocale);
    handleStoredLocaleSave(saveTask);
  }, []);

  const t = useMemo(
    function localeTranslator() {
      return createLocaleTranslator(locale);
    },
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>
  );
};

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
};

export const useTranslate = (): TranslateFn => {
  const { t } = useLocale();
  return t;
};
