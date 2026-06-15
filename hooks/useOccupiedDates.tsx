import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { browser } from 'wxt/browser'
import { getOccupiedDatesCacheEpoch, subscribeOccupiedDatesCache } from '@/lib/occupied_dates_cache'

type OccupiedDatesContextValue = {
  occupiedDates: Set<string>
  isLoading: boolean
  refreshOccupiedDates: () => Promise<void>
}

const OccupiedDatesContext = createContext<OccupiedDatesContextValue | null>(null)

type OccupiedDatesProviderProps = {
  isLoggedIn: boolean
  children: ReactNode
}

export const OccupiedDatesProvider = ({ isLoggedIn, children }: OccupiedDatesProviderProps) => {
  const [occupiedDates, setOccupiedDates] = useState<Set<string>>(() => new Set())
  const [isLoading, setIsLoading] = useState(false)
  const cacheRef = useRef<{ epoch: number; dates: Set<string> } | null>(null)

  const refreshOccupiedDates = useCallback(async () => {
    if (!isLoggedIn) {
      cacheRef.current = null
      setOccupiedDates(new Set())
      return
    }

    const epoch = getOccupiedDatesCacheEpoch()
    if (cacheRef.current?.epoch === epoch) {
      setOccupiedDates(cacheRef.current.dates)
      return
    }

    setIsLoading(true)
    try {
      const response = (await browser.runtime.sendMessage({ action: 'listOccupiedDates' })) as
        | { ok?: boolean; dates?: string[] }
        | undefined
      const dates = new Set<string>(response?.dates ?? [])
      cacheRef.current = { epoch, dates }
      setOccupiedDates(dates)
    } catch {
      // Оставляем предыдущий набор дат при сетевой ошибке.
    } finally {
      setIsLoading(false)
    }
  }, [isLoggedIn])

  useEffect(
    () =>
      subscribeOccupiedDatesCache(() => {
        cacheRef.current = null
        void refreshOccupiedDates()
      }),
    [refreshOccupiedDates],
  )

  useEffect(() => {
    if (!isLoggedIn) {
      cacheRef.current = null
      setOccupiedDates(new Set())
      return
    }
    void refreshOccupiedDates()
  }, [isLoggedIn, refreshOccupiedDates])

  return (
    <OccupiedDatesContext.Provider value={{ occupiedDates, isLoading, refreshOccupiedDates }}>
      {children}
    </OccupiedDatesContext.Provider>
  )
}

export const useOccupiedDates = (): OccupiedDatesContextValue => {
  const context = useContext(OccupiedDatesContext)
  if (!context) {
    throw new Error('useOccupiedDates must be used within OccupiedDatesProvider')
  }
  return context
}
