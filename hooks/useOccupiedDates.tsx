import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { browser } from 'wxt/browser';
import { getOccupiedDatesCacheEpoch, subscribeOccupiedDatesCache } from '@/lib/occupied_dates_cache';

type OccupiedDatesContextValue = {
  occupiedDates: Set<string>;
  isLoading: boolean;
  refreshOccupiedDates: () => Promise<void>;
};

const OccupiedDatesContext = createContext<OccupiedDatesContextValue | null>(null);

const emptyDatesSet = new Set<string>();

export const OccupiedDatesProvider = ({
  isLoggedIn,
  children,
}: {
  isLoggedIn: boolean;
  children: ReactNode;
}) => {
  const [occupiedDates, setOccupiedDates] = useState(emptyDatesSet);
  const [isLoading, setIsLoading] = useState(false);
  const cacheRef = useRef<{ epoch: number; dates: Set<string> } | null>(null);

  const refreshOccupiedDates = useCallback(async function refreshOccupiedDates() {
    if (isLoggedIn) {
      const epoch = getOccupiedDatesCacheEpoch();
      if (cacheRef.current?.epoch === epoch) {
        setOccupiedDates(cacheRef.current.dates);
      } else {
        setIsLoading(true);
        try {
          const response = (await browser.runtime.sendMessage({ action: 'listOccupiedDates' })) as
            | { ok?: boolean; dates?: string[] }
            | undefined;
          const dateValues = response?.dates ?? [];
          const dates = new Set<string>(dateValues);
          cacheRef.current = { epoch, dates };
          setOccupiedDates(dates);
        } catch {
          // Оставляем предыдущий набор дат при сетевой ошибке.
        } finally {
          setIsLoading(false);
        }
      }
    } else {
      cacheRef.current = null;
      const emptyDates = new Set<string>();
      setOccupiedDates(emptyDates);
    }
  }, [isLoggedIn]);

  useEffect(
    function setupOccupiedDatesCacheSubscription() {
      const handleCacheChange = () => {
        cacheRef.current = null;
        (async function refreshCache() {
          try {
            await refreshOccupiedDates();
          } catch (error) {
            console.error(error);
          }
        })();
      };
      return subscribeOccupiedDatesCache(handleCacheChange);
    },
    [refreshOccupiedDates],
  );

  useEffect(
    function handleLoginStatusChange() {
      if (isLoggedIn) {
        (async function refreshOnLogin() {
          try {
            await refreshOccupiedDates();
          } catch (error) {
            console.error(error);
          }
        })();
      } else {
        cacheRef.current = null;
        const emptyDates = new Set<string>();
        setOccupiedDates(emptyDates);
      }
    },
    [isLoggedIn, refreshOccupiedDates],
  );

  const contextValue: OccupiedDatesContextValue = {
    occupiedDates,
    isLoading,
    refreshOccupiedDates,
  };

  return (
    <OccupiedDatesContext.Provider value={contextValue}>
      {children}
    </OccupiedDatesContext.Provider>
  );
};

export function useOccupiedDates(): OccupiedDatesContextValue {
  const context = useContext(OccupiedDatesContext);
  if (context === null) {
    throw new Error('useOccupiedDates must be used within OccupiedDatesProvider');
  }
  return context;
}
