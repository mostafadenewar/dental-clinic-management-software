import { useCallback, useEffect, useState } from 'react'
import type { Lookups } from './lookups-context'
import { LookupsContext } from './lookups-context'
import { api, useBackendReady } from './client'

export function LookupsProvider({ children }: { children: React.ReactNode }) {
  const ready = useBackendReady()
  const [values, setValues] = useState<Omit<Lookups, 'refreshing' | 'refresh'>>({
    patients: [],
    providers: [],
    coordinators: [],
    insurance: [],
    catalog: [],
    locations: [],
  })
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [patients, providers, coordinators, insurance, catalog, locations] = await Promise.all([
        api.patients(),
        api.providers(),
        api.coordinators(),
        api.insurance(),
        api.catalog(),
        api.locations(),
      ])
      setValues({ patients, providers, coordinators, insurance, catalog, locations })
    } catch (error) {
      console.error('[dcms] failed to load lookup data:', error)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (ready) void refresh()
  }, [ready, refresh])

  const value: Lookups = { ...values, refreshing, refresh }
  return <LookupsContext.Provider value={value}>{children}</LookupsContext.Provider>
}
