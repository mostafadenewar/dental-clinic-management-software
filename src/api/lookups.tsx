import { createContext, useContext, useEffect, useState } from 'react'
import type { CareProvider, InsuranceBenefit, StorageLocation } from '../types'
import { api, initBackend, useBackendReady, type PatientRecord, type ProcedureCatalogEntry } from './client'

export interface Lookups {
  patients: PatientRecord[]
  providers: CareProvider[]
  coordinators: CareProvider[]
  insurance: InsuranceBenefit[]
  catalog: ProcedureCatalogEntry[]
  locations: StorageLocation[]
  refreshing: boolean
  refresh: () => Promise<void>
}

const EMPTY: Lookups = {
  patients: [],
  providers: [],
  coordinators: [],
  insurance: [],
  catalog: [],
  locations: [],
  refreshing: false,
  refresh: async () => {},
}

const LookupsContext = createContext<Lookups>(EMPTY)
export const useLookups = (): Lookups => useContext(LookupsContext)

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

  const refresh = async () => {
    try {
      setRefreshing(true)
      const [patients, providers, coordinators, insurance, catalog, locations] = await Promise.all([
        api.patients(),
        api.providers(),
        api.coordinators(),
        api.insurance(),
        api.catalog(),
        api.locations(),
      ])
      setValues({ patients, providers, coordinators, insurance, catalog, locations })
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => initBackend(), [])

  useEffect(() => {
    if (ready) void refresh()
  }, [ready])

  const value: Lookups = { ...values, refreshing, refresh }
  return <LookupsContext.Provider value={value}>{children}</LookupsContext.Provider>
}